import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface WhatsAppMessage {
  from: string;
  to: string;
  body: string;
  media_url?: string;
  media_type?: string;
  timestamp: string;
  message_id: string;
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

    // Parse the incoming webhook payload
    const payload = await req.json();
    console.log("Received WhatsApp webhook payload:", JSON.stringify(payload));

    // Extract the message details (this will vary based on your WhatsApp API provider)
    // This example assumes a simplified structure - adjust according to your provider's format
    const message: WhatsAppMessage = {
      from: payload.from || '',
      to: payload.to || '',
      body: payload.body || '',
      media_url: payload.media_url,
      media_type: payload.media_type,
      timestamp: payload.timestamp || new Date().toISOString(),
      message_id: payload.message_id || crypto.randomUUID()
    };

    // Validate the message
    if (!message.from || !message.to) {
      throw new Error("Invalid message: missing from or to fields");
    }

    // Determine message type
    const messageType = message.media_url ? (message.media_type || 'other') : 'text';

    // Find or create customer based on phone number
    let customerId: string | null = null;
    const { data: existingCustomers, error: customerError } = await supabaseClient
      .from('customers')
      .select('id, tenant_id')
      .eq('phone', message.from)
      .limit(1);

    if (customerError) {
      console.error("Error finding customer:", customerError);
    }

    let tenantId: string | null = null;
    
    if (existingCustomers && existingCustomers.length > 0) {
      customerId = existingCustomers[0].id;
      tenantId = existingCustomers[0].tenant_id;
    } else {
      // If no customer found, we need to determine which tenant this should belong to
      // For simplicity, we'll use the first tenant in the system
      // In a real implementation, you might use the 'to' number to determine the tenant
      const { data: tenants, error: tenantError } = await supabaseClient
        .from('tenants')
        .select('id')
        .limit(1);
        
      if (tenantError) {
        throw new Error(`Error finding tenant: ${tenantError.message}`);
      }
      
      if (!tenants || tenants.length === 0) {
        throw new Error("No tenants found in the system");
      }
      
      tenantId = tenants[0].id;
      
      // Create a new customer
      const { data: newCustomer, error: createError } = await supabaseClient
        .from('customers')
        .insert({
          tenant_id: tenantId,
          name: `WhatsApp User ${message.from.substring(message.from.length - 4)}`,
          phone: message.from,
          email: `whatsapp_${message.from.replace(/\D/g, '')}@example.com`,
          address: 'Unknown (WhatsApp User)'
        })
        .select()
        .single();
        
      if (createError) {
        throw new Error(`Error creating customer: ${createError.message}`);
      }
      
      customerId = newCustomer.id;
    }

    // Find or create a WhatsApp session
    let sessionId: string | null = null;
    const { data: existingSessions, error: sessionError } = await supabaseClient
      .from('whatsapp_sessions')
      .select('id')
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .limit(1);
      
    if (sessionError) {
      console.error("Error finding session:", sessionError);
    }
    
    if (existingSessions && existingSessions.length > 0) {
      sessionId = existingSessions[0].id;
      
      // Update the last_message_at timestamp
      await supabaseClient
        .from('whatsapp_sessions')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', sessionId);
    } else {
      // Create a new session
      const { data: newSession, error: createSessionError } = await supabaseClient
        .from('whatsapp_sessions')
        .insert({
          tenant_id: tenantId,
          customer_id: customerId,
          phone_number: message.from,
          status: 'active'
        })
        .select()
        .single();
        
      if (createSessionError) {
        throw new Error(`Error creating session: ${createSessionError.message}`);
      }
      
      sessionId = newSession.id;
    }

    // Log the incoming message
    const { error: messageError } = await supabaseClient
      .from('whatsapp_messages')
      .insert({
        tenant_id: tenantId,
        from_number: message.from,
        to_number: message.to,
        message_type: messageType,
        content: message.body,
        media_url: message.media_url,
        direction: 'inbound',
        status: 'received',
        customer_id: customerId,
        session_id: sessionId
      });
      
    if (messageError) {
      throw new Error(`Error logging message: ${messageError.message}`);
    }

    // Process the message with the chatbot API
    // Get a service role token for internal API calls
    const response = await fetch(
      `${supabaseUrl}/functions/v1/chatbot-api`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          message: message.body,
          userType: 'customer', // Explicitly set userType to 'customer'
          customerId: customerId,
          channel: 'whatsapp',
          phoneNumber: message.from
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Error calling chatbot API: ${response.status} ${response.statusText}`);
    }

    const chatbotResponse = await response.json();

    // Log the outbound message
    const { error: outboundError } = await supabaseClient
      .from('whatsapp_messages')
      .insert({
        tenant_id: tenantId,
        from_number: message.to,
        to_number: message.from,
        message_type: 'text',
        content: chatbotResponse.content,
        direction: 'outbound',
        status: 'sent',
        customer_id: customerId,
        session_id: sessionId
      });
      
    if (outboundError) {
      throw new Error(`Error logging outbound message: ${outboundError.message}`);
    }

    // Check if the message is an order request
    // This is a simplified check - in a real implementation, you would use NLP or a more sophisticated approach
    if (chatbotResponse.type === 'order_request') {
      console.log("Order request detected via WhatsApp");
      
      // In a real implementation, you would create an order here
      // For now, we'll just log it
      await supabaseClient
        .from('user_activity_logs')
        .insert({
          user_id: customerId,
          action_type: 'whatsapp_order_request',
          details: {
            message: message.body,
            timestamp: new Date().toISOString()
          },
          tenant_id: tenantId
        });
    }

    // In a real implementation, you would now send the response back to the customer via the WhatsApp API
    // This would involve making an API call to your WhatsApp provider (e.g., Twilio, MessageBird, etc.)
    // For this example, we'll just return the response

    return new Response(
      JSON.stringify({
        success: true,
        message: "WhatsApp message processed successfully",
        response: chatbotResponse.content
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (err) {
    console.error("Error processing WhatsApp webhook:", err);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "An error occurred processing the WhatsApp webhook"
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