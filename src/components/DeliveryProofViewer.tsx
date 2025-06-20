import { useState } from 'react';
import { Star, Download, Eye } from 'lucide-react';
import { Modal } from './Modal';
import type { Delivery } from '../types/database';

interface DeliveryProofViewerProps {
  delivery: Delivery;
  isOpen: boolean;
  onClose: () => void;
}

export function DeliveryProofViewer({ delivery, isOpen, onClose }: DeliveryProofViewerProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Proof of Delivery - #${delivery.tracking_number}`}
      >
        <div className="space-y-6">
          {/* Delivery Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delivery Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Status:</span>
                <span className="ml-2 capitalize">{delivery.status}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Completed:</span>
                <span className="ml-2">
                  {delivery.actual_delivery ? 
                    new Date(delivery.actual_delivery).toLocaleString() : 
                    'Not completed'
                  }
                </span>
              </div>
              {delivery.delivery_rating && (
                <div>
                  <span className="font-medium text-gray-700">Rating:</span>
                  <div className="ml-2 inline-flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= delivery.delivery_rating!
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                    <span className="ml-1 text-sm text-gray-600">
                      ({delivery.delivery_rating}/5)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Customer Signature */}
          {delivery.signature_url && (
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-2">Customer Signature</h4>
              <div className="border border-gray-200 rounded-lg p-4 bg-white">
                <img
                  src={delivery.signature_url}
                  alt="Customer Signature"
                  className="max-w-full h-auto cursor-pointer"
                  onClick={() => setSelectedImage(delivery.signature_url!)}
                />
                <button
                  onClick={() => downloadImage(delivery.signature_url!, `signature-${delivery.tracking_number}.png`)}
                  className="mt-2 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download Signature
                </button>
              </div>
            </div>
          )}

          {/* Proof of Delivery Photo */}
          {delivery.proof_of_delivery_image_url && (
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-2">Proof of Delivery Photo</h4>
              <div className="border border-gray-200 rounded-lg p-4 bg-white">
                <img
                  src={delivery.proof_of_delivery_image_url}
                  alt="Proof of Delivery"
                  className="max-w-full h-auto cursor-pointer rounded"
                  onClick={() => setSelectedImage(delivery.proof_of_delivery_image_url!)}
                />
                <button
                  onClick={() => downloadImage(delivery.proof_of_delivery_image_url!, `proof-${delivery.tracking_number}.jpg`)}
                  className="mt-2 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download Photo
                </button>
              </div>
            </div>
          )}

          {/* Customer Feedback */}
          {delivery.customer_feedback && (
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-2">Customer Feedback</h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700">{delivery.customer_feedback}</p>
              </div>
            </div>
          )}

          {/* Delivery Notes */}
          {delivery.delivery_notes && (
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-2">Delivery Notes</h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700">{delivery.delivery_notes}</p>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Image Viewer Modal */}
      {selectedImage && (
        <Modal
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          title="Image Viewer"
        >
          <div className="text-center">
            <img
              src={selectedImage}
              alt="Full size view"
              className="max-w-full max-h-96 mx-auto"
            />
          </div>
        </Modal>
      )}
    </>
  );
}