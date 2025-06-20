import { useState, useRef } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { logActivity, ActivityTypes } from '../lib/activityLogger';
import { Upload, FileText, AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Product } from '../types/database';

interface ProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ImportFileType = 'json' | 'excel';

interface ImportStats {
  total: number;
  successful: number;
  failed: number;
  duplicates: number;
}

export function ProductImportModal({ isOpen, onClose, onSuccess }: ProductImportModalProps) {
  const [fileType, setFileType] = useState<ImportFileType>('excel');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file extension
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    
    if (fileType === 'json' && fileExtension !== 'json') {
      setError('Please select a JSON file');
      setFile(null);
      return;
    }
    
    if (fileType === 'excel' && !['xlsx', 'xls', 'csv'].includes(fileExtension || '')) {
      setError('Please select an Excel or CSV file');
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setError(null);
    setImportStats(null);
    setValidationErrors([]);
  };

  const validateProduct = (product: any, index: number): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Check required fields
    if (!product.name) errors.push(`Row ${index + 1}: Name is required`);
    if (!product.sku) errors.push(`Row ${index + 1}: SKU is required`);
    if (!product.category) errors.push(`Row ${index + 1}: Category is required`);
    
    // Check data types
    if (isNaN(parseFloat(product.price))) {
      errors.push(`Row ${index + 1}: Price must be a number`);
    }
    
    if (isNaN(parseInt(product.stock_quantity))) {
      errors.push(`Row ${index + 1}: Stock quantity must be a number`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const parseJsonFile = (fileContent: string): any[] => {
    try {
      const data = JSON.parse(fileContent);
      if (!Array.isArray(data)) {
        throw new Error('JSON file must contain an array of products');
      }
      return data;
    } catch (err) {
      throw new Error('Invalid JSON format');
    }
  };

  const parseExcelFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (err) {
          reject(new Error('Failed to parse Excel file'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsBinaryString(file);
    });
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file to import');
      return;
    }

    setIsLoading(true);
    setError(null);
    setValidationErrors([]);
    setImportStats(null);

    try {
      // Get the user's tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;
      const tenant_id = userProfile.tenant_id;

      // Parse file based on type
      let productsData: any[];
      
      if (fileType === 'json') {
        const fileContent = await file.text();
        productsData = parseJsonFile(fileContent);
      } else {
        productsData = await parseExcelFile(file);
      }

      // Validate products
      const allValidationErrors: string[] = [];
      const validProducts: Partial<Product>[] = [];
      
      productsData.forEach((product, index) => {
        const { isValid, errors } = validateProduct(product, index);
        
        if (isValid) {
          validProducts.push({
            name: product.name,
            description: product.description || '',
            price: parseFloat(product.price),
            sku: product.sku,
            stock_quantity: parseInt(product.stock_quantity) || 0,
            category: product.category,
            tenant_id
          });
        } else {
          allValidationErrors.push(...errors);
        }
      });

      if (allValidationErrors.length > 0) {
        setValidationErrors(allValidationErrors);
        if (validProducts.length === 0) {
          throw new Error('No valid products found in the file');
        }
      }

      // Check for duplicate SKUs in the database
      const { data: existingSkus, error: skuError } = await supabase
        .from('products')
        .select('sku')
        .eq('tenant_id', tenant_id)
        .in('sku', validProducts.map(p => p.sku));
      
      if (skuError) throw skuError;
      
      const existingSkuSet = new Set(existingSkus?.map(p => p.sku) || []);
      const duplicates = validProducts.filter(p => existingSkuSet.has(p.sku as string));
      const newProducts = validProducts.filter(p => !existingSkuSet.has(p.sku as string));

      // Insert new products
      const stats: ImportStats = {
        total: validProducts.length,
        successful: 0,
        failed: 0,
        duplicates: duplicates.length
      };

      if (newProducts.length > 0) {
        const { data, error: insertError } = await supabase
          .from('products')
          .insert(newProducts)
          .select();
        
        if (insertError) {
          throw insertError;
        }
        
        stats.successful = data?.length || 0;
      }
      
      stats.failed = validProducts.length - stats.successful - stats.duplicates;
      setImportStats(stats);
      
      // Log activity
      await logActivity(ActivityTypes.PRODUCT_IMPORT, {
        file_name: file.name,
        file_type: fileType,
        total_products: stats.total,
        successful_imports: stats.successful,
        failed_imports: stats.failed,
        duplicates: stats.duplicates
      });

      if (stats.successful > 0) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error importing products:', err);
      setError(err instanceof Error ? err.message : 'Failed to import products');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setError(null);
    setImportStats(null);
    setValidationErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Products"
    >
      <div className="space-y-6">
        {/* File Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            File Type
          </label>
          <div className="flex space-x-4">
            <label className={`flex items-center p-3 border rounded-md cursor-pointer ${
              fileType === 'excel' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'
            }`}>
              <input
                type="radio"
                name="fileType"
                value="excel"
                checked={fileType === 'excel'}
                onChange={() => setFileType('excel')}
                className="sr-only"
              />
              <FileText className="h-5 w-5 text-indigo-500 mr-2" />
              <span>Excel/CSV</span>
            </label>
            
            <label className={`flex items-center p-3 border rounded-md cursor-pointer ${
              fileType === 'json' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'
            }`}>
              <input
                type="radio"
                name="fileType"
                value="json"
                checked={fileType === 'json'}
                onChange={() => setFileType('json')}
                className="sr-only"
              />
              <FileText className="h-5 w-5 text-indigo-500 mr-2" />
              <span>JSON</span>
            </label>
          </div>
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload File
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                  <span>Select a file</span>
                  <input
                    id="file-upload"
                    ref={fileInputRef}
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    accept={fileType === 'json' ? '.json' : '.xlsx,.xls,.csv'}
                    onChange={handleFileChange}
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">
                {fileType === 'json' ? 'JSON' : 'Excel/CSV'} file containing product data
              </p>
            </div>
          </div>
          {file && (
            <div className="mt-2 flex items-center justify-between bg-gray-50 p-2 rounded-md">
              <div className="flex items-center">
                <FileText className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-700">{file.name}</span>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Template Information */}
        <div className="bg-blue-50 p-4 rounded-md">
          <div className="flex">
            <Info className="h-5 w-5 text-blue-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">File Format Information</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p className="mb-1">Your file should include the following columns:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>name</strong> (required): Product name</li>
                  <li><strong>sku</strong> (required): Unique product identifier</li>
                  <li><strong>price</strong> (required): Product price</li>
                  <li><strong>category</strong> (required): Product category</li>
                  <li><strong>stock_quantity</strong>: Initial stock quantity (defaults to 0)</li>
                  <li><strong>description</strong>: Product description (optional)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Validation Errors</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="list-disc list-inside space-y-1 max-h-40 overflow-y-auto">
                    {validationErrors.map((err, index) => (
                      <li key={index}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Import Results */}
        {importStats && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Import Results</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Total products processed: {importStats.total}</p>
                  <p>Successfully imported: {importStats.successful}</p>
                  {importStats.duplicates > 0 && (
                    <p>Skipped (duplicates): {importStats.duplicates}</p>
                  )}
                  {importStats.failed > 0 && (
                    <p>Failed: {importStats.failed}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!file || isLoading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Importing...' : 'Import Products'}
          </button>
        </div>
      </div>
    </Modal>
  );
}