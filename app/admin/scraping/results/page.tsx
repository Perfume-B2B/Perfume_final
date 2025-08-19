'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { 
  ArrowLeft, 
  TrendingUp, 
  Filter,
  Calendar,
  Download,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import PriceResultsTable from '@/components/scraping/PriceResultsTable';
import { PriceScrapingResult, NormalizedProductData } from '@/lib/scraping/types';

interface ResultsPageProps {}

export default function ResultsPage({}: ResultsPageProps) {
  const router = useRouter();
  const [results, setResults] = useState<PriceScrapingResult[]>([]);
  const [normalizedProducts, setNormalizedProducts] = useState<NormalizedProductData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  // Mock data for demonstration
  useEffect(() => {
    // Simulate loading data
    setTimeout(() => {
      setNormalizedProducts([
        {
          id: '1',
          supplierId: 'supplier1',
          brand: 'Chanel',
          productName: 'Chanel N°5 Eau de Parfum',
          variantSize: '100ml',
          ean: '1234567890123',
          wholesalePrice: '45.00',
          currency: 'EUR',
          packSize: '1',
          supplierName: 'Luxury Fragrances Ltd',
          lastPurchasePrice: '42.00',
          availability: 'In Stock',
          notes: 'Classic fragrance',
          importSessionId: 'session1'
        },
        {
          id: '2',
          supplierId: 'supplier1',
          brand: 'Dior',
          productName: 'Dior Sauvage Eau de Toilette',
          variantSize: '100ml',
          ean: '1234567890124',
          wholesalePrice: '38.00',
          currency: 'EUR',
          packSize: '1',
          supplierName: 'Luxury Fragrances Ltd',
          lastPurchasePrice: '35.00',
          availability: 'In Stock',
          notes: "Popular men's fragrance",
          importSessionId: 'session1'
        },
        {
          id: '3',
          supplierId: 'supplier2',
          brand: 'Tom Ford',
          productName: 'Black Orchid Eau de Parfum',
          variantSize: '50ml',
          ean: '1234567890125',
          wholesalePrice: '65.00',
          currency: 'EUR',
          packSize: '1',
          supplierName: 'Premium Scents Co',
          lastPurchasePrice: '62.00',
          availability: 'In Stock',
          notes: 'Luxury oriental fragrance',
          importSessionId: 'session2'
        }
      ]);

      // Generate mock historical results
      const mockResults: PriceScrapingResult[] = [];
      const sources = ['Bol.com', 'Amazon NL', 'Amazon DE', 'House of Niche'];
      
      normalizedProducts.forEach((product, productIndex) => {
        sources.forEach((source, sourceIndex) => {
          // Generate results for different dates
          for (let i = 0; i < 3; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (i * 2 + sourceIndex));
            
            const wholesalePrice = parseFloat(product.wholesalePrice);
            const baseRetailPrice = wholesalePrice * (1.2 + Math.random() * 0.6); // 20-80% markup
            const priceVariation = (Math.random() - 0.5) * 0.3; // ±15% variation
            const finalPrice = baseRetailPrice * (1 + priceVariation);
            
            mockResults.push({
              id: `${product.id}-${sourceIndex}-${i}`,
              normalizedProductId: product.id,
              sourceId: source.toLowerCase().replace(/\s+/g, '-'),
              productTitle: `${product.brand} ${product.productName}`,
              merchant: source,
              url: `https://example.com/product/${product.ean}`,
              price: finalPrice.toFixed(2),
              currency: product.currency,
              priceInclVat: true,
              shippingCost: (Math.random() * 5 + 2).toFixed(2),
              availability: Math.random() > 0.1 ? 'In Stock' : 'Limited Stock',
              confidenceScore: (0.7 + Math.random() * 0.3).toFixed(2),
              isLowestPrice: sourceIndex === 0 && i === 0,
              scrapedAt: date,
              jobId: `job-${productIndex}-${sourceIndex}`
            });
          }
        });
      });
      
      setResults(mockResults);
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleExport = (format: 'csv' | 'json') => {
    if (results.length === 0) return;

    if (format === 'csv') {
      const headers = ['Product', 'Brand', 'Merchant', 'Price', 'Currency', 'Confidence', 'Date', 'URL'];
      const csvContent = [
        headers.join(','),
        ...results.map(result => {
          const product = normalizedProducts.find(p => p.id === result.normalizedProductId);
          return [
            `"${product?.productName || 'Unknown'}"`,
            `"${product?.brand || 'Unknown'}"`,
            `"${result.merchant}"`,
            result.price,
            result.currency,
            result.confidenceScore,
            result.scrapedAt.toLocaleDateString(),
            `"${result.url}"`
          ].join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scraping-results-${dateRange}-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      const jsonContent = JSON.stringify(results, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scraping-results-${dateRange}-${Date.now()}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate refresh
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  const getFilteredResults = () => {
    if (dateRange === 'all') return results;
    
    const days = {
      '7d': 7,
      '30d': 30,
      '90d': 90
    } as const;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days[dateRange]);
    
    return results.filter(result => result.scrapedAt >= cutoffDate);
  };

  const getAnalytics = () => {
    const filteredResults = getFilteredResults();
    
    if (filteredResults.length === 0) return null;
    
    const totalProducts = new Set(filteredResults.map(r => r.normalizedProductId)).size;
    const totalSources = new Set(filteredResults.map(r => r.merchant)).size;
    const averagePrice = filteredResults.reduce((sum, r) => sum + parseFloat(r.price), 0) / filteredResults.length;
    const highConfidenceCount = filteredResults.filter(r => parseFloat(r.confidenceScore) >= 0.8).length;
    
    // Calculate margin opportunities
    const opportunities = filteredResults.filter(result => {
      const product = normalizedProducts.find(p => p.id === result.normalizedProductId);
      if (!product) return false;
      
      const wholesalePrice = parseFloat(product.wholesalePrice);
      const retailPrice = parseFloat(result.price);
      const margin = retailPrice - wholesalePrice;
      const marginPercentage = wholesalePrice > 0 ? (margin / wholesalePrice) * 100 : 0;
      
      return margin > 0 && marginPercentage >= 20;
    }).length;
    
    return {
      totalResults: filteredResults.length,
      totalProducts,
      totalSources,
      averagePrice: averagePrice.toFixed(2),
      highConfidenceCount,
      opportunities,
      dateRange
    };
  };

  const analytics = getAnalytics();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/admin/scraping')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Scraping
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Scraping Results</h1>
              <p className="text-gray-800">Browse and analyze historical price scraping data</p>
            </div>
          </div>
        </div>

        {/* Analytics Overview */}
        {analytics && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analytics Overview
                <Badge variant="outline" className="ml-2">
                  {dateRange === '7d' ? 'Last 7 days' : 
                   dateRange === '30d' ? 'Last 30 days' : 
                   dateRange === '90d' ? 'Last 90 days' : 'All time'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{analytics.totalResults}</div>
                  <div className="text-sm text-blue-600">Total Results</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{analytics.totalProducts}</div>
                  <div className="text-sm text-green-600">Products</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{analytics.totalSources}</div>
                  <div className="text-sm text-purple-600">Sources</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">€{analytics.averagePrice}</div>
                  <div className="text-sm text-yellow-600">Avg Price</div>
                </div>
                <div className="text-center p-4 bg-indigo-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">{analytics.highConfidenceCount}</div>
                  <div className="text-sm text-indigo-600">High Confidence</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{analytics.opportunities}</div>
                  <div className="text-sm text-orange-600">Opportunities</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters and Controls */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900">Date Range:</span>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as any)}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm text-gray-900"
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="all">All time</option>
                  </select>
                </div>
                
                <Badge variant="outline" className="text-sm">
                  {getFilteredResults().length} results
                </Badge>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="outline" onClick={() => handleExport('csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button variant="outline" onClick={() => handleExport('json')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        <PriceResultsTable
          results={getFilteredResults()}
          normalizedProducts={normalizedProducts}
          onExport={handleExport}
          onRefresh={handleRefresh}
        />
      </div>
    </div>
  );
}
