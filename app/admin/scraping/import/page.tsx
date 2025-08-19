'use client';

import { useState, useEffect } from 'react';
import FileUpload from '@/components/scraping/FileUpload';
import ColumnMappingUI from '@/components/scraping/ColumnMappingUI';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { ColumnMapping, NormalizedProductData, ValidationError, ValidationWarning } from '@/lib/scraping/types';

type ImportStep = 'upload' | 'mapping' | 'validation' | 'import' | 'complete';

interface FileData {
  headers: string[];
  rows: any[];
  fileName: string;
  fileType: string;
}

interface ImportResults {
  success: number;
  failed: number;
  errors: string[];
  warnings: string[];
  savedCount: number;
}

export default function ImportPage() {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [supplierId, setSupplierId] = useState<string>('');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', country: 'NL', currency: 'EUR' });

  // Fetch suppliers on component mount
  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/admin/scraping/suppliers');
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const handleCreateSupplier = async () => {
    if (!newSupplier.name.trim()) {
      alert('Supplier name is required');
      return;
    }
    setAddingSupplier(true);
    try {
      const res = await fetch('/api/admin/scraping/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSupplier),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Failed to create supplier');
      }
      const { supplier } = await res.json();
      await fetchSuppliers();
      setSupplierId(supplier.id);
      setNewSupplier({ name: '', country: 'NL', currency: 'EUR' });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setAddingSupplier(false);
    }
  };

  const handleFileProcessed = (data: FileData) => {
    setFileData(data);
    setCurrentStep('mapping');
  };

  const handleMappingComplete = (mapping: ColumnMapping) => {
    setColumnMapping(mapping);
    setCurrentStep('validation');
  };

  const handleStartImport = async () => {
    if (!fileData || !supplierId) {
      alert('Please select a supplier and ensure file data is available');
      return;
    }

    setIsImporting(true);
    setCurrentStep('import');
    setImportProgress(0);

    try {
      const response = await fetch('/api/admin/scraping/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supplierId,
          columnMapping,
          rows: fileData.rows,
          fileName: fileData.fileName
        }),
      });

      if (response.ok) {
        const results = await response.json();
        setImportResults({
          success: results.validRows,
          failed: results.invalidRows,
          errors: results.errors.map((e: any) => e.message),
          warnings: results.warnings.map((w: any) => w.message),
          savedCount: results.savedCount
        });
        setCurrentStep('complete');
      } else {
        const errorData = await response.json();
        alert(`Import failed: ${errorData.error}`);
        setCurrentStep('validation');
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed. Please try again.');
      setCurrentStep('validation');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setCurrentStep('upload');
    setFileData(null);
    setColumnMapping({});
    setSupplierId('');
    setImportResults(null);
    setValidationErrors([]);
    setValidationWarnings([]);
    setImportProgress(0);
  };

  const exportResults = () => {
    if (!importResults) return;

    const csvContent = [
      'Status,Message',
      ...importResults.errors.map(error => `Error,${error}`),
      ...importResults.warnings.map(warning => `Warning,${warning}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Import Supplier Data</h1>
          <p className="text-gray-800">
          Upload and normalize supplier product lists into our standardized format
          </p>
        </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {['upload', 'mapping', 'validation', 'import', 'complete'].map((step, index) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === step
                  ? 'bg-blue-600 text-white'
                  : index < ['upload', 'mapping', 'validation', 'import', 'complete'].indexOf(currentStep)
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}>
                {index + 1}
              </div>
              <span className={`ml-2 text-sm font-medium ${
                currentStep === step ? 'text-blue-600' : 'text-gray-800'
              }`}>
                {step.charAt(0).toUpperCase() + step.slice(1)}
              </span>
              {index < 4 && (
                <div className={`w-16 h-0.5 mx-4 ${
                  index < ['upload', 'mapping', 'validation', 'import', 'complete'].indexOf(currentStep)
                    ? 'bg-green-600'
                    : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 'upload' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 1: Upload File</h2>
          <FileUpload onFileProcessed={handleFileProcessed} />
        </Card>
      )}

      {currentStep === 'mapping' && fileData && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 2: Map Columns</h2>
          <ColumnMappingUI
            csvHeaders={fileData.headers}
            onMappingComplete={handleMappingComplete}
            savedTemplates={[]}
          />
        </Card>
      )}

      {currentStep === 'validation' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 3: Validation & Supplier Selection</h2>
          
          {/* Supplier Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Select Supplier
            </label>
            {suppliers.length > 0 ? (
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="">Choose a supplier...</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} ({supplier.country})
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-gray-900">No suppliers found. Create one:</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    placeholder="Supplier name"
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  />
                  <input
                    placeholder="Country (e.g., NL)"
                    value={newSupplier.country}
                    onChange={(e) => setNewSupplier({ ...newSupplier, country: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  />
                  <input
                    placeholder="Currency (e.g., EUR)"
                    value={newSupplier.currency}
                    onChange={(e) => setNewSupplier({ ...newSupplier, currency: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  />
                </div>
                <div>
                  <Button onClick={handleCreateSupplier} disabled={addingSupplier}>
                    {addingSupplier ? 'Creating...' : 'Create Supplier'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Validation Summary */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Validation Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{fileData?.rows.length || 0}</div>
                <div className="text-sm text-green-600">Total Rows</div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{Object.keys(columnMapping).length}</div>
                <div className="text-sm text-blue-600">Mapped Fields</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {Object.keys(columnMapping).length >= 3 ? 'Ready' : 'Incomplete'}
                </div>
                <div className="text-sm text-yellow-600">Status</div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => setCurrentStep('mapping')}
              variant="outline"
            >
              Back to Mapping
            </Button>
            <Button
              onClick={handleStartImport}
              disabled={!supplierId || Object.keys(columnMapping).length < 3}
            >
              Start Import
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 'import' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 4: Importing Data</h2>
          
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              ></div>
            </div>
            <div className="text-center mt-2 text-sm text-gray-800">
              {importProgress}% Complete
            </div>
          </div>

          <div className="text-center text-gray-800">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            Processing your data... This may take a few minutes.
          </div>
        </Card>
      )}

      {currentStep === 'complete' && importResults && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 5: Import Complete</h2>
          
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{importResults.success}</div>
                <div className="text-sm text-green-600">Successful</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">{importResults.failed}</div>
                <div className="text-sm text-red-600">Failed</div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{importResults.savedCount}</div>
                <div className="text-sm text-blue-600">Saved to DB</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-600">{importResults.warnings.length}</div>
                <div className="text-sm text-yellow-600">Warnings</div>
              </div>
            </div>
          </div>

          {importResults.errors.length > 0 && (
            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2 text-red-600">Errors</h3>
              <div className="bg-red-50 p-4 rounded-lg max-h-40 overflow-y-auto">
                {importResults.errors.map((error, index) => (
                  <div key={index} className="text-sm text-red-600 mb-1">• {error}</div>
                ))}
              </div>
            </div>
          )}

          {importResults.warnings.length > 0 && (
            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2 text-yellow-600">Warnings</h3>
              <div className="bg-yellow-50 p-4 rounded-lg max-h-40 overflow-y-auto">
                {importResults.warnings.map((warning, index) => (
                  <div key={index} className="text-sm text-yellow-600 mb-1">• {warning}</div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <Button onClick={exportResults} variant="outline">
              Export Results
            </Button>
            <Button onClick={handleReset}>
              Import Another File
            </Button>
          </div>
        </Card>
      )}
      </div>
    </div>
  );
}
