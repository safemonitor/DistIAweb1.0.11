import { useState, useEffect } from 'react';
import { 
  Megaphone, 
  MessageSquare, 
  BarChart3, 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  Image,
  Users,
  Plus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { Bar, Line } from 'react-chartjs-2';
import type { Campaign, MarketingMetrics, Order } from '../types/database';

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

export function MarketingDashboardPage() {
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MarketingMetrics>({
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalMessagesSent: 0,
    totalOrdersFromWhatsApp: 0,
    revenueFromWhatsApp: 0,
    campaignPerformance: [],
    whatsAppActivity: [],
    topPerformingContent: []
  });
  const [recentCampaigns, setRecentCampaigns] = useState<Campaign[]>([]);
  const [whatsAppOrders, setWhatsAppOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetchMarketingData();
  }, [timeframe]);

  async function fetchMarketingData() {
    try {
      setIsLoading(true);
      setError(null);

      // Get date range based on timeframe
      const now = new Date();
      let startDate = new Date();
      
      if (timeframe === 'week') {
        startDate.setDate(now.getDate() - 7);
      } else if (timeframe === 'month') {
        startDate.setMonth(now.getMonth() - 1);
      } else {
        startDate.setFullYear(now.getFullYear() - 1);
      }

      // Fetch campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (campaignsError) throw campaignsError;

      // Fetch WhatsApp messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (messagesError) throw messagesError;

      // Fetch WhatsApp orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers (
            name,
            phone
          )
        `)
        .eq('source', 'whatsapp')
        .order('created_at', { ascending: false })
        .limit(5);

      if (ordersError) throw ordersError;

      // Fetch campaign metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('campaign_metrics')
        .select(`
          *,
          campaign:campaigns (
            name
          )
        `)
        .gte('metric_date', startDate.toISOString().split('T')[0]);

      if (metricsError) throw metricsError;

      // Calculate metrics
      const totalCampaigns = campaignsData?.length || 0;
      const activeCampaigns = campaignsData?.filter(c => c.status === 'active').length || 0;
      const totalMessagesSent = messagesData?.filter(m => m.direction === 'outbound').length || 0;
      const totalOrdersFromWhatsApp = ordersData?.length || 0;
      const revenueFromWhatsApp = ordersData?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

      // Generate campaign performance data
      const campaignPerformance = metricsData?.reduce((acc: any[], metric) => {
        const existingCampaign = acc.find(c => c.campaign_id === metric.campaign_id);
        
        if (existingCampaign) {
          existingCampaign.messages_sent += metric.messages_sent;
          existingCampaign.response_rate = (metric.responses_received / metric.messages_sent) * 100 || 0;
          existingCampaign.conversion_rate = (metric.orders_placed / metric.messages_sent) * 100 || 0;
          existingCampaign.revenue += metric.revenue_generated;
        } else {
          acc.push({
            campaign_id: metric.campaign_id,
            campaign_name: metric.campaign?.name || 'Unknown Campaign',
            messages_sent: metric.messages_sent,
            response_rate: (metric.responses_received / metric.messages_sent) * 100 || 0,
            conversion_rate: (metric.orders_placed / metric.messages_sent) * 100 || 0,
            revenue: metric.revenue_generated
          });
        }
        
        return acc;
      }, []) || [];

      // Generate WhatsApp activity data (by day)
      const whatsAppActivity: { date: string; messages_sent: number; messages_received: number; orders_placed: number }[] = [];
      
      // Create a map of dates for the selected timeframe
      const dateMap = new Map();
      let currentDate = new Date(startDate);
      while (currentDate <= now) {
        const dateStr = currentDate.toISOString().split('T')[0];
        dateMap.set(dateStr, {
          date: dateStr,
          messages_sent: 0,
          messages_received: 0,
          orders_placed: 0
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Populate message counts
      messagesData?.forEach(message => {
        const dateStr = new Date(message.created_at).toISOString().split('T')[0];
        if (dateMap.has(dateStr)) {
          const dayData = dateMap.get(dateStr);
          if (message.direction === 'outbound') {
            dayData.messages_sent++;
          } else {
            dayData.messages_received++;
          }
          dateMap.set(dateStr, dayData);
        }
      });
      
      // Populate order counts
      ordersData?.forEach(order => {
        const dateStr = new Date(order.created_at).toISOString().split('T')[0];
        if (dateMap.has(dateStr)) {
          const dayData = dateMap.get(dateStr);
          dayData.orders_placed++;
          dateMap.set(dateStr, dayData);
        }
      });
      
      // Convert map to array and sort by date
      dateMap.forEach(value => {
        whatsAppActivity.push(value);
      });
      whatsAppActivity.sort((a, b) => a.date.localeCompare(b.date));

      // Set state
      setMetrics({
        totalCampaigns,
        activeCampaigns,
        totalMessagesSent,
        totalOrdersFromWhatsApp,
        revenueFromWhatsApp,
        campaignPerformance,
        whatsAppActivity,
        topPerformingContent: [] // This would require more complex analysis
      });
      
      setRecentCampaigns(campaignsData?.slice(0, 5) || []);
      setWhatsAppOrders(ordersData || []);
    } catch (err) {
      console.error('Error fetching marketing data:', err);
      setError('Failed to load marketing data');
    } finally {
      setIsLoading(false);
    }
  }

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
          <h1 className="text-2xl font-semibold text-gray-900">Marketing Dashboard</h1>
          <p className="mt-2 text-sm text-gray-700">
            Monitor campaign performance and WhatsApp engagement
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
          
          <Link
            to="/marketing/campaigns"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Campaigns"
          value={metrics.totalCampaigns}
          icon={Megaphone}
        />
        <StatCard
          title="Active Campaigns"
          value={metrics.activeCampaigns}
          icon={Calendar}
          trend={{ value: 10, isPositive: true }}
        />
        <StatCard
          title="WhatsApp Messages"
          value={metrics.totalMessagesSent}
          icon={MessageSquare}
          subtitle="Total sent messages"
        />
        <StatCard
          title="WhatsApp Orders"
          value={metrics.totalOrdersFromWhatsApp}
          icon={ShoppingBag}
          trend={{ value: 15, isPositive: true }}
        />
        <StatCard
          title="Revenue from WhatsApp"
          value={`$${metrics.revenueFromWhatsApp.toFixed(2)}`}
          icon={DollarSign}
          trend={{ value: 8, isPositive: true }}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WhatsApp Activity Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">WhatsApp Activity</h3>
          <div className="h-80">
            {metrics.whatsAppActivity.length > 0 ? (
              <Line
                data={{
                  labels: metrics.whatsAppActivity.map(day => {
                    const date = new Date(day.date);
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }),
                  datasets: [
                    {
                      label: 'Messages Sent',
                      data: metrics.whatsAppActivity.map(day => day.messages_sent),
                      borderColor: 'rgba(99, 102, 241, 1)',
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      tension: 0.4,
                    },
                    {
                      label: 'Messages Received',
                      data: metrics.whatsAppActivity.map(day => day.messages_received),
                      borderColor: 'rgba(16, 185, 129, 1)',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      tension: 0.4,
                    },
                    {
                      label: 'Orders Placed',
                      data: metrics.whatsAppActivity.map(day => day.orders_placed),
                      borderColor: 'rgba(245, 158, 11, 1)',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      tension: 0.4,
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true
                    }
                  }
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No activity data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Campaign Performance Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Campaign Performance</h3>
          <div className="h-80">
            {metrics.campaignPerformance.length > 0 ? (
              <Bar
                data={{
                  labels: metrics.campaignPerformance.map(campaign => campaign.campaign_name),
                  datasets: [
                    {
                      label: 'Messages Sent',
                      data: metrics.campaignPerformance.map(campaign => campaign.messages_sent),
                      backgroundColor: 'rgba(99, 102, 241, 0.6)',
                    },
                    {
                      label: 'Conversion Rate (%)',
                      data: metrics.campaignPerformance.map(campaign => campaign.conversion_rate),
                      backgroundColor: 'rgba(16, 185, 129, 0.6)',
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true
                    }
                  }
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No campaign performance data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Campaigns and WhatsApp Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Campaigns */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Recent Campaigns</h3>
            <Link
              to="/marketing/campaigns"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {recentCampaigns.length === 0 ? (
              <div className="px-6 py-4 text-center text-sm text-gray-500">
                No campaigns found. Create your first campaign to get started.
              </div>
            ) : (
              recentCampaigns.map((campaign) => (
                <div key={campaign.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Megaphone className="h-10 w-10 text-indigo-600 p-2 bg-indigo-100 rounded-full" />
                    </div>
                    <div className="ml-4">
                      <h4 className="text-sm font-medium text-gray-900">{campaign.name}</h4>
                      <div className="flex items-center mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          campaign.status === 'active' ? 'bg-green-100 text-green-800' :
                          campaign.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                          campaign.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          campaign.status === 'paused' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {campaign.status}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          {new Date(campaign.start_date).toLocaleDateString()}
                          {campaign.end_date && ` - ${new Date(campaign.end_date).toLocaleDateString()}`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Link
                    to={`/marketing/campaigns?id=${campaign.id}`}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    View
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent WhatsApp Orders */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Recent WhatsApp Orders</h3>
            <Link
              to="/marketing/whatsapp-orders"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {whatsAppOrders.length === 0 ? (
              <div className="px-6 py-4 text-center text-sm text-gray-500">
                No WhatsApp orders found yet.
              </div>
            ) : (
              whatsAppOrders.map((order) => (
                <div key={order.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <MessageSquare className="h-10 w-10 text-green-600 p-2 bg-green-100 rounded-full" />
                    </div>
                    <div className="ml-4">
                      <h4 className="text-sm font-medium text-gray-900">
                        Order #{order.id.substring(0, 8)}
                      </h4>
                      <div className="flex items-center mt-1">
                        <span className="text-xs text-gray-500">
                          {order.customer?.name} • {order.customer?.phone}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          {new Date(order.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      ${order.total_amount.toFixed(2)}
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      order.status === 'completed' ? 'bg-green-100 text-green-800' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/marketing/campaigns"
            className="flex items-center justify-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Megaphone className="h-5 w-5 mr-2 text-indigo-600" />
            <span className="text-sm font-medium text-gray-900">Create Campaign</span>
          </Link>
          <Link
            to="/marketing/content"
            className="flex items-center justify-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Image className="h-5 w-5 mr-2 text-indigo-600" />
            <span className="text-sm font-medium text-gray-900">Manage Content</span>
          </Link>
          <Link
            to="/marketing/whatsapp-orders"
            className="flex items-center justify-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <MessageSquare className="h-5 w-5 mr-2 text-indigo-600" />
            <span className="text-sm font-medium text-gray-900">View WhatsApp Orders</span>
          </Link>
          <Link
            to="/customers"
            className="flex items-center justify-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Users className="h-5 w-5 mr-2 text-indigo-600" />
            <span className="text-sm font-medium text-gray-900">Manage Customers</span>
          </Link>
        </div>
      </div>
    </div>
  );
}