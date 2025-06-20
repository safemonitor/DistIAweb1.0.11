import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, ShoppingCart, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface VanSalesMetricsData {
  todaysSales: number;
  todaysRevenue: number;
  weeklyRevenue: number;
  totalInventoryValue: number;
}

export function VanSalesMetrics() {
  const [metrics, setMetrics] = useState<VanSalesMetricsData>({
    todaysSales: 0,
    todaysRevenue: 0,
    weeklyRevenue: 0,
    totalInventoryValue: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  async function fetchMetrics() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get today's sales movements
      const { data: todayMovements } = await supabase
        .from('van_stock_movements')
        .select(`
          *,
          product:products (price)
        `)
        .eq('profile_id', user.id)
        .eq('movement_type', 'sale')
        .gte('created_at', startOfDay.toISOString());

      // Get weekly sales movements
      const { data: weeklyMovements } = await supabase
        .from('van_stock_movements')
        .select(`
          *,
          product:products (price)
        `)
        .eq('profile_id', user.id)
        .eq('movement_type', 'sale')
        .gte('created_at', startOfWeek.toISOString());

      // Get current van inventory
      const { data: inventory } = await supabase
        .from('van_inventories')
        .select(`
          *,
          product:products (price)
        `)
        .eq('profile_id', user.id);

      const todaysSales = todayMovements?.length || 0;
      const todaysRevenue = todayMovements?.reduce((sum, movement) => 
        sum + (Math.abs(movement.quantity) * (movement.product?.price || 0)), 0) || 0;
      
      const weeklyRevenue = weeklyMovements?.reduce((sum, movement) => 
        sum + (Math.abs(movement.quantity) * (movement.product?.price || 0)), 0) || 0;
      
      const totalInventoryValue = inventory?.reduce((sum, item) => 
        sum + (item.quantity * (item.product?.price || 0)), 0) || 0;

      setMetrics({
        todaysSales,
        todaysRevenue,
        weeklyRevenue,
        totalInventoryValue
      });
    } catch (err) {
      console.error('Error fetching van sales metrics:', err);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Van Sales Performance</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-3">
            <ShoppingCart className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-2xl font-semibold text-gray-900">{metrics.todaysSales}</div>
          <div className="text-sm text-gray-600">Today's Sales</div>
        </div>

        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
            <DollarSign className="h-6 w-6 text-green-600" />
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            ${metrics.todaysRevenue.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">Today's Revenue</div>
        </div>

        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 mb-3">
            <TrendingUp className="h-6 w-6 text-purple-600" />
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            ${metrics.weeklyRevenue.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">Weekly Revenue</div>
        </div>

        <div className="text-center p-4 bg-orange-50 rounded-lg">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 mb-3">
            <Package className="h-6 w-6 text-orange-600" />
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            ${metrics.totalInventoryValue.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">Inventory Value</div>
        </div>
      </div>
    </div>
  );
}