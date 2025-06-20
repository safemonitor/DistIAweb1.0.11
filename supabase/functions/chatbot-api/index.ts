import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { OpenAI } from 'npm:openai@4.28.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Define the database query tool
const databaseQueryTool = {
  type: "function",
  function: {
    name: "query_database",
    description: "Executes a SQL query against the application's PostgreSQL database to retrieve data. Use this tool to answer questions about the user's data, generate reports, or provide insights based on database information. ALWAYS include tenant_id filtering in your queries for security.",
    parameters: {
      type: "object",
      properties: {
        sql_query: {
          type: "string",
          description: "The SQL query to execute. Must be a valid PostgreSQL SELECT query. MUST include tenant_id filtering for security."
        },
        description: {
          type: "string",
          description: "A human-readable description of what this query is doing and why."
        }
      },
      required: ["sql_query", "description"]
    }
  }
};

// Define the database schema for the system prompt
const databaseSchema = `
Key tables and their relationships:

- tenants: id, name, subscription_plan, max_users
- profiles: id, tenant_id, role, first_name, last_name
- customers: id, tenant_id, name, email, phone, address
- products: id, tenant_id, name, description, price, sku, stock_quantity, category
- orders: id, tenant_id, customer_id, order_date, total_amount, status
- order_items: id, order_id, product_id, quantity, unit_price
- invoices: id, tenant_id, order_id, invoice_date, due_date, total_amount, status
- deliveries: id, tenant_id, order_id, delivery_staff_id, tracking_number, status, estimated_delivery, actual_delivery
- locations: id, tenant_id, name, description, location_type, address, is_active
- inventory_transactions: id, tenant_id, product_id, location_id, transaction_type, quantity, performed_by
- stock_transfers: id, tenant_id, from_location_id, to_location_id, status, transfer_date
- van_inventories: id, profile_id, product_id, quantity
- visits: id, tenant_id, customer_id, visit_date, notes, outcome
- routes: id, tenant_id, name, description, type
`;

// Define the customer-facing prompt
const customerPrompt = `
You are a helpful assistant for the DistrIA distribution company. Your role is to assist customers with their inquiries, provide product information, and help with order-related questions.

INSTRUCTIONS:
1. Be friendly, professional, and concise in your responses.
2. Help customers with:
   - Product information and availability
   - Order status inquiries
   - Placing new orders
   - General company information
   - Promotions and special offers
3. For order placement, collect the necessary information:
   - Products and quantities
   - Delivery address (or confirm existing address)
   - Preferred delivery date/time
4. If you don't know the answer to a specific question, politely say so and offer to connect the customer with a human representative.
5. Maintain a conversational and helpful tone throughout the interaction.
6. If a customer asks about sensitive information like other customers' data or internal company operations, politely explain that you cannot provide that information.

IMPORTANT:
- You can only access information that is relevant to the current customer.
- You cannot modify or delete any customer data without explicit confirmation.
- For complex issues, suggest contacting customer support directly.
`;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get request body
    const requestData = await req.json();
    const { message, userType = 'internal', customerId, channel, phoneNumber } = requestData;

    if (!message) {
      throw new Error("Message is required");
    }

    // Get authorization header for authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Authorization header is required");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error("Authentication failed");
    }

    // Get user's tenant_id from profiles table
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('tenant_id, role, first_name, last_name')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error("Failed to get user profile");
    }

    const tenantId = profileData.tenant_id;
    const userRole = profileData.role;
    const userName = `${profileData.first_name} ${profileData.last_name}`;
    const isSuperadmin = userRole === 'superadmin';

    // Initialize OpenAI client
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Determine if this is a customer interaction or internal staff
    const isCustomerInteraction = userType === 'customer';

    // Get customer information if this is a customer interaction
    let customerInfo = null;
    if (isCustomerInteraction && customerId) {
      const { data: customer, error: customerError } = await supabaseClient
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();
        
      if (!customerError && customer) {
        customerInfo = customer;
      }
    }

    // Create system prompt based on user type
    let systemPrompt;
    let tools = [];
    
    if (isCustomerInteraction) {
      // Use customer-facing prompt
      systemPrompt = customerPrompt;
      
      // Add customer context if available
      if (customerInfo) {
        systemPrompt += `\nCUSTOMER CONTEXT:
- Name: ${customerInfo.name}
- Phone: ${phoneNumber || customerInfo.phone}
- Email: ${customerInfo.email}
- Address: ${customerInfo.address}
`;
      }
      
      // No database query tool for customers
      tools = [];
    } else {
      // Use internal staff prompt with database access
      systemPrompt = `
You are an intelligent assistant for the DistrIA application, a multi-tenant distribution management system. Your primary goal is to help users by answering questions about their data, generating reports, and providing insights based on the application's functionalities and database.

USER CONTEXT:
- User: ${userName}
- Role: ${userRole}
- Tenant ID: ${tenantId}

APPLICATION MODULES:
1. Presales & Delivery Module: Manages customer visits, delivery assignments, route planning, and tracking. Key tables: visits, deliveries, routes, route_customers, route_agent_assignments.
2. Van Sales Module: Handles mobile inventory for sales agents, on-the-go order creation, and stock movements. Key tables: van_inventories, van_stock_movements, orders (for sales orders).
3. Warehouse Management System (WMS): Manages inventory across various locations (warehouses, stores), stock adjustments, transfers, receiving, and picking. Key tables: locations, products, inventory_transactions, stock_transfers, stock_transfer_items, location_inventory.
4. Core Data: tenants, profiles (users), customers, products, orders, order_items, invoices, supplier_orders, supplier_order_items, settings, user_activity_logs.

DATABASE SCHEMA:
${databaseSchema}

CRITICAL SECURITY INSTRUCTION:
${isSuperadmin ? 
  "As a superadmin, you have access to all data across all tenants. You may query any table without tenant_id restrictions." : 
  `ALL database queries MUST include a WHERE tenant_id = '${tenantId}' clause. This is non-negotiable for data isolation.`}

INSTRUCTIONS FOR TOOL USAGE:
- When a user asks for data that requires querying the database (e.g., "How many pending orders?", "List top 5 customers by total spent", "Show me inventory levels for product X"), you MUST use the query_database tool.
- The sql_query parameter MUST be a valid PostgreSQL query. Ensure it is syntactically correct ${isSuperadmin ? "" : `and ALWAYS includes the tenant_id filter`}.
- For reports or aggregated data, generate a SQL query that retrieves the necessary raw or aggregated data.
- If the user asks a question that can be answered from your general knowledge about the app's features, respond directly without using the tool.
- If you cannot fulfill a request with the available tools or information, politely inform the user.

EXAMPLE QUERIES:
${isSuperadmin ? 
  `1. To get all pending orders: SELECT * FROM orders WHERE status = 'pending';
2. To get top customers across all tenants: SELECT c.name, SUM(o.total_amount) as total_spent FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.name ORDER BY total_spent DESC LIMIT 5;
3. To get inventory levels for all tenants: SELECT p.name, li.quantity, t.name as tenant_name FROM products p JOIN location_inventory li ON p.id = li.product_id JOIN tenants t ON p.tenant_id = t.id;` : 
  `1. To get pending orders: SELECT * FROM orders WHERE tenant_id = '${tenantId}' AND status = 'pending';
2. To get top customers: SELECT c.name, SUM(o.total_amount) as total_spent FROM customers c JOIN orders o ON c.id = o.customer_id WHERE c.tenant_id = '${tenantId}' GROUP BY c.name ORDER BY total_spent DESC LIMIT 5;
3. To get inventory levels: SELECT p.name, li.quantity FROM products p JOIN location_inventory li ON p.id = li.product_id WHERE p.tenant_id = '${tenantId}';`}
`;
      
      // Include database query tool for internal staff
      tools = [databaseQueryTool];
    }

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      tools: tools,
      tool_choice: tools.length > 0 ? "auto" : "none",
    });

    const aiMessage = response.choices[0].message;
    const usage = response.usage; // Capture token usage

    // Check if the AI wants to call a function (only for internal staff)
    if (!isCustomerInteraction && aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      const toolCall = aiMessage.tool_calls[0];
      
      if (toolCall.function.name === "query_database") {
        const args = JSON.parse(toolCall.function.arguments);
        const { sql_query, description } = args;
        
        // Security check: Ensure the query includes tenant_id filtering if not superadmin
        if (!isSuperadmin) {
          const queryLower = sql_query.toLowerCase();
          if (!queryLower.includes(`tenant_id = '${tenantId}'`) && 
              !queryLower.includes(`tenant_id='${tenantId}'`) &&
              !queryLower.includes(`tenant_id="${tenantId}"`) &&
              !queryLower.includes(`tenant_id = "${tenantId}"`)) {
            throw new Error("Security violation: Query must include tenant_id filtering");
          }
        }
        
        // Execute the SQL query using the execute_sql function
        const { data: queryResult, error: queryError } = await supabaseClient.rpc(
          'execute_sql',
          { query_text: sql_query }
        );
        
        if (queryError) {
          throw new Error(`Database query error: ${queryError.message}`);
        }
        
        // Log the query for audit purposes
        await supabaseClient.from('user_activity_logs').insert({
          user_id: user.id,
          tenant_id: tenantId,
          action_type: 'chatbot_database_query',
          details: {
            query: sql_query,
            description: description
          }
        });
        
        // Ensure there's a natural language explanation
        let content = aiMessage.content;
        if (!content || content.trim() === '') {
          // If the AI didn't provide a natural language explanation, create a default one
          content = `I've queried the database to ${description.toLowerCase()}.`;
          
          // Check if the query result is empty
          if (!queryResult || queryResult.length === 0 || (Array.isArray(queryResult) && queryResult.length === 0)) {
            content += " There is no data available.";
          } else {
            content += " Here are the results:";
          }
        } else if (!queryResult || queryResult.length === 0 || (Array.isArray(queryResult) && queryResult.length === 0)) {
          // If there's already content but no data, append the no data message
          content += " There is no data available.";
        }
        
        // Return the query result along with the AI's explanation
        return new Response(
          JSON.stringify({
            type: "data",
            content: content,
            data: queryResult || [],
            query_description: description,
            raw_sql_query: sql_query,
            usage: usage // Include token usage in the response
          }),
          {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
    }
    
    // For customer interactions, check if this is an order request
    let responseType = "text";
    if (isCustomerInteraction && channel === 'whatsapp') {
      // Simple order detection - in a real implementation, you would use more sophisticated NLP
      const messageLower = message.toLowerCase();
      if (
        (messageLower.includes("order") || messageLower.includes("buy") || messageLower.includes("purchase")) &&
        customerId
      ) {
        // This is a potential order request
        // In a real implementation, you would parse the order details and create an order
        // For now, we'll just flag it as an order for demonstration
        responseType = "order_request";
      }
    }
    
    // If no function call, just return the AI's text response
    return new Response(
      JSON.stringify({
        type: responseType,
        content: aiMessage.content,
        usage: usage // Include token usage in the response
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (err) {
    console.error("Error:", err);
    
    return new Response(
      JSON.stringify({
        type: "error",
        content: err.message || "An error occurred",
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