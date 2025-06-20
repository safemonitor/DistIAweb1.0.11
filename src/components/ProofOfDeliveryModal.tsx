import { useState, useRef } from 'react';
import { Camera, Upload, Star, CheckCircle, FileText } from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import type { Delivery } from '../types/database';

interface ProofOfDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: Delivery;
  onSuccess: () => void;
}

export function ProofOfDeliveryModal({
  isOpen,
  onClose,
  delivery,
  onSuccess
}: ProofOfDeliveryModalProps) {
  const [formData, setFormData] = useState({
    customerFeedback: '',
    deliveryRating: 5,
    deliveryNotes: ''
  });
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setSignatureDataUrl(canvas.toDataURL());
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofImage(file);
    }
  };

  const uploadFile = async (file: File | Blob, fileName: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from('delivery-proofs')
      .upload(`${delivery.id}/${fileName}`, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('delivery-proofs')
      .getPublicUrl(data.path);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let signatureUrl = '';
      let proofImageUrl = '';

      // Upload signature if provided
      if (signatureDataUrl) {
        const signatureBlob = await fetch(signatureDataUrl).then(r => r.blob());
        signatureUrl = await uploadFile(signatureBlob, `signature-${Date.now()}.png`);
      }

      // Upload proof image if provided
      if (proofImage) {
        proofImageUrl = await uploadFile(proofImage, `proof-${Date.now()}-${proofImage.name}`);
      }

      // Update delivery record
      const { error: updateError } = await supabase
        .from('deliveries')
        .update({
          status: 'delivered',
          actual_delivery: new Date().toISOString(),
          signature_url: signatureUrl || null,
          proof_of_delivery_image_url: proofImageUrl || null,
          customer_feedback: formData.customerFeedback || null,
          delivery_rating: formData.deliveryRating,
          delivery_notes: formData.deliveryNotes || null
        })
        .eq('id', delivery.id);

      if (updateError) throw updateError;

      // Create delivery performance log
      await supabase
        .from('delivery_performance_logs')
        .insert({
          delivery_id: delivery.id,
          delivery_staff_id: delivery.delivery_staff_id,
          status: 'completed',
          notes: `Delivery completed with proof of delivery. Rating: ${formData.deliveryRating}/5`
        });

      onSuccess();
      onClose();
    } catch (err) {
      setError('Failed to submit proof of delivery');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Proof of Delivery - #${delivery.tracking_number}`}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Signature Capture */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Customer Signature
          </label>
          <div className="border border-gray-300 rounded-md p-4">
            <canvas
              ref={canvasRef}
              width={400}
              height={200}
              className="border border-gray-200 rounded cursor-crosshair w-full"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              style={{ touchAction: 'none' }}
            />
            <button
              type="button"
              onClick={clearSignature}
              className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
            >
              Clear Signature
            </button>
          </div>
        </div>

        {/* Photo Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Proof of Delivery Photo
          </label>
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Camera className="h-4 w-4 mr-2" />
              Take Photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageUpload}
              className="hidden"
            />
            {proofImage && (
              <span className="text-sm text-gray-600">
                {proofImage.name}
              </span>
            )}
          </div>
        </div>

        {/* Customer Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Customer Rating
          </label>
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, deliveryRating: rating }))}
                className={`p-1 ${
                  rating <= formData.deliveryRating
                    ? 'text-yellow-400'
                    : 'text-gray-300'
                }`}
              >
                <Star className="h-6 w-6 fill-current" />
              </button>
            ))}
            <span className="ml-2 text-sm text-gray-600">
              {formData.deliveryRating}/5
            </span>
          </div>
        </div>

        {/* Customer Feedback */}
        <div>
          <label htmlFor="customerFeedback" className="block text-sm font-medium text-gray-700">
            Customer Feedback
          </label>
          <textarea
            id="customerFeedback"
            value={formData.customerFeedback}
            onChange={(e) => setFormData(prev => ({ ...prev, customerFeedback: e.target.value }))}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Any feedback from the customer..."
          />
        </div>

        {/* Delivery Notes */}
        <div>
          <label htmlFor="deliveryNotes" className="block text-sm font-medium text-gray-700">
            Delivery Notes
          </label>
          <textarea
            id="deliveryNotes"
            value={formData.deliveryNotes}
            onChange={(e) => setFormData(prev => ({ ...prev, deliveryNotes: e.target.value }))}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Additional notes about the delivery..."
          />
        </div>

        {error && (
          <div className="text-sm text-red-600">
            {error}
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
            disabled={isLoading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Submitting...' : 'Complete Delivery'}
          </button>
        </div>
      </form>
    </Modal>
  );
}