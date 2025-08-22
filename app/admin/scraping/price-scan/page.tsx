'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import BackButton from '@/components/ui/BackButton';
import PriceResultsTable from '@/components/scraping/PriceResultsTable';
import { 
  ScrapingJobConfig, 
  NormalizedProductData, 
  PriceScrapingResult,
  ScrapingSource 
} from '@/lib/scraping/types';
import { Decimal } from '@prisma/client/runtime/library';

type PriceScanStep = 'config' | 'scanning' | 'results';

interface ScrapingJob {
  id: string;
  name: string;
  status: string;
  totalProducts: number;
  processedProducts: number;
  successfulProducts: number;
  failedProducts: number;
  startedAt?: string;
  completedAt?: string;
  supplier?: { name: string };
  // Enhanced progress tracking
  currentProduct?: string;
  currentSource?: string;
  currentBatch?: number;
  totalBatches?: number;
  currentSearchTerm?: string;
  searchAttempts?: number;
}

export default function PriceScanPage() {
  const [currentStep, setCurrentStep] = useState<PriceScanStep>('config');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [scrapingSources, setScrapingSources] = useState<ScrapingSource[]>([]);
  const [normalizedProducts, setNormalizedProducts] = useState<NormalizedProductData[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [scanConfig, setScanConfig] = useState<ScrapingJobConfig>({
    sources: [],
    batchSize: 10,
    delayBetweenBatches: 5000,
    maxRetries: 3,
    timeout: 30000
  });
  const [currentJob, setCurrentJob] = useState<ScrapingJob | null>(null);
  const [scanResults, setScanResults] = useState<PriceScrapingResult[]>([]);
  const [scanProgress, setScanProgress] = useState(0);

  // Fetch data on component mount
  useEffect(() => {
    fetchSuppliers();
    fetchScrapingSources();
  }, []);

  // Fetch suppliers when selected supplier changes
  useEffect(() => {
    if (selectedSupplier) {
      fetchNormalizedProducts(selectedSupplier);
    }
  }, [selectedSupplier]);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/admin/scraping/suppliers');
      if (response.ok) {
        const data = await response.json();
        const list = data.suppliers || [];
        setSuppliers(list);
        if (list.length > 0) {
          setSelectedSupplier((prev) => prev || list[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchScrapingSources = async () => {
    try {
      const res = await fetch('/api/admin/scraping/sources');
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.sources || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          baseUrl: s.baseUrl,
          country: s.country,
          isActive: s.isActive,
          priority: s.priority,
          rateLimit: s.rateLimit,
          config: s.config || {
            selectors: {
              productTitle: '',
              price: '',
              availability: '',
              shipping: ''
            }
          }
        }));
        setScrapingSources(mapped);
        const activeIds = mapped.filter((s: any) => s.isActive).map((s: any) => s.id);
        if (activeIds.length > 0) {
          setSelectedSources((prev) => prev.length ? prev : activeIds);
        }
      }
    } catch (error) {
      console.error('Error fetching scraping sources:', error);
    }
  };

  const fetchNormalizedProducts = async (supplierId: string) => {
    try {
      const res = await fetch(`/api/admin/scraping/products?supplierId=${encodeURIComponent(supplierId)}`);
      if (res.ok) {
        const data = await res.json();
        setNormalizedProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error fetching normalized products:', error);
    }
  };

  const handleStartScan = async () => {
    if (!selectedSupplier || selectedSources.length === 0) {
      alert('Please select a supplier and at least one scraping source');
      return;
    }

    setCurrentStep('scanning');
    setScanProgress(0);

    try {
      // Create scraping job with updated config including selected sources
      const requestBody = {
        supplierId: selectedSupplier,
        sources: selectedSources,
        config: {
          ...scanConfig,
          sources: selectedSources // Ensure sources are included in config
        }
      };
      
      console.log('Starting price scan with request body:', requestBody);
      
      const response = await fetch('/api/admin/scraping/price-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const jobData = await response.json();
        const job: ScrapingJob = {
          id: jobData.jobId,
          name: `Price Scan - ${suppliers.find(s => s.id === selectedSupplier)?.name}`,
          status: 'RUNNING',
          totalProducts: jobData.totalProducts,
          processedProducts: 0,
          successfulProducts: 0,
          failedProducts: 0,
          startedAt: new Date().toISOString()
        };
        setCurrentJob(job);

        // Poll job status periodically and update progress
        const jobId = jobData.jobId as string;
        const interval = setInterval(async () => {
          try {
            const sres = await fetch(`/api/admin/scraping/price-scan?jobId=${encodeURIComponent(jobId)}`);
            if (sres.ok) {
              const sdata = await sres.json();
              const j = sdata.job;
              setCurrentJob({
                id: j.id,
                name: j.name,
                status: j.status,
                totalProducts: j.totalProducts,
                processedProducts: j.processedProducts,
                successfulProducts: j.successfulProducts,
                failedProducts: j.failedProducts,
                startedAt: j.startedAt,
                completedAt: j.completedAt,
                supplier: j.supplier ? { name: j.supplier.name } : undefined,
                // Enhanced progress tracking
                currentProduct: j.currentProduct,
                currentSource: j.currentSource,
                currentBatch: j.currentBatch,
                totalBatches: j.totalBatches,
                currentSearchTerm: j.currentSearchTerm,
                searchAttempts: j.searchAttempts,
              } as any);
              // Calculate more granular progress including current product
              let progress = 0;
              if (j.totalProducts > 0) {
                // Base progress from processed products
                const baseProgress = (j.processedProducts / j.totalProducts) * 100;
                
                // Add partial progress for current product if we have batch info
                if (j.currentBatch && j.totalBatches) {
                  const batchProgress = ((j.currentBatch - 1) / j.totalBatches) * 100;
                  const currentBatchWeight = (1 / j.totalBatches) * 100;
                  
                  // If we're in the middle of a batch, add partial progress
                  if (j.currentProduct && j.currentSource) {
                    progress = batchProgress + (currentBatchWeight * 0.5); // Assume 50% through current batch
                  } else {
                    progress = batchProgress;
                  }
                } else {
                  progress = baseProgress;
                }
              }
              
              setScanProgress(Math.min(100, Math.round(progress)));
              if (j.status === 'COMPLETED' || j.status === 'FAILED' || j.status === 'STOPPED') {
                clearInterval(interval);
                setCurrentStep('results');
                // Load latest results for supplier
                const rres = await fetch(`/api/admin/scraping/price-results?supplierId=${encodeURIComponent(selectedSupplier)}&limit=100`);
                if (rres.ok) {
                  const rdata = await rres.json();
                  setScanResults(rdata.results || []);
                }
              }
            }
          } catch (e) {
            console.error('Polling failed', e);
          }
        }, 3000);
      } else {
        const errorData = await response.json();
        alert(`Failed to start scanning: ${errorData.error}`);
        setCurrentStep('config');
      }
    } catch (error) {
      console.error('Error starting price scan:', error);
      alert('Failed to start price scanning. Please try again.');
      setCurrentStep('config');
    }
  };

  const handleStopScan = async () => {
    if (currentJob) {
      try {
        // Update job status to stopped
        const updatedJob = { ...currentJob, status: 'STOPPED', completedAt: new Date().toISOString() };
        setCurrentJob(updatedJob);
        setCurrentStep('config');
      } catch (error) {
        console.error('Error stopping scan:', error);
      }
    }
  };

  const handleSourceToggle = (sourceId: string) => {
    setSelectedSources(prev => 
      prev.includes(sourceId) 
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  const handleExport = (format: 'csv' | 'json') => {
    // Implement export functionality
    console.log(`Exporting results in ${format} format`);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        <BackButton href="/admin/scraping">Back to Scraping Dashboard</BackButton>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Price Scanning</h1>
          <p className="text-gray-800">
            Scan web sources to find current retail prices for your normalized products
          </p>
        </div>

        {currentStep === 'config' && (
          <div className="space-y-6">
            {/* Supplier Selection */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Supplier</h2>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="">Choose a supplier...</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} ({supplier.country})
                  </option>
                ))}
              </select>
            </Card>

            {/* Scraping Sources */}
            {selectedSupplier && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Scraping Sources</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {scrapingSources.map((source) => (
                    <div
                      key={source.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedSources.includes(source.id!)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleSourceToggle(source.id!)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{source.name}</h3>
                          <p className="text-sm text-gray-800">{source.country}</p>
                          <p className="text-xs text-gray-700">Priority: {source.priority}</p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          selectedSources.includes(source.id!)
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-300'
                        }`}>
                          {selectedSources.includes(source.id!) && (
                            <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Configuration Options */}
            {selectedSupplier && selectedSources.length > 0 && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Scan Configuration</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Batch Size
                    </label>
                    <input
                      type="number"
                      value={scanConfig.batchSize}
                      onChange={(e) => setScanConfig(prev => ({ ...prev, batchSize: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delay Between Batches (ms)
                    </label>
                    <input
                      type="number"
                      value={scanConfig.delayBetweenBatches}
                      onChange={(e) => setScanConfig(prev => ({ ...prev, delayBetweenBatches: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1000"
                      max="30000"
                      step="1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Retries
                    </label>
                    <input
                      type="number"
                      value={scanConfig.maxRetries}
                      onChange={(e) => setScanConfig(prev => ({ ...prev, maxRetries: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timeout (ms)
                    </label>
                    <input
                      type="number"
                      value={scanConfig.timeout}
                      onChange={(e) => setScanConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="5000"
                      max="60000"
                      step="1000"
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* Start Button */}
            {selectedSupplier && selectedSources.length > 0 && (
              <div className="text-center">
                <Button
                  onClick={handleStartScan}
                  disabled={!selectedSupplier || selectedSources.length === 0}
                  size="lg"
                >
                  Start Price Scanning
                </Button>
              </div>
            )}
          </div>
        )}

        {currentStep === 'scanning' && currentJob && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Scanning in Progress</h2>
            
            {/* Job Status */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Job: {currentJob.name}</span>
                <Badge label={currentJob.status} variant={currentJob.status === 'RUNNING' ? 'neutral' : 'warning'} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-xl font-bold text-blue-600">{currentJob.totalProducts}</div>
                  <div className="text-sm text-blue-600">Total Products</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-xl font-bold text-green-600">{currentJob.processedProducts}</div>
                  <div className="text-sm text-green-600">Processed</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-xl font-bold text-blue-600">{currentJob.successfulProducts}</div>
                  <div className="text-sm text-blue-600">Successful</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-xl font-bold text-red-600">{currentJob.failedProducts}</div>
                  <div className="text-sm text-red-600">Failed</div>
                </div>
              </div>

              {/* Enhanced Progress Bar with Modern Design */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-900">
                    Scanning Progress
                  </div>
                  <div className="text-sm font-semibold text-blue-600">
                    {Math.round(scanProgress)}%
                  </div>
                </div>
                
                {/* Main Progress Bar */}
                <div className="relative">
                  <div className="w-full bg-gradient-to-r from-gray-200 to-gray-300 rounded-full h-4 shadow-inner">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all duration-500 ease-out shadow-sm relative overflow-hidden"
                      style={{ width: `${scanProgress}%` }}
                    >
                      {/* Animated shimmer effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                    </div>
                  </div>
                  
                  {/* Progress Text Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-medium text-white drop-shadow-sm">
                      {currentJob.processedProducts || 0} / {currentJob.totalProducts || 0} products
                    </span>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                    <div className="text-lg font-bold text-green-600">{currentJob.successfulProducts || 0}</div>
                    <div className="text-xs text-green-600">Successful</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <div className="text-lg font-bold text-red-600">{currentJob.failedProducts || 0}</div>
                    <div className="text-xs text-red-600">Failed</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <div className="text-lg font-bold text-blue-600">
                      {currentJob.currentBatch || 0}/{currentJob.totalBatches || 0}
                    </div>
                    <div className="text-xs text-blue-600">Batches</div>
                  </div>
                </div>
              </div>

              {/* Detailed Progress Information */}
              {currentJob.currentProduct && (
                <div className="mt-4 space-y-3">
                  {/* Current Product */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-800">Current Product:</span>
                      <span className="text-sm text-blue-600">{currentJob.currentProduct}</span>
                    </div>
                  </div>

                  {/* Current Source */}
                  {currentJob.currentSource && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-800">Current Source:</span>
                        <span className="text-sm text-green-600">{currentJob.currentSource}</span>
                      </div>
                    </div>
                  )}

                  {/* Current Search Term */}
                  {currentJob.currentSearchTerm && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-yellow-800">Search Term:</span>
                        <span className="text-sm text-yellow-600">{currentJob.currentSearchTerm}</span>
                      </div>
                    </div>
                  )}

                  {/* Batch Progress */}
                  {currentJob.currentBatch && currentJob.totalBatches && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-purple-800">Batch Progress:</span>
                        <span className="text-sm text-purple-600">
                          {currentJob.currentBatch} of {currentJob.totalBatches}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Search Attempts */}
                  {currentJob.searchAttempts && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-orange-800">Search Attempts:</span>
                        <span className="text-sm text-orange-600">{currentJob.searchAttempts}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Real-time Status Indicator */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center space-x-2 mb-3">
                <div className="animate-pulse w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-700">Live Progress</span>
              </div>
              
              {currentJob.currentProduct && (
                <div className="text-center space-y-2">
                  <div className="text-lg font-semibold text-gray-900">
                    Currently processing: {currentJob.currentProduct}
                  </div>
                  {currentJob.currentSource && (
                    <div className="text-sm text-gray-600">
                      Source: {currentJob.currentSource}
                    </div>
                  )}
                  {currentJob.currentSearchTerm && (
                    <div className="text-sm text-gray-600">
                      Search: {currentJob.currentSearchTerm}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="text-center mt-4">
              <Button onClick={handleStopScan} variant="outline">
                Stop Scanning
              </Button>
            </div>
          </Card>
        )}

        {currentStep === 'results' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Scan Results</h2>
              {scanResults.length === 0 ? (
                <p className="text-sm text-gray-800">No results found for this job. This can happen if the supplier has no normalized products or no sources returned matches.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-xl font-bold text-green-600">{scanResults.length}</div>
                    <div className="text-sm text-green-600">Total Results</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-xl font-bold text-blue-600">
                      {scanResults.filter(r => r.isLowestPrice).length}
                    </div>
                    <div className="text-sm text-blue-600">Lowest Prices</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <div className="text-xl font-bold text-yellow-600">
                      {scanResults.filter(r => {
                        const score = typeof r.confidenceScore === 'object' && r.confidenceScore !== null 
                          ? parseFloat(r.confidenceScore.toString()) 
                          : parseFloat(String(r.confidenceScore || '0'));
                        return score >= 0.8;
                      }).length}
                    </div>
                    <div className="text-sm text-yellow-600">High Confidence</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-xl font-bold text-purple-600">
                      {new Set(scanResults.map(r => r.normalizedProductId)).size}
                    </div>
                    <div className="text-sm text-purple-600">Products Found</div>
                  </div>
                </div>
              )}
            </Card>

            {scanResults.length > 0 && (
              <PriceResultsTable 
                results={scanResults} 
                normalizedProducts={normalizedProducts}
                onExport={handleExport}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
