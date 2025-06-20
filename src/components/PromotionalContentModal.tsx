import { useState, useRef } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { FileText, Image, Video, Upload, Loader2, AlertTriangle } from 'lucide-react';
import type { PromotionalContent } from '../types/database';

interface PromotionalContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  content?: PromotionalContent;
  onSuccess: () => void;
}

export function PromotionalContentModal({ 
  isOpen, 
  onClose, 
  content, 
  onSuccess 
}: PromotionalContentModalProps) {
  const [formData, setFormData] = useState({
    name: content?.name || '',
    type: content?.type || 'text',
    content_text: content?.content_text || '',
  });
  
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(content?.content_url || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Reset file if type changes
    if (name === 'type' && value !== formData.type) {
      setFile(null);
      setFilePreview(null);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    // Validate file type
    const fileType = formData.type;
    const isValidType = fileType === 'image' 
      ? selectedFile.type.startsWith('image/') 
      : fileType === 'video' 
        ? selectedFile.type.startsWith('video/') 
        : false;
    
    if (!isValidType) {
      setError(`Invalid file type. Please select a ${fileType} file.`);
      return;
    }
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(selectedFile);
    setFile(selectedFile);
    setFilePreview(previewUrl);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get the user's tenant_id
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;
      const tenant_id = userProfile.tenant_id;

      let content_url = content?.content_url || null;
      
      // Handle file upload for image or video content
      if ((formData.type === 'image' || formData.type === 'video') && file) {
        const contentId = content?.id || crypto.randomUUID();
        const fileExt = file.name.split('.').pop();
        const filePath = `${contentId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from('marketing-media')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
            onUploadProgress: (progress) => {
              const percent = (progress.loaded / progress.total) * 100;
              setUploadProgress(percent);
            }
          });

        if (uploadError) throw uploadError;
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('marketing-media')
          .getPublicUrl(filePath);
          
        content_url = publicUrl;
      }

      if (content) {
        // Update existing content
        const { error } = await supabase
          .from('promotional_content')
          .update({
            name: formData.name,
            type: formData.type,
            content_text: formData.content_text || null,
            content_url: content_url
          })
          .eq('id', content.id);

        if (error) throw error;
      } else {
        // Create new content
        const { error } = await supabase
          .from('promotional_content')
          .insert([{
            tenant_id: tenant_id,
            name: formData.name,
            type: formData.type,
            content_text: formData.content_text || null,
            content_url: content_url,
            created_by: user.id
          }]);

        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving content:', err);
      setError(err instanceof Error ? err.message : 'Failed to save content');
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={content ? 'Edit Promotional Content' : 'Add Promotional Content'}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Content Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700">
            Content Type
          </label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          >
            <option value="text">Text</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        </div>

        {formData.type === 'text' ? (
          <div>
            <label htmlFor="content_text" className="block text-sm font-medium text-gray-700">
              Text Content
            </label>
            <textarea
              id="content_text"
              name="content_text"
              value={formData.content_text}
              onChange={handleChange}
              rows={5}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {formData.type === 'image' ? 'Image' : 'Video'} Upload
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                {filePreview ? (
                  <div className="mb-3">
                    {formData.type === 'image' ? (
                      <img 
                        src={filePreview} 
                        alt="Preview" 
                        className="mx-auto h-32 w-auto object-cover"
                      />
                    ) : (
                      <video 
                        src={filePreview} 
                        controls 
                        className="mx-auto h-32 w-auto"
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex justify-center">
                    {formData.type === 'image' ? (
                      <Image className="mx-auto h-12 w-12 text-gray-400" />
                    ) : (
                      <Video className="mx-auto h-12 w-12 text-gray-400" />
                    )}
                  </div>
                )}
                
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="file-upload"
                      ref={fileInputRef}
                      name="file-upload"
                      type="file"
                      className="sr-only"
                      accept={formData.type === 'image' ? 'image/*' : 'video/*'}
                      onChange={handleFileChange}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">
                  {formData.type === 'image' ? 'PNG, JPG, GIF up to 10MB' : 'MP4, WebM up to 50MB'}
                </p>
                
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="w-full mt-2">
                    <div className="bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-indigo-600 h-2.5 rounded-full" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Uploading: {Math.round(uploadProgress)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {(formData.type === 'image' || formData.type === 'video') && (
              <div className="mt-2">
                <label htmlFor="content_text" className="block text-sm font-medium text-gray-700">
                  Caption (Optional)
                </label>
                <textarea
                  id="content_text"
                  name="content_text"
                  value={formData.content_text}
                  onChange={handleChange}
                  rows={2}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || ((formData.type === 'image' || formData.type === 'video') && !file && !content?.content_url)}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </span>
            ) : content ? 'Update Content' : 'Create Content'}
          </button>
        </div>
      </form>
    </Modal>
  );
}