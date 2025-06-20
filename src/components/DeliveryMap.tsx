import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLogger';
import type { Delivery } from '../types/database';

interface DeliveryMapProps {
  deliveries: Delivery[];
  onDeliverySelect?: (delivery: Delivery) => void;
}

export function DeliveryMap({ deliveries, onDeliverySelect }: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initializeMap() {
      try {
        setIsLoading(true);
        setError(null);

        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.access_token) {
          throw new Error('Not authenticated');
        }

        logActivity('map_initialization_started', {
          timestamp: new Date().toISOString()
        });

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-maps-key`,
          {
            headers: {
              Authorization: `Bearer ${session.session.access_token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to get API key: ${response.status} ${response.statusText}`);
        }

        const { apiKey } = await response.json();
        
        // Validate API key
        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
          throw new Error('Google Maps API key is missing or invalid');
        }

        logActivity('map_api_key_retrieved', {
          timestamp: new Date().toISOString(),
          success: true
        });

        const loader = new Loader({
          apiKey,
          version: 'weekly',
          libraries: ['places']
        });

        await loader.load();

        // Ensure Google Maps API is fully loaded
        if (!window.google || !window.google.maps || !window.google.maps.Map) {
          throw new Error('Google Maps API failed to load properly');
        }

        logActivity('google_maps_api_loaded', {
          timestamp: new Date().toISOString(),
          success: true
        });

        if (mapRef.current && !map) {
          const newMap = new window.google.maps.Map(mapRef.current, {
            center: { lat: 0, lng: 0 },
            zoom: 2,
            styles: [
              {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
              }
            ]
          });
          setMap(newMap);
          
          logActivity('map_instance_created', {
            timestamp: new Date().toISOString(),
            success: true
          });
        }
      } catch (err) {
        console.error('Error initializing map:', err);
        setError(err instanceof Error ? err.message : 'Failed to load map');
        
        logActivity('map_initialization_error', {
          error: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : 'No stack trace',
          timestamp: new Date().toISOString()
        });
      } finally {
        setIsLoading(false);
      }
    }

    initializeMap();

    return () => {
      markers.forEach(marker => marker.setMap(null));
      setMarkers([]);
    };
  }, []);

  useEffect(() => {
    if (!map || !window.google || !window.google.maps) return;

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    const newMarkers: google.maps.Marker[] = [];

    // Create bounds to fit all markers
    const bounds = new window.google.maps.LatLngBounds();
    let hasValidDeliveries = false;

    try {
      logActivity('map_markers_update_started', {
        delivery_count: deliveries.length,
        timestamp: new Date().toISOString()
      });

      deliveries.forEach(delivery => {
        if (delivery.latitude && delivery.longitude) {
          hasValidDeliveries = true;
          const position = { lat: delivery.latitude, lng: delivery.longitude };
          const marker = new window.google.maps.Marker({
            position,
            map,
            title: `Delivery #${delivery.tracking_number}`,
            icon: {
              url: getMarkerIcon(delivery.status),
              scaledSize: new window.google.maps.Size(30, 30)
            }
          });

          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div class="p-2">
                <h3 class="font-semibold">Delivery #${delivery.tracking_number}</h3>
                <p class="text-sm">Status: ${delivery.status.replace('_', ' ')}</p>
                <p class="text-sm">Estimated: ${new Date(delivery.estimated_delivery).toLocaleDateString()}</p>
              </div>
            `
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
            if (onDeliverySelect) {
              onDeliverySelect(delivery);
              
              logActivity('map_marker_clicked', {
                delivery_id: delivery.id,
                tracking_number: delivery.tracking_number,
                timestamp: new Date().toISOString()
              });
            }
          });

          bounds.extend(position);
          newMarkers.push(marker);
        }
      });

      if (hasValidDeliveries) {
        map.fitBounds(bounds);
        if (map.getZoom() > 15) {
          map.setZoom(15);
        }
        
        logActivity('map_bounds_adjusted', {
          has_deliveries: hasValidDeliveries,
          marker_count: newMarkers.length,
          timestamp: new Date().toISOString()
        });
      }

      setMarkers(newMarkers);
    } catch (err) {
      console.error('Error updating map markers:', err);
      
      logActivity('map_markers_update_error', {
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : 'No stack trace',
        timestamp: new Date().toISOString()
      });
      
      // We don't set the error state here to avoid disrupting the UI if just marker updates fail
    }
  }, [deliveries, map, onDeliverySelect]);

  function getMarkerIcon(status: Delivery['status']): string {
    switch (status) {
      case 'delivered':
        return 'https://maps.google.com/mapfiles/ms/icons/green-dot.png';
      case 'out_for_delivery':
        return 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png';
      case 'failed':
        return 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
      case 'cancelled':
        return 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png';
      default:
        return 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png';
    }
  }

  if (isLoading) {
    return (
      <div className="w-full h-[500px] rounded-lg shadow-lg bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[500px] rounded-lg shadow-lg bg-red-50 flex items-center justify-center">
        <div className="text-center p-6">
          <p className="text-red-600 mb-2">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={mapRef} className="w-full h-[500px] rounded-lg shadow-lg" />
  );
}