import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import faker from 'faker';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Set seed for consistent data generation
faker.seed(123);

// Configuration
const NUM_TENANTS = 2;
const USERS_PER_TENANT = 5;
const CUSTOMERS_PER_TENANT = 10;
const PRODUCTS_PER_TENANT = 20;
const ORDERS_PER_TENANT = 15;
const LOCATIONS_PER_TENANT = 3;
const ROUTES_PER_TENANT = 2;
const VISITS_PER_TENANT = 10;
const DELIVERIES_PER_TENANT = 8;

// Store generated IDs for reference
const tenantIds = [];
const userIds = {};
const customerIds = {};
const productIds = {};
const locationIds = {};
const orderIds = {};
const routeIds = {};

// Helper function to generate a random date within the last 30 days
const randomRecentDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * 30));
  return date.toISOString();
};

// Helper function to generate a random future date within the next 30 days
const randomFutureDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + Math.floor(Math.random() * 30) + 1);
  return date.toISOString();
};

// Helper function to get a random item from an array
const getRandomItem = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

// Helper function to get a random number of items from an array
const getRandomItems = (array, min = 1, max = 3) => {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Seed tenants
async function seedTenants() {
  console.log('Seeding tenants...');
  
  const tenants = [];
  
  for (let i = 0; i < NUM_TENANTS; i++) {
    const tenantId = uuidv4();
    tenantIds.push(tenantId);
    
    tenants.push({
      id: tenantId,
      name: `${faker.company.companyName()} ${faker.company.companySuffix()}`,
      subscription_plan: getRandomItem(['basic', 'premium', 'enterprise']),
      max_users: 10
    });
  }
  
  const { error } = await supabase.from('tenants').insert(tenants);
  
  if (error) {
    console.error('Error seeding tenants:', error);
    return false;
  }
  
  console.log(`Created ${tenants.length} tenants`);
  return true;
}

// Seed tenant modules
async function seedTenantModules() {
  console.log('Seeding tenant modules...');
  
  const modules = [];
  
  for (const tenantId of tenantIds) {
    modules.push(
      {
        tenant_id: tenantId,
        module_name: 'presales_delivery',
        enabled: true
      },
      {
        tenant_id: tenantId,
        module_name: 'van_sales',
        enabled: true
      },
      {
        tenant_id: tenantId,
        module_name: 'wms',
        enabled: true
      }
    );
  }
  
  const { error } = await supabase.from('tenant_modules').insert(modules);
  
  if (error) {
    console.error('Error seeding tenant modules:', error);
    return false;
  }
  
  console.log(`Created ${modules.length} tenant modules`);
  return true;
}

// Seed users
async function seedUsers() {
  console.log('Seeding users...');
  
  for (const tenantId of tenantIds) {
    userIds[tenantId] = [];
    
    const roles = ['admin', 'sales', 'presales', 'delivery', 'warehouse'];
    
    for (let i = 0; i < USERS_PER_TENANT; i++) {
      const userId = uuidv4();
      userIds[tenantId].push(userId);
      
      // Create user profile
      const { error } = await supabase.from('profiles').insert({
        id: userId,
        tenant_id: tenantId,
        role: i === 0 ? 'admin' : getRandomItem(roles), // First user is always admin
        first_name: faker.name.firstName(),
        last_name: faker.name.lastName(),
        created_at: randomRecentDate()
      });
      
      if (error) {
        console.error('Error seeding users:', error);
        return false;
      }
    }
  }
  
  console.log(`Created ${USERS_PER_TENANT * tenantIds.length} users`);
  return true;
}

// Seed customers
async function seedCustomers() {
  console.log('Seeding customers...');
  
  for (const tenantId of tenantIds) {
    customerIds[tenantId] = [];
    
    const customers = [];
    
    for (let i = 0; i < CUSTOMERS_PER_TENANT; i++) {
      const customerId = uuidv4();
      customerIds[tenantId].push(customerId);
      
      customers.push({
        id: customerId,
        tenant_id: tenantId,
        name: faker.company.companyName(),
        email: faker.internet.email(),
        phone: faker.phone.phoneNumber(),
        address: `${faker.address.streetAddress()}, ${faker.address.city()}, ${faker.address.stateAbbr()} ${faker.address.zipCode()}`,
        created_at: randomRecentDate()
      });
    }
    
    const { error } = await supabase.from('customers').insert(customers);
    
    if (error) {
      console.error('Error seeding customers:', error);
      return false;
    }
  }
  
  console.log(`Created ${CUSTOMERS_PER_TENANT * tenantIds.length} customers`);
  return true;
}

// Seed products
async function seedProducts() {
  console.log('Seeding products...');
  
  for (const tenantId of tenantIds) {
    productIds[tenantId] = [];
    
    const products = [];
    const categories = ['Electronics', 'Food', 'Beverages', 'Clothing', 'Office Supplies'];
    const units = ['each', 'kg', 'box', 'pack', 'liter'];
    
    for (let i = 0; i < PRODUCTS_PER_TENANT; i++) {
      const productId = uuidv4();
      productIds[tenantId].push(productId);
      
      products.push({
        id: productId,
        tenant_id: tenantId,
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        price: parseFloat(faker.commerce.price(5, 500)),
        sku: faker.random.alphaNumeric(8).toUpperCase(),
        stock_quantity: faker.datatype.number({ min: 0, max: 1000 }),
        category: getRandomItem(categories),
        unit: getRandomItem(units),
        min_stock: faker.datatype.number({ min: 5, max: 20 }),
        max_stock: faker.datatype.number({ min: 100, max: 2000 }),
        created_at: randomRecentDate()
      });
    }
    
    const { error } = await supabase.from('products').insert(products);
    
    if (error) {
      console.error('Error seeding products:', error);
      return false;
    }
  }
  
  console.log(`Created ${PRODUCTS_PER_TENANT * tenantIds.length} products`);
  return true;
}

// Seed locations
async function seedLocations() {
  console.log('Seeding locations...');
  
  for (const tenantId of tenantIds) {
    locationIds[tenantId] = [];
    
    const locations = [];
    const locationTypes = ['warehouse', 'store', 'van'];
    
    for (let i = 0; i < LOCATIONS_PER_TENANT; i++) {
      const locationId = uuidv4();
      locationIds[tenantId].push(locationId);
      
      const locationType = i === 0 ? 'warehouse' : getRandomItem(locationTypes);
      
      locations.push({
        id: locationId,
        tenant_id: tenantId,
        name: locationType === 'warehouse' 
          ? `Main Warehouse ${i+1}` 
          : locationType === 'store' 
            ? `Store ${i+1}` 
            : `Delivery Van ${i+1}`,
        description: `${locationType.charAt(0).toUpperCase() + locationType.slice(1)} location for ${tenantId}`,
        location_type: locationType,
        address: `${faker.address.streetAddress()}, ${faker.address.city()}, ${faker.address.stateAbbr()} ${faker.address.zipCode()}`,
        is_active: true,
        created_at: randomRecentDate()
      });
    }
    
    const { error } = await supabase.from('locations').insert(locations);
    
    if (error) {
      console.error('Error seeding locations:', error);
      return false;
    }
  }
  
  console.log(`Created ${LOCATIONS_PER_TENANT * tenantIds.length} locations`);
  return true;
}

// Seed orders and order items
async function seedOrders() {
  console.log('Seeding orders...');
  
  for (const tenantId of tenantIds) {
    orderIds[tenantId] = [];
    
    for (let i = 0; i < ORDERS_PER_TENANT; i++) {
      const orderId = uuidv4();
      orderIds[tenantId].push(orderId);
      
      // Create order
      const customerId = getRandomItem(customerIds[tenantId]);
      const orderDate = randomRecentDate();
      const status = getRandomItem(['pending', 'completed', 'cancelled']);
      
      // Generate random order items
      const numItems = Math.floor(Math.random() * 5) + 1;
      const orderItems = [];
      let totalAmount = 0;
      
      const selectedProductIds = getRandomItems(productIds[tenantId], 1, 5);
      
      for (const productId of selectedProductIds) {
        const quantity = Math.floor(Math.random() * 10) + 1;
        const unitPrice = parseFloat(faker.commerce.price(5, 100));
        totalAmount += quantity * unitPrice;
        
        orderItems.push({
          id: uuidv4(),
          order_id: orderId,
          product_id: productId,
          quantity: quantity,
          unit_price: unitPrice,
          tenant_id: tenantId
        });
      }
      
      // Insert order
      const { error: orderError } = await supabase.from('orders').insert({
        id: orderId,
        tenant_id: tenantId,
        customer_id: customerId,
        order_date: orderDate,
        total_amount: totalAmount,
        status: status,
        created_at: orderDate
      });
      
      if (orderError) {
        console.error('Error seeding order:', orderError);
        return false;
      }
      
      // Insert order items
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      
      if (itemsError) {
        console.error('Error seeding order items:', itemsError);
        return false;
      }
    }
  }
  
  console.log(`Created ${ORDERS_PER_TENANT * tenantIds.length} orders with items`);
  return true;
}

// Seed routes
async function seedRoutes() {
  console.log('Seeding routes...');
  
  for (const tenantId of tenantIds) {
    routeIds[tenantId] = [];
    
    const routes = [];
    
    for (let i = 0; i < ROUTES_PER_TENANT; i++) {
      const routeId = uuidv4();
      routeIds[tenantId].push(routeId);
      
      routes.push({
        id: routeId,
        tenant_id: tenantId,
        name: `Route ${String.fromCharCode(65 + i)}`, // Route A, Route B, etc.
        description: `Delivery route ${i+1} for ${tenantId}`,
        type: getRandomItem(['delivery', 'sales', 'mixed']),
        created_at: randomRecentDate()
      });
    }
    
    const { error } = await supabase.from('routes').insert(routes);
    
    if (error) {
      console.error('Error seeding routes:', error);
      return false;
    }
  }
  
  console.log(`Created ${ROUTES_PER_TENANT * tenantIds.length} routes`);
  return true;
}

// Seed route customers
async function seedRouteCustomers() {
  console.log('Seeding route customers...');
  
  const routeCustomers = [];
  
  for (const tenantId of tenantIds) {
    for (const routeId of routeIds[tenantId]) {
      // Assign 3-5 customers to each route
      const customersForRoute = getRandomItems(customerIds[tenantId], 3, 5);
      
      customersForRoute.forEach((customerId, index) => {
        routeCustomers.push({
          id: uuidv4(),
          route_id: routeId,
          customer_id: customerId,
          sequence_number: index + 1,
          assigned_date: randomRecentDate(),
          notes: faker.lorem.sentence(),
          created_at: randomRecentDate()
        });
      });
    }
  }
  
  const { error } = await supabase.from('route_customers').insert(routeCustomers);
  
  if (error) {
    console.error('Error seeding route customers:', error);
    return false;
  }
  
  console.log(`Created ${routeCustomers.length} route customer assignments`);
  return true;
}

// Seed visits
async function seedVisits() {
  console.log('Seeding visits...');
  
  for (const tenantId of tenantIds) {
    const visits = [];
    
    for (let i = 0; i < VISITS_PER_TENANT; i++) {
      const customerId = getRandomItem(customerIds[tenantId]);
      const createdBy = getRandomItem(userIds[tenantId]);
      
      visits.push({
        id: uuidv4(),
        tenant_id: tenantId,
        customer_id: customerId,
        visit_date: randomRecentDate(),
        notes: faker.lorem.paragraph(),
        outcome: getRandomItem(['pending', 'successful', 'unsuccessful', 'rescheduled', 'cancelled']),
        created_by: createdBy,
        created_at: randomRecentDate(),
        latitude: parseFloat(faker.address.latitude()),
        longitude: parseFloat(faker.address.longitude())
      });
    }
    
    const { error } = await supabase.from('visits').insert(visits);
    
    if (error) {
      console.error('Error seeding visits:', error);
      return false;
    }
  }
  
  console.log(`Created ${VISITS_PER_TENANT * tenantIds.length} visits`);
  return true;
}

// Seed deliveries
async function seedDeliveries() {
  console.log('Seeding deliveries...');
  
  for (const tenantId of tenantIds) {
    const deliveries = [];
    
    // Get delivery staff (users with delivery role)
    const deliveryStaff = userIds[tenantId].slice(0, 2); // Just use the first 2 users for simplicity
    
    for (let i = 0; i < DELIVERIES_PER_TENANT; i++) {
      // Get a completed order to associate with this delivery
      const orderId = orderIds[tenantId][i % orderIds[tenantId].length];
      const staffId = getRandomItem(deliveryStaff);
      const routeId = getRandomItem(routeIds[tenantId]);
      
      deliveries.push({
        id: uuidv4(),
        order_id: orderId,
        tenant_id: tenantId,
        delivery_staff_id: staffId,
        route_id: routeId,
        tracking_number: `TRK${faker.datatype.number({ min: 10000, max: 99999 })}`,
        status: getRandomItem(['assigned', 'out_for_delivery', 'delivered', 'failed', 'cancelled']),
        estimated_delivery: randomFutureDate(),
        shipping_cost: parseFloat(faker.commerce.price(5, 50)),
        created_at: randomRecentDate(),
        route_number: `R${faker.datatype.number({ min: 100, max: 999 })}`,
        delivery_zone: `Zone ${faker.datatype.number({ min: 1, max: 5 })}`,
        latitude: parseFloat(faker.address.latitude()),
        longitude: parseFloat(faker.address.longitude())
      });
    }
    
    const { error } = await supabase.from('deliveries').insert(deliveries);
    
    if (error) {
      console.error('Error seeding deliveries:', error);
      return false;
    }
  }
  
  console.log(`Created ${DELIVERIES_PER_TENANT * tenantIds.length} deliveries`);
  return true;
}

// Seed inventory transactions
async function seedInventoryTransactions() {
  console.log('Seeding inventory transactions...');
  
  for (const tenantId of tenantIds) {
    const transactions = [];
    const transactionTypes = ['in', 'out', 'adjustment', 'transfer_in', 'transfer_out'];
    
    // Create 5 transactions per location
    for (const locationId of locationIds[tenantId]) {
      for (let i = 0; i < 5; i++) {
        const productId = getRandomItem(productIds[tenantId]);
        const performedBy = getRandomItem(userIds[tenantId]);
        const transactionType = getRandomItem(transactionTypes);
        
        transactions.push({
          id: uuidv4(),
          tenant_id: tenantId,
          product_id: productId,
          location_id: locationId,
          transaction_type: transactionType,
          quantity: faker.datatype.number({ min: 1, max: 100 }),
          notes: faker.lorem.sentence(),
          performed_by: performedBy,
          transaction_date: randomRecentDate(),
          created_at: randomRecentDate()
        });
      }
    }
    
    const { error } = await supabase.from('inventory_transactions').insert(transactions);
    
    if (error) {
      console.error('Error seeding inventory transactions:', error);
      return false;
    }
  }
  
  console.log(`Created inventory transactions`);
  return true;
}

// Seed location inventory
async function seedLocationInventory() {
  console.log('Seeding location inventory...');
  
  for (const tenantId of tenantIds) {
    const inventoryItems = [];
    
    // Create inventory for each location and product combination
    for (const locationId of locationIds[tenantId]) {
      for (const productId of productIds[tenantId]) {
        // Only create inventory for some products (70% chance)
        if (Math.random() < 0.7) {
          inventoryItems.push({
            id: uuidv4(),
            location_id: locationId,
            product_id: productId,
            quantity: faker.datatype.number({ min: 0, max: 1000 }),
            last_updated_at: randomRecentDate(),
            tenant_id: tenantId
          });
        }
      }
    }
    
    const { error } = await supabase.from('location_inventory').insert(inventoryItems);
    
    if (error) {
      console.error('Error seeding location inventory:', error);
      return false;
    }
  }
  
  console.log(`Created location inventory items`);
  return true;
}

// Seed van inventories
async function seedVanInventories() {
  console.log('Seeding van inventories...');
  
  for (const tenantId of tenantIds) {
    const vanInventories = [];
    
    // Get sales users
    const salesUsers = userIds[tenantId].slice(0, 2); // Just use the first 2 users for simplicity
    
    for (const userId of salesUsers) {
      // Add 5-10 products to each van
      const vanProducts = getRandomItems(productIds[tenantId], 5, 10);
      
      for (const productId of vanProducts) {
        vanInventories.push({
          id: uuidv4(),
          profile_id: userId,
          product_id: productId,
          quantity: faker.datatype.number({ min: 1, max: 50 }),
          last_updated_at: randomRecentDate()
        });
      }
    }
    
    const { error } = await supabase.from('van_inventories').insert(vanInventories);
    
    if (error) {
      console.error('Error seeding van inventories:', error);
      return false;
    }
  }
  
  console.log(`Created van inventory items`);
  return true;
}

// Main function to seed all data
async function seedDatabase() {
  console.log('Starting database seeding...');
  
  // Seed in the correct order to satisfy foreign key constraints
  const steps = [
    { name: 'Tenants', fn: seedTenants },
    { name: 'Tenant Modules', fn: seedTenantModules },
    { name: 'Users', fn: seedUsers },
    { name: 'Customers', fn: seedCustomers },
    { name: 'Products', fn: seedProducts },
    { name: 'Locations', fn: seedLocations },
    { name: 'Orders', fn: seedOrders },
    { name: 'Routes', fn: seedRoutes },
    { name: 'Route Customers', fn: seedRouteCustomers },
    { name: 'Visits', fn: seedVisits },
    { name: 'Deliveries', fn: seedDeliveries },
    { name: 'Inventory Transactions', fn: seedInventoryTransactions },
    { name: 'Location Inventory', fn: seedLocationInventory },
    { name: 'Van Inventories', fn: seedVanInventories }
  ];
  
  for (const step of steps) {
    console.log(`\n--- ${step.name} ---`);
    const success = await step.fn();
    if (!success) {
      console.error(`Failed to seed ${step.name}`);
      process.exit(1);
    }
  }
  
  console.log('\nDatabase seeding completed successfully!');
}

// Run the seeding process
seedDatabase().catch(error => {
  console.error('Error during database seeding:', error);
  process.exit(1);
});