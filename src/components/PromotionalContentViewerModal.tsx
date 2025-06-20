import { Modal } from './Modal';
import { FileText, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import type { PromotionalContent } from '../types/database';

interface PromotionalContentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: PromotionalContent;
}

export function PromotionalContentViewerModal({ 
  isOpen, 
  onClose, 
  content 
}: PromotionalContentViewerModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={content.name}
    >
      <div className="space-y-6">
        <div className="flex items-center">
          {content.type === 'text' && <FileText className="h-5 w-5 text-blue-500 mr-2" />}
          {content.type === 'image' && <ImageIcon className="h-5 w-5 text-green-500 mr-2" />}
          {content.type === 'video' && <VideoIcon className="h-5 w-5 text-purple-500 mr-2" />}
          <span className="text-sm font-medium text-gray-700 capitalize">{content.type} Content</span>
        </div>
        
        {content.type === 'text' && content.content_text && (
          <div className="bg-gray-50 p-4 rounded-md">
            <p className="whitespace-pre-wrap text-gray-800">{content.content_text}</p>
          </div>
        )}
        
        {content.type === 'image' && content.content_url && (
          <div className="flex flex-col items-center">
            <img 
              src={content.content_url} 
              alt={content.name} 
              className="max-w-full max-h-96 object-contain rounded-md"
            />
            {content.content_text && (
              <p className="mt-2 text-sm text-gray-600 italic">{content.content_text}</p>
            )}
          </div>
        )}
        
        {content.type === 'video' && content.content_url && (
          <div className="flex flex-col items-center">
            <video 
              src={content.content_url} 
              controls 
              className="max-w-full max-h-96 rounded-md"
            />
            {content.content_text && (
              <p className="mt-2 text-sm text-gray-600 italic">{content.content_text}</p>
            )}
          </div>
        )}
        
        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Content Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Created By</p>
              <p className="font-medium">
                {content.created_by_profile 
                  ? `${content.created_by_profile.first_name} ${content.created_by_profile.last_name}`
                  : 'Unknown'
                }
              </p>
            </div>
            <div>
              <p className="text-gray-500">Created At</p>
              <p className="font-medium">{new Date(content.created_at).toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}