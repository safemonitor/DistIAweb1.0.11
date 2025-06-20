import { useState } from 'react';
import { Search, Package, Truck, MapPin, Calendar } from 'lucide-react';

interface TrackingResult {
  tracking_number: string;
  status: string;
  estimated_delivery: string;
  actual_delivery: string | null;
  delivery_staff: string;
  route_number: string;
  delivery_zone: string;
  delivery_notes: string;
  created_at: string;
}

export function DeliveryTrackingPage() {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackingResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-delivery?tracking=${trackingNumber}`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to track delivery');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to track delivery');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center">
          <Package className="mx-auto h-12 w-12 text-indigo-600" />
          <h1 className="mt-3 text-3xl font-extrabold text-gray-900">
            Track Your Delivery
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter your tracking number to get real-time delivery updates
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8">
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="tracking" className="sr-only">
                Tracking Number
              </label>
              <input
                type="text"
                id="tracking"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter tracking number"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <Search className="h-5 w-5 mr-2" />
                  Track
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-8 bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900">
                Tracking Details
              </h3>

              <div className="mt-6 border-t border-gray-200 pt-6">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Status</dt>
                    <dd className="mt-1">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-sm font-medium
                        ${result.status === 'delivered' ? 'bg-green-50 text-green-700' :
                          result.status === 'out_for_delivery' ? 'bg-blue-50 text-blue-700' :
                          result.status === 'failed' ? 'bg-red-50 text-red-700' :
                          result.status === 'cancelled' ? 'bg-gray-50 text-gray-700' :
                          'bg-yellow-50 text-yellow-700'}`}>
                        {result.status.replace(/_/g, ' ')}
                      </span>
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">Tracking Number</dt>
                    <dd className="mt-1 text-sm text-gray-900">{result.tracking_number}</dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">Delivery Staff</dt>
                    <dd className="mt-1 text-sm text-gray-900">{result.delivery_staff}</dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">Route Number</dt>
                    <dd className="mt-1 text-sm text-gray-900">{result.route_number}</dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">Estimated Delivery</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(result.estimated_delivery).toLocaleString()}
                    </dd>
                  </div>

                  {result.actual_delivery && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Actual Delivery</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {new Date(result.actual_delivery).toLocaleString()}
                      </dd>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Delivery Zone</dt>
                    <dd className="mt-1 text-sm text-gray-900">{result.delivery_zone}</dd>
                  </div>

                  {result.delivery_notes && (
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Delivery Notes</dt>
                      <dd className="mt-1 text-sm text-gray-900">{result.delivery_notes}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}