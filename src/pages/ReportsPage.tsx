import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Truck, Clock, Package, Users, BarChart3, TrendingUp,
  DollarSign, ShoppingBag, AlertTriangle, ArrowUpRight,
  ArrowDownRight, MapPin, Star, Calendar, PieChart, CheckCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  Order, Product, Customer, Invoice,
  Delivery, DeliveryMetrics, Profile, SalesMetrics
} from '../types/database';

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend,
  subtitle 
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center">
              {trend.isPositive ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(trend.value)}% from last period
              </span>
            </div>
          )}
        </div>
        <div className="p-3 bg-indigo-50 rounded-full">
          <Icon className="h-6 w-6 text-indigo-600" />
        </div>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { reportType } = useParams<{ reportType?: string }>();
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [salesMetrics, setSalesMetrics] = useState<SalesMetrics>({
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    revenueGrowth: 0,
    orderGrowth: 0,
    topSellingProducts: [],
    topCustomers: [],
    salesByCategory: [],
    revenueByMonth: [],
    salesByStatus: []
  });

  const [deliveryMetrics, setDeliveryMetrics] = useState<DeliveryMetrics>({
    totalDeliveries: 0,
    completedDeliveries: 0,
    averageDeliveryTime: 0,
    totalDeliveryCost: 0,
    deliveriesByStatus: [],
    staffPerformance: [],
    routePerformance: []
  });

  useEffect(() => {
    fetchReportData();
  }, [timeframe, reportType]);

  async function fetchReportData() {
    setIsLoading(true);
    setError(null);

    try {
      // Get date range based on timeframe
      const now = new Date();
      let startDate = new Date();
      let previousStartDate = new Date();
      
      if (timeframe === 'week') {
        startDate.setDate(now.getDate() - 7);
        previousStartDate.setDate(now.getDate() - 14);
      } else if (timeframe === 'month') {
        startDate.setMonth(now.getMonth() - 1);
        previousStartDate.setMonth(now.getMonth() - 2);
      } else {
        startDate.setFullYear(now.getFullYear() - 1);
        previousStartDate.setFullYear(now.getFullYear() - 2);
      }

      // Fetch data based on report type
      if (reportType === 'sales' || reportType === 'presales') {
        await fetchSalesData(startDate, previousStartDate, reportType);
      } else if (reportType === 'delivery') {
        await fetchDeliveryData(startDate);
      } else if (reportType === 'warehouse') {
        await fetchWarehouseData(startDate);
      } else {
        // Default to sales data if no specific report type
        await fetchSalesData(startDate, previousStartDate, 'sales');
      }

    } catch (err) {
      console.error('Error fetching report data:', err);
      setError('Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchSalesData(startDate: Date, previousStartDate: Date, type: string = 'sales') {
    // Fetch customers data separately
    const { data: customersData, error: customersError } = await supabase
      .from('customers')
      .select('id, name');

    if (customersError) throw customersError;

    // Create a map for customer lookup
    const customersMap = new Map();
    (customersData || []).forEach(customer => {
      customersMap.set(customer.id, customer.name);
    });

    // Fetch orders with related data
    let query = supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          unit_price,
          products (name, category)
        )
      `)
      .gte('created_at', startDate.toISOString());
    
    // Apply filters based on report type
    if (type === 'presales') {
      query = query.eq('status', 'pending');
    } else if (type === 'sales') {
      query = query.eq('status', 'completed');
    }

    const { data: ordersData, error: ordersError } = await query;

    if (ordersError) throw ordersError;

    // Fetch previous period orders for comparison
    let prevQuery = supabase
      .from('orders')
      .select('*')
      .gte('created_at', previousStartDate.toISOString())
      .lt('created_at', startDate.toISOString());
    
    // Apply filters based on report type
    if (type === 'presales') {
      prevQuery = prevQuery.eq('status', 'pending');
    } else if (type === 'sales') {
      prevQuery = prevQuery.eq('status', 'completed');
    }

    const { data: previousOrdersData, error: previousOrdersError } = await prevQuery;

    if (previousOrdersError) throw previousOrdersError;

    const orders = ordersData || [];
    const previousOrders = previousOrdersData || [];

    // Calculate metrics
    const totalRevenue = orders.reduce((sum, order) => sum + order.total_amount, 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const previousRevenue = previousOrders.reduce((sum, order) => sum + order.total_amount, 0);
    const previousOrderCount = previousOrders.length;

    const revenueGrowth = previousRevenue > 0 ? 
      ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const orderGrowth = previousOrderCount > 0 ? 
      ((totalOrders - previousOrderCount) / previousOrderCount) * 100 : 0;

    // Top selling products
    const productSales = new Map();
    orders.forEach(order => {
      order.order_items?.forEach(item => {
        const productId = item.products?.name || 'Unknown';
        const existing = productSales.get(productId) || {
          product_id: productId,
          product_name: item.products?.name || 'Unknown',
          total_quantity: 0,
          total_revenue: 0,
          orders_count: 0
        };
        existing.total_quantity += item.quantity;
        existing.total_revenue += item.quantity * item.unit_price;
        existing.orders_count += 1;
        productSales.set(productId, existing);
      });
    });

    const topSellingProducts = Array.from(productSales.values())
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 5);

    // Top customers - use the customers map for names
    const customerSales = new Map();
    orders.forEach(order => {
      const customerId = order.customer_id;
      const existing = customerSales.get(customerId) || {
        customer_id: customerId,
        customer_name: customersMap.get(customerId) || 'Unknown',
        total_orders: 0,
        total_spent: 0,
        last_order_date: order.created_at
      };
      existing.total_orders += 1;
      existing.total_spent += order.total_amount;
      if (new Date(order.created_at) > new Date(existing.last_order_date)) {
        existing.last_order_date = order.created_at;
      }
      customerSales.set(customerId, existing);
    });

    const topCustomers = Array.from(customerSales.values())
      .sort((a, b) => b.total_spent - a.total_spent)
      .slice(0, 5);

    // Sales by category
    const categorySales = new Map();
    orders.forEach(order => {
      order.order_items?.forEach(item => {
        const category = item.products?.category || 'Uncategorized';
        const existing = categorySales.get(category) || {
          category,
          total_revenue: 0,
          total_quantity: 0,
          orders_count: 0
        };
        existing.total_revenue += item.quantity * item.unit_price;
        existing.total_quantity += item.quantity;
        existing.orders_count += 1;
        categorySales.set(category, existing);
      });
    });

    const salesByCategory = Array.from(categorySales.values())
      .sort((a, b) => b.total_revenue - a.total_revenue);

    // Revenue by month (last 6 months)
    const monthlyRevenue = new Map();
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return date.toISOString().slice(0, 7); // YYYY-MM format
    }).reverse();

    last6Months.forEach(month => {
      monthlyRevenue.set(month, { month, revenue: 0, orders: 0 });
    });

    orders.forEach(order => {
      const month = order.created_at.slice(0, 7);
      if (monthlyRevenue.has(month)) {
        const existing = monthlyRevenue.get(month);
        existing.revenue += order.total_amount;
        existing.orders += 1;
      }
    });

    const revenueByMonth = Array.from(monthlyRevenue.values());

    // Sales by status
    const statusCounts = new Map();
    orders.forEach(order => {
      const status = order.status;
      const existing = statusCounts.get(status) || { status, count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += order.total_amount;
      statusCounts.set(status, existing);
    });

    const salesByStatus = Array.from(statusCounts.values());

    setSalesMetrics({
      totalRevenue,
      totalOrders,
      averageOrderValue,
      revenueGrowth,
      orderGrowth,
      topSellingProducts,
      topCustomers,
      salesByCategory,
      revenueByMonth,
      salesByStatus
    });
  }

  async function fetchDeliveryData(startDate: Date) {
    const { data: deliveriesData, error: deliveriesError } = await supabase
      .from('deliveries')
      .select(`
        *,
        staff:profiles!delivery_staff_id (
          first_name,
          last_name
        )
      `)
      .gte('created_at', startDate.toISOString());

    if (deliveriesError) throw deliveriesError;
    const deliveries = deliveriesData || [];

    const completedDeliveries = deliveries.filter(d => d.status === 'delivered');
    
    const staffPerformance = Object.values(
      deliveries.reduce((acc, delivery) => {
        const staffId = delivery.delivery_staff_id;
        if (!staffId || !delivery.staff) return acc;
        
        if (!acc[staffId]) {
          acc[staffId] = {
            staff_id: staffId,
            name: `${delivery.staff.first_name} ${delivery.staff.last_name}`,
            deliveries: 0,
            onTimeDeliveries: 0,
            totalTime: 0,
            completedDeliveries: 0
          };
        }
        
        acc[staffId].deliveries++;
        
        if (delivery.status === 'delivered') {
          acc[staffId].completedDeliveries++;
          if (delivery.actual_delivery && delivery.estimated_delivery) {
            const onTime = new Date(delivery.actual_delivery) <= new Date(delivery.estimated_delivery);
            if (onTime) acc[staffId].onTimeDeliveries++;
            
            const deliveryTime = new Date(delivery.actual_delivery).getTime() - 
                               new Date(delivery.created_at).getTime();
            acc[staffId].totalTime += deliveryTime;
          }
        }
        
        return acc;
      }, {} as Record<string, any>)
    ).map(staff => ({
      staff_id: staff.staff_id,
      name: staff.name,
      deliveries: staff.deliveries,
      onTimeRate: staff.completedDeliveries ? 
        (staff.onTimeDeliveries / staff.completedDeliveries) * 100 : 0,
      averageTime: staff.completedDeliveries ? 
        staff.totalTime / (staff.completedDeliveries * 86400000) : 0
    }));

    const routePerformance = Object.values(
      deliveries.reduce((acc, delivery) => {
        const route = delivery.route_number || 'Unknown';
        if (!acc[route]) {
          acc[route] = {
            route,
            deliveries: 0,
            totalTime: 0,
            completedDeliveries: 0
          };
        }
        
        acc[route].deliveries++;
        
        if (delivery.status === 'delivered' && delivery.actual_delivery) {
          acc[route].completedDeliveries++;
          const deliveryTime = new Date(delivery.actual_delivery).getTime() - 
                             new Date(delivery.created_at).getTime();
          acc[route].totalTime += deliveryTime;
        }
        
        return acc;
      }, {} as Record<string, any>)
    ).map(route => ({
      route: route.route,
      deliveries: route.deliveries,
      averageTime: route.completedDeliveries ? 
        route.totalTime / (route.completedDeliveries * 86400000) : 0
    }));

    setDeliveryMetrics({
      totalDeliveries: deliveries.length,
      completedDeliveries: completedDeliveries.length,
      averageDeliveryTime: completedDeliveries.length ? 
        completedDeliveries.reduce((sum, d) => 
          sum + (new Date(d.actual_delivery!).getTime() - new Date(d.created_at).getTime()), 
          0) / (completedDeliveries.length * 86400000) : 0,
      totalDeliveryCost: deliveries.reduce((sum, d) => sum + d.shipping_cost, 0),
      deliveriesByStatus: Object.entries(
        deliveries.reduce((acc, d) => {
          acc[d.status] = (acc[d.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([status, count]) => ({ status: status as Delivery['status'], count })),
      staffPerformance,
      routePerformance
    });
  }

  async function fetchWarehouseData(startDate: Date) {
    // This would be implemented to fetch warehouse-specific metrics
    // For now, we'll just set some default sales metrics
    setSalesMetrics({
      totalRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      revenueGrowth: 0,
      orderGrowth: 0,
      topSellingProducts: [],
      topCustomers: [],
      salesByCategory: [],
      revenueByMonth: [],
      salesByStatus: []
    });
  }

  const getReportTitle = () => {
    switch (reportType) {
      case 'presales':
        return 'Presales Reports';
      case 'sales':
        return 'Sales Reports';
      case 'delivery':
        return 'Delivery Reports';
      case 'warehouse':
        return 'Warehouse Reports';
      default:
        return 'Reports & Analytics';
    }
  };

  const getReportDescription = () => {
    switch (reportType) {
      case 'presales':
        return 'Comprehensive insights into presales activities and performance';
      case 'sales':
        return 'Sales performance metrics and customer insights';
      case 'delivery':
        return 'Delivery operations performance and staff metrics';
      case 'warehouse':
        return 'Warehouse inventory and operations analytics';
      default:
        return 'Comprehensive insights into business performance';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{getReportTitle()}</h1>
          <p className="mt-2 text-sm text-gray-700">
            {getReportDescription()}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-4">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as typeof timeframe)}
            className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="year">Last Year</option>
          </select>
        </div>
      </div>

      {/* Report Content based on type */}
      {(reportType === 'sales' || reportType === 'presales') && (
        <div className="space-y-6">
          {/* Sales Overview Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Revenue"
              value={`$${salesMetrics.totalRevenue.toLocaleString()}`}
              icon={DollarSign}
              trend={{ value: salesMetrics.revenueGrowth, isPositive: salesMetrics.revenueGrowth >= 0 }}
            />
            <StatCard
              title="Total Orders"
              value={salesMetrics.totalOrders.toLocaleString()}
              icon={ShoppingBag}
              trend={{ value: salesMetrics.orderGrowth, isPositive: salesMetrics.orderGrowth >= 0 }}
            />
            <StatCard
              title="Average Order Value"
              value={`$${salesMetrics.averageOrderValue.toFixed(2)}`}
              icon={BarChart3}
            />
            <StatCard
              title="Conversion Rate"
              value="85.2%"
              icon={TrendingUp}
              trend={{ value: 3.2, isPositive: true }}
            />
          </div>

          {/* Revenue Chart and Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue Trend</h3>
              <div className="space-y-3">
                {salesMetrics.revenueByMonth.map((month, index) => (
                  <div key={month.month} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {new Date(month.month + '-01').toLocaleDateString('en-US', { 
                        month: 'short', 
                        year: 'numeric' 
                      })}
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{ 
                            width: `${Math.max(10, (month.revenue / Math.max(...salesMetrics.revenueByMonth.map(m => m.revenue))) * 100)}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        ${month.revenue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Top Selling Products</h3>
              <div className="space-y-3">
                {salesMetrics.topSellingProducts.map((product, index) => (
                  <div key={product.product_id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {product.product_name}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        ${product.total_revenue.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {product.total_quantity} units
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Customers and Sales by Category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Top Customers</h3>
              <div className="space-y-4">
                {salesMetrics.topCustomers.map((customer, index) => (
                  <div key={customer.customer_id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {customer.customer_name.charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {customer.customer_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {customer.total_orders} orders
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        ${customer.total_spent.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        Last: {new Date(customer.last_order_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Sales by Category</h3>
              <div className="space-y-3">
                {salesMetrics.salesByCategory.map((category) => (
                  <div key={category.category} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {category.category}
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full"
                          style={{ 
                            width: `${Math.max(10, (category.total_revenue / Math.max(...salesMetrics.salesByCategory.map(c => c.total_revenue))) * 100)}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        ${category.total_revenue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === 'delivery' && (
        <div className="space-y-6">
          {/* Delivery Overview Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Completion Rate"
              value={`${((deliveryMetrics.completedDeliveries / deliveryMetrics.totalDeliveries) * 100).toFixed(1)}%`}
              icon={CheckCircle}
              subtitle={`${deliveryMetrics.completedDeliveries} of ${deliveryMetrics.totalDeliveries} deliveries`}
            />
            <StatCard
              title="Average Delivery Time"
              value={`${deliveryMetrics.averageDeliveryTime.toFixed(1)} days`}
              icon={Clock}
              subtitle="From assignment to completion"
            />
            <StatCard
              title="Active Deliveries"
              value={deliveryMetrics.deliveriesByStatus.find(s => s.status === 'out_for_delivery')?.count || 0}
              icon={Truck}
              subtitle="Currently out for delivery"
            />
            <StatCard
              title="Failed Deliveries"
              value={deliveryMetrics.deliveriesByStatus.find(s => s.status === 'failed')?.count || 0}
              icon={AlertTriangle}
              subtitle="Requiring attention"
            />
          </div>

          {/* Staff Performance and Route Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Staff Performance</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className="text-left text-sm font-medium text-gray-500">Staff Member</th>
                      <th className="text-right text-sm font-medium text-gray-500">Deliveries</th>
                      <th className="text-right text-sm font-medium text-gray-500">On-Time Rate</th>
                      <th className="text-right text-sm font-medium text-gray-500">Avg. Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryMetrics.staffPerformance.map((staff) => (
                      <tr key={staff.staff_id}>
                        <td className="py-2 text-sm text-gray-900">{staff.name}</td>
                        <td className="py-2 text-right text-sm text-gray-900">{staff.deliveries}</td>
                        <td className="py-2 text-right text-sm">
                          <span className={staff.onTimeRate >= 90 ? 'text-green-600' : 
                                        staff.onTimeRate >= 75 ? 'text-yellow-600' : 'text-red-600'}>
                            {staff.onTimeRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2 text-right text-sm text-gray-900">
                          {staff.averageTime.toFixed(1)} days
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Route Performance</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className="text-left text-sm font-medium text-gray-500">Route</th>
                      <th className="text-right text-sm font-medium text-gray-500">Deliveries</th>
                      <th className="text-right text-sm font-medium text-gray-500">Avg. Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryMetrics.routePerformance.map((route) => (
                      <tr key={route.route}>
                        <td className="py-2 text-sm text-gray-900">{route.route}</td>
                        <td className="py-2 text-right text-sm text-gray-900">{route.deliveries}</td>
                        <td className="py-2 text-right text-sm text-gray-900">
                          {route.averageTime.toFixed(1)} days
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === 'warehouse' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Warehouse Reports</h3>
            <p className="text-gray-500">
              Detailed warehouse reports will be implemented in a future update.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}