import { useState, useRef } from 'react';
import { Camera, Upload, X, Eye, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PhotoCaptureProps {
  visitId: string;
  existingPhotos?: string[];
  onPhotosUpdate: (photos: string[]) => void;
  disabled?: boolean;
}

export function PhotoCapture({ visitId, existingPhotos = [], onPhotosUpdate, disabled = false }: PhotoCaptureProps) {
  const [photos, setPhotos] = useState<string[]>(existingPhotos);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${visitId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('visit-photos')
          .upload(fileName, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('visit-photos')
          .getPublicUrl(data.path);

        return publicUrl;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const newPhotos = [...photos, ...uploadedUrls];
      
      setPhotos(newPhotos);
      onPhotosUpdate(newPhotos);

      // Update the visit record with new photos
      await supabase
        .from('visits')
        .update({ photos_url: newPhotos })
        .eq('id', visitId);

    } catch (err) {
      console.error('Error uploading photos:', err);
      alert('Failed to upload photos');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = async (photoUrl: string) => {
    if (!confirm('Are you sure you want to remove this photo?')) return;

    try {
      // Extract file path from URL for deletion
      const urlParts = photoUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `${visitId}/${fileName}`;

      // Delete from storage
      await supabase.storage
        .from('visit-photos')
        .remove([filePath]);

      const newPhotos = photos.filter(url => url !== photoUrl);
      setPhotos(newPhotos);
      onPhotosUpdate(newPhotos);

      // Update the visit record
      await supabase
        .from('visits')
        .update({ photos_url: newPhotos })
        .eq('id', visitId);

    } catch (err) {
      console.error('Error removing photo:', err);
      alert('Failed to remove photo');
    }
  };

  const downloadPhoto = (photoUrl: string) => {
    const link = document.createElement('a');
    link.href = photoUrl;
    link.download = `visit-photo-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900">Visit Photos</h4>
        {!disabled && (
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <Camera className="h-4 w-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Take Photo'}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {photos.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <Camera className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No photos yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            {disabled ? 'No photos were captured for this visit.' : 'Capture photos to document your visit.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {photos.map((photoUrl, index) => (
            <div key={index} className="relative group">
              <img
                src={photoUrl}
                alt={`Visit photo ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedPhoto(photoUrl)}
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPhoto(photoUrl)}
                    className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50"
                  >
                    <Eye className="h-4 w-4 text-gray-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPhoto(photoUrl)}
                    className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50"
                  >
                    <Download className="h-4 w-4 text-gray-600" />
                  </button>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photoUrl)}
                      className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50"
                    >
                      <X className="h-4 w-4 text-red-600" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setSelectedPhoto(null)} />
            <div className="relative transform overflow-hidden rounded-lg bg-white shadow-xl transition-all max-w-4xl max-h-[90vh]">
              <div className="absolute right-0 top-0 pr-4 pt-4 z-10">
                <button
                  type="button"
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onClick={() => setSelectedPhoto(null)}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="p-4">
                <img
                  src={selectedPhoto}
                  alt="Visit photo"
                  className="max-w-full max-h-[80vh] mx-auto rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}