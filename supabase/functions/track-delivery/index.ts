import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const trackingNumber = url.searchParams.get('tracking');

    if (!trackingNumber) {
      return new Response(
        JSON.stringify({ error: 'Tracking number is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const { data, error } = await supabaseClient
      .from('deliveries')
      .select(`
        *,
        staff:profiles!delivery_staff_id (
          first_name,
          last_name
        ),
        order:orders (
          customer_id,
          total_amount
        )
      `)
      .eq('tracking_number', trackingNumber)
      .single();

    if (error) throw error;

    if (!data) {
      return new Response(
        JSON.stringify({ error: 'Delivery not found' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        tracking_number: data.tracking_number,
        status: data.status,
        estimated_delivery: data.estimated_delivery,
        actual_delivery: data.actual_delivery,
        delivery_staff: `${data.staff.first_name} ${data.staff.last_name}`,
        route_number: data.route_number,
        delivery_zone: data.delivery_zone,
        delivery_notes: data.delivery_notes,
        created_at: data.created_at,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});