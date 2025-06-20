import { useState, useEffect } from 'react';
import { Bell, X, CheckCircle, AlertTriangle, Clock, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Delivery, DeliveryNotice } from '../types/database';

export function DeliveryNotifications() {
  const [notifications, setNotifications] = useState<DeliveryNotice[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
    
    // Subscribe to real-time delivery updates
    const deliverySubscription = supabase
      .channel('delivery-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries'
        },
        (payload) => {
          handleDeliveryUpdate(payload.new as Delivery);
        }
      )
      .subscribe();

    // Subscribe to real-time delivery notice updates
    const noticeSubscription = supabase
      .channel('delivery-notices')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'delivery_notices'
        },
        (payload) => {
          handleNewDeliveryNotice(payload.new as DeliveryNotice);
        }
      )
      .subscribe();

    return () => {
      deliverySubscription.unsubscribe();
      noticeSubscription.unsubscribe();
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      // Fetch delivery notices from the database
      const { data, error } = await supabase
        .from('delivery_notices')
        .select(`
          *,
          delivery:deliveries (
            tracking_number,
            status
          ),
          created_by_profile:profiles!created_by (
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => n.status === 'unread').length || 0);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const handleDeliveryUpdate = (delivery: Delivery) => {
    // This function is kept for backward compatibility
    // It will create a synthetic notification for delivery status changes
    const newNotification: DeliveryNotice = {
      id: `auto-${delivery.id}-${Date.now()}`,
      delivery_id: delivery.id,
      tenant_id: delivery.tenant_id,
      title: `Delivery Status Updated`,
      message: `Delivery #${delivery.tracking_number} status updated to ${delivery.status}`,
      status: 'unread',
      priority: delivery.status === 'failed' ? 'high' : 'medium',
      created_at: new Date().toISOString(),
      created_by: 'system',
      delivery: {
        tracking_number: delivery.tracking_number,
        status: delivery.status
      }
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 19)]);
    setUnreadCount(prev => prev + 1);
  };

  const handleNewDeliveryNotice = (notice: DeliveryNotice) => {
    // Add the new notice to the notifications list
    setNotifications(prev => [notice, ...prev.slice(0, 19)]);
    
    // If the notice is unread, increment the unread count
    if (notice.status === 'unread') {
      setUnreadCount(prev => prev + 1);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      // Skip for auto-generated notifications (they don't exist in the database)
      if (notificationId.startsWith('auto-')) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, status: 'read' } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
        return;
      }

      // Update the notification status in the database
      const { error } = await supabase
        .from('delivery_notices')
        .update({ status: 'read' })
        .eq('id', notificationId);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, status: 'read' } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const getNotificationIcon = (notice: DeliveryNotice) => {
    if (notice.priority === 'high') {
      return AlertTriangle;
    } else if (notice.delivery?.status === 'delivered') {
      return CheckCircle;
    } else {
      return MessageSquare;
    }
  };

  const getNotificationColor = (notice: DeliveryNotice) => {
    switch (notice.priority) {
      case 'high':
        return 'text-red-600 bg-red-100';
      case 'medium':
        return 'text-blue-600 bg-blue-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No notifications yet
                </p>
              ) : (
                notifications.map((notice) => {
                  const Icon = getNotificationIcon(notice);
                  const colorClass = getNotificationColor(notice);
                  const isUnread = notice.status === 'unread';

                  return (
                    <div
                      key={notice.id}
                      className={`p-3 rounded-md border cursor-pointer transition-colors
                        ${isUnread 
                          ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' 
                          : 'bg-gray-50 border-gray-200'
                        }`}
                      onClick={() => markAsRead(notice.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-1.5 rounded-full ${colorClass.split(' ')[1]}`}>
                          <Icon className={`h-4 w-4 ${colorClass.split(' ')[0]}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${isUnread ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                            {notice.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {notice.message}
                          </p>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs text-gray-400">
                              {new Date(notice.created_at).toLocaleString()}
                            </span>
                            {notice.delivery && (
                              <span className="text-xs font-medium text-indigo-600">
                                #{notice.delivery.tracking_number}
                              </span>
                            )}
                          </div>
                        </div>
                        {isUnread && (
                          <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}