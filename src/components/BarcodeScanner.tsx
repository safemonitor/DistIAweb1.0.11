import { useState, useRef, useEffect } from 'react';
import { Camera, X, Zap, Search, Package, AlertCircle, CheckCircle } from 'lucide-react';
import { Modal } from './Modal';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  placeholder?: string;
}

export function BarcodeScanner({ 
  isOpen, 
  onClose, 
  onScan, 
  title = "Scan Barcode",
  placeholder = "Point camera at barcode or enter manually"
}: BarcodeScannerProps) {
  const [manualInput, setManualInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen && isScanning) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, isScanning]);

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please check permissions or enter barcode manually.');
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleScan(manualInput.trim());
    }
  };

  const handleScan = (barcode: string) => {
    setLastScanned(barcode);
    onScan(barcode);
    setManualInput('');
    
    // Auto-close after successful scan
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  const toggleScanning = () => {
    setIsScanning(!isScanning);
    setError(null);
  };

  const handleClose = () => {
    stopCamera();
    setIsScanning(false);
    setManualInput('');
    setError(null);
    setLastScanned(null);
    onClose();
  };

  // Simulate barcode detection (in a real app, you'd use a barcode scanning library)
  const simulateScan = () => {
    const mockBarcodes = [
      '1234567890123',
      '9876543210987',
      '5555555555555',
      '1111111111111',
      '9999999999999'
    ];
    const randomBarcode = mockBarcodes[Math.floor(Math.random() * mockBarcodes.length)];
    handleScan(randomBarcode);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <div className="space-y-6">
        {/* Camera View */}
        {isScanning && (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-64 bg-black rounded-lg object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-32 border-2 border-white border-dashed rounded-lg flex items-center justify-center">
                <div className="text-white text-sm text-center">
                  <Package className="h-8 w-8 mx-auto mb-2" />
                  Position barcode here
                </div>
              </div>
            </div>
            
            {/* Scanning Controls */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4">
              <button
                onClick={simulateScan}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-700"
              >
                <Zap className="h-4 w-4" />
                <span>Simulate Scan</span>
              </button>
              <button
                onClick={toggleScanning}
                className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-red-700"
              >
                <X className="h-4 w-4" />
                <span>Stop</span>
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
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

        {/* Success Display */}
        {lastScanned && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <p className="text-sm text-green-600">
                  Successfully scanned: <span className="font-mono font-medium">{lastScanned}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Camera Toggle */}
        {!isScanning && (
          <div className="text-center">
            <button
              onClick={toggleScanning}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Camera className="h-5 w-5 mr-2" />
              Start Camera
            </button>
          </div>
        )}

        {/* Manual Input */}
        <div className="border-t border-gray-200 pt-6">
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label htmlFor="manual-barcode" className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="h-4 w-4 inline mr-2" />
                Enter Barcode Manually
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  id="manual-barcode"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder={placeholder}
                  className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono"
                />
                <button
                  type="submit"
                  disabled={!manualInput.trim()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Scan
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-2">Scanning Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Hold the device steady and ensure good lighting</li>
              <li>Position the barcode within the scanning area</li>
              <li>For best results, scan from 6-12 inches away</li>
              <li>If camera fails, use manual input as backup</li>
            </ul>
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}