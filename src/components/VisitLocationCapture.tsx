import { useState, useEffect } from 'react';
import { MapPin, Compass, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Visit } from '../types/database';

interface VisitLocationCaptureProps {
  visitId: string;
  existingCoordinates?: { latitude: number; longitude: number } | null;
  onCoordinatesUpdate: (coordinates: { latitude: number; longitude: number }) => void;
  disabled?: boolean;
}

export function VisitLocationCapture({ 
  visitId, 
  existingCoordinates, 
  onCoordinatesUpdate, 
  disabled = false 
}: VisitLocationCaptureProps) {
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(
    existingCoordinates || null
  );
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [mapUrl, setMapUrl] = useState<string | null>(null);

  useEffect(() => {
    if (coordinates) {
      // Generate static map URL
      const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${coordinates.latitude},${coordinates.longitude}&zoom=15&size=600x300&maptype=roadmap&markers=color:red%7C${coordinates.latitude},${coordinates.longitude}&key=YOUR_API_KEY`;
      setMapUrl(mapUrl);
    }
  }, [coordinates]);

  const captureLocation = () => {
    if (disabled) return;
    
    setIsCapturing(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setIsCapturing(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const newCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        
        setCoordinates(newCoordinates);
        onCoordinatesUpdate(newCoordinates);
        
        try {
          // Update the visit record with new coordinates
          await supabase
            .from('visits')
            .update({
              latitude: newCoordinates.latitude,
              longitude: newCoordinates.longitude
            })
            .eq('id', visitId);
        } catch (err) {
          console.error('Error saving coordinates:', err);
        }
        
        setIsCapturing(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        setError(
          error.code === 1
            ? 'Location access denied. Please enable location services.'
            : 'Unable to determine your location. Please try again.'
        );
        setIsCapturing(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const toggleMap = () => {
    if (coordinates) {
      setIsMapVisible(!isMapVisible);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900">Visit Location</h4>
        {!disabled && (
          <button
            type="button"
            onClick={captureLocation}
            disabled={isCapturing}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isCapturing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mr-2"></div>
            ) : (
              <Compass className="h-4 w-4 mr-2" />
            )}
            {coordinates ? 'Update Location' : 'Capture Location'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      {coordinates ? (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <div className="flex items-start">
            <MapPin className="h-5 w-5 text-indigo-500 mt-0.5 mr-2" />
            <div>
              <div className="text-sm font-medium text-gray-900">Location Captured</div>
              <div className="text-sm text-gray-500 font-mono mt-1">
                {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
              </div>
              <button
                type="button"
                onClick={toggleMap}
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
              >
                {isMapVisible ? 'Hide Map' : 'Show Map'}
              </button>
            </div>
          </div>

          {isMapVisible && mapUrl && (
            <div className="mt-3">
              <img 
                src={mapUrl} 
                alt="Visit location map" 
                className="w-full h-auto rounded-md shadow-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Note: This is a static map preview. For navigation, please use a maps application.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
          <MapPin className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No location captured</h3>
          <p className="mt-1 text-sm text-gray-500">
            {disabled ? 'No location was captured for this visit.' : 'Capture your current location to document your visit.'}
          </p>
        </div>
      )}
    </div>
  );
}