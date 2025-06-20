import { Clock, MapPin, CheckCircle, XCircle, AlertTriangle, User } from 'lucide-react';
import type { Delivery } from '../types/database';

interface DeliveryTimelineProps {
  delivery: Delivery & {
    staff?: {
      first_name: string;
      last_name: string;
    } | null;
  };
}

export function DeliveryTimeline({ delivery }: DeliveryTimelineProps) {
  const timelineEvents = [
    {
      id: 1,
      title: 'Delivery Assigned',
      description: delivery.staff ? 
        `Assigned to ${delivery.staff.first_name} ${delivery.staff.last_name}` : 
        'Delivery Assigned (Staff details unavailable)',
      timestamp: delivery.created_at,
      icon: User,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100',
      completed: true
    },
    {
      id: 2,
      title: 'Out for Delivery',
      description: 'Package is on its way',
      timestamp: delivery.status === 'out_for_delivery' || delivery.status === 'delivered' ? 
        new Date().toISOString() : null,
      icon: MapPin,
      iconColor: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      completed: delivery.status === 'out_for_delivery' || delivery.status === 'delivered'
    },
    {
      id: 3,
      title: 'Delivered',
      description: delivery.actual_delivery ? 
        `Delivered on ${new Date(delivery.actual_delivery).toLocaleString()}` : 
        `Expected by ${new Date(delivery.estimated_delivery).toLocaleString()}`,
      timestamp: delivery.actual_delivery,
      icon: CheckCircle,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-100',
      completed: delivery.status === 'delivered'
    }
  ];

  // Add failed/cancelled events if applicable
  if (delivery.status === 'failed') {
    timelineEvents.push({
      id: 4,
      title: 'Delivery Failed',
      description: delivery.delivery_notes || 'Delivery attempt failed',
      timestamp: new Date().toISOString(),
      icon: XCircle,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-100',
      completed: true
    });
  } else if (delivery.status === 'cancelled') {
    timelineEvents.push({
      id: 4,
      title: 'Delivery Cancelled',
      description: delivery.delivery_notes || 'Delivery was cancelled',
      timestamp: new Date().toISOString(),
      icon: AlertTriangle,
      iconColor: 'text-gray-600',
      bgColor: 'bg-gray-100',
      completed: true
    });
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Delivery Timeline - #{delivery.tracking_number}
      </h3>
      
      <div className="flow-root">
        <ul className="-mb-8">
          {timelineEvents.map((event, eventIdx) => {
            const Icon = event.icon;
            
            return (
              <li key={event.id}>
                <div className="relative pb-8">
                  {eventIdx !== timelineEvents.length - 1 ? (
                    <span
                      className={`absolute top-4 left-4 -ml-px h-full w-0.5 ${
                        event.completed ? 'bg-green-200' : 'bg-gray-200'
                      }`}
                      aria-hidden="true"
                    />
                  ) : null}
                  <div className="relative flex space-x-3">
                    <div>
                      <span
                        className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                          event.completed ? event.bgColor : 'bg-gray-100'
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 ${
                            event.completed ? event.iconColor : 'text-gray-400'
                          }`}
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                      <div>
                        <p className={`text-sm ${event.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                          {event.title}
                        </p>
                        <p className="text-sm text-gray-500">{event.description}</p>
                      </div>
                      <div className="text-right text-sm whitespace-nowrap text-gray-500">
                        {event.timestamp && (
                          <time dateTime={event.timestamp}>
                            {new Date(event.timestamp).toLocaleString()}
                          </time>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {delivery.delivery_notes && (
        <div className="mt-6 p-4 bg-gray-50 rounded-md">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Delivery Notes</h4>
          <p className="text-sm text-gray-600">{delivery.delivery_notes}</p>
        </div>
      )}
    </div>
  );
}