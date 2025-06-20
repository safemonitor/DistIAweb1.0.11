import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface CampaignLaunchRequest {
  campaignId: string;
  testMode?: boolean;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Get WhatsApp API credentials from environment variables
    const whatsappApiKey = Deno.env.get('WHATSAPP_API_KEY');
    const whatsappApiUrl = Deno.env.get('WHATSAPP_API_URL');
    const whatsappFromNumber = Deno.env.get('WHATSAPP_FROM_NUMBER');

    if (!whatsappApiKey || !whatsappApiUrl || !whatsappFromNumber) {
      throw new Error("WhatsApp API configuration is incomplete");
    }

    // Parse the request body
    const requestData: CampaignLaunchRequest = await req.json();
    const { campaignId, testMode = false } = requestData;

    if (!campaignId) {
      throw new Error("Campaign ID is required");
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseClient
      .from('campaigns')
      .select(`
        *,
        promotional_content:campaign_promotional_content(
          promotional_content_id,
          sequence_number,
          promotional_content:promotional_content(*)
        )
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Error fetching campaign: ${campaignError?.message || "Campaign not found"}`);
    }

    // Check if campaign is active
    if (campaign.status !== 'active' && !testMode) {
      throw new Error(`Campaign is not active. Current status: ${campaign.status}`);
    }

    // Get target customers based on campaign.target_audience
    let targetCustomers: any[] = [];
    
    if (testMode) {
      // In test mode, only get the first customer
      const { data: testCustomers, error: testCustomerError } = await supabaseClient
        .from('customers')
        .select('id, name, phone')
        .eq('tenant_id', campaign.tenant_id)
        .limit(1);
        
      if (testCustomerError) {
        throw new Error(`Error fetching test customers: ${testCustomerError.message}`);
      }
      
      targetCustomers = testCustomers || [];
    } else {
      switch (campaign.target_audience) {
        case 'all_customers':
          // Get all customers for the tenant
          const { data: allCustomers, error: allCustomersError } = await supabaseClient
            .from('customers')
            .select('id, name, phone')
            .eq('tenant_id', campaign.tenant_id);
            
          if (allCustomersError) {
            throw new Error(`Error fetching all customers: ${allCustomersError.message}`);
          }
          
          targetCustomers = allCustomers || [];
          break;
          
        case 'new_customers':
          // Get customers created in the last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const { data: newCustomers, error: newCustomersError } = await supabaseClient
            .from('customers')
            .select('id, name, phone')
            .eq('tenant_id', campaign.tenant_id)
            .gte('created_at', thirtyDaysAgo.toISOString());
            
          if (newCustomersError) {
            throw new Error(`Error fetching new customers: ${newCustomersError.message}`);
          }
          
          targetCustomers = newCustomers || [];
          break;
          
        case 'specific_customers':
          // Get customers from campaign_customer_segments
          const { data: specificCustomers, error: specificCustomersError } = await supabaseClient
            .from('campaign_customer_segments')
            .select(`
              customer_id,
              customer:customers(id, name, phone)
            `)
            .eq('campaign_id', campaignId);
            
          if (specificCustomersError) {
            throw new Error(`Error fetching specific customers: ${specificCustomersError.message}`);
          }
          
          targetCustomers = specificCustomers?.map(item => item.customer) || [];
          break;
          
        case 'customer_segment':
          // This would typically involve more complex segmentation logic
          // For this example, we'll just get customers who have placed orders
          const { data: segmentCustomers, error: segmentCustomersError } = await supabaseClient
            .from('customers')
            .select('id, name, phone')
            .eq('tenant_id', campaign.tenant_id)
            .in('id', (subquery) => {
              subquery
                .from('orders')
                .select('customer_id')
                .eq('tenant_id', campaign.tenant_id);
            });
            
          if (segmentCustomersError) {
            throw new Error(`Error fetching segment customers: ${segmentCustomersError.message}`);
          }
          
          targetCustomers = segmentCustomers || [];
          break;
          
        default:
          throw new Error(`Unknown target audience: ${campaign.target_audience}`);
      }
    }

    if (targetCustomers.length === 0) {
      throw new Error("No target customers found for this campaign");
    }

    // Sort promotional content by sequence number
    const promotionalContent = campaign.promotional_content
      .sort((a: any, b: any) => a.sequence_number - b.sequence_number)
      .map((item: any) => item.promotional_content);

    if (promotionalContent.length === 0) {
      throw new Error("No promotional content found for this campaign");
    }

    // Send messages to each target customer
    const messagePromises = targetCustomers.map(async (customer) => {
      // Skip customers without phone numbers
      if (!customer.phone) {
        console.log(`Customer ${customer.id} has no phone number, skipping`);
        return null;
      }

      // For each piece of promotional content, send a message
      for (const content of promotionalContent) {
        // Prepare the message based on content type
        let messageType = 'text';
        let messageContent = '';
        let mediaUrl = null;
        
        switch (content.type) {
          case 'text':
            messageType = 'text';
            messageContent = content.content_text;
            break;
            
          case 'image':
          case 'video':
            messageType = content.type;
            mediaUrl = content.content_url;
            messageContent = content.content_text || ''; // Optional caption
            break;
            
          default:
            console.log(`Unsupported content type: ${content.type}, skipping`);
            continue;
        }

        // In a real implementation, you would make an API call to your WhatsApp provider here
        // For this example, we'll just log the message and record it in the database
        console.log(`Sending ${messageType} message to ${customer.phone}:`, messageContent);

        // Log the outbound message in the database
        const { error: messageError } = await supabaseClient
          .from('whatsapp_messages')
          .insert({
            tenant_id: campaign.tenant_id,
            from_number: whatsappFromNumber,
            to_number: customer.phone,
            message_type: messageType,
            content: messageContent,
            media_url: mediaUrl,
            direction: 'outbound',
            status: 'sent',
            customer_id: customer.id,
            session_id: null // No active session for campaign messages
          });
          
        if (messageError) {
          console.error(`Error logging message to ${customer.phone}:`, messageError);
        }
      }

      return customer.id;
    });

    // Wait for all messages to be sent
    const results = await Promise.all(messagePromises);
    const successfulSends = results.filter(Boolean).length;

    // Update campaign metrics
    const today = new Date().toISOString().split('T')[0];
    const { error: metricsError } = await supabaseClient
      .from('campaign_metrics')
      .upsert({
        campaign_id: campaignId,
        metric_date: today,
        messages_sent: successfulSends * promotionalContent.length,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'campaign_id,metric_date'
      });
      
    if (metricsError) {
      console.error("Error updating campaign metrics:", metricsError);
    }

    // If not in test mode, update campaign status if it's the end date
    if (!testMode) {
      const now = new Date();
      if (campaign.end_date && new Date(campaign.end_date) <= now) {
        const { error: updateError } = await supabaseClient
          .from('campaigns')
          .update({ status: 'completed' })
          .eq('id', campaignId);
          
        if (updateError) {
          console.error("Error updating campaign status:", updateError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Campaign ${testMode ? 'test' : 'launch'} successful`,
        targetCustomers: targetCustomers.length,
        messagesSent: successfulSends * promotionalContent.length
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (err) {
    console.error("Error launching campaign:", err);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "An error occurred launching the campaign"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});