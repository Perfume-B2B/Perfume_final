'use client';

import React, { useState, useMemo } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { 
  Download, 
  Filter, 
  Search, 
  TrendingUp, 
  TrendingDown,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { PriceScrapingResult, NormalizedProductData } from '@/lib/scraping/types';

interface PriceResultsTableProps {
  results: PriceScrapingResult[];
  normalizedProducts: NormalizedProductData[];
  onExport: (format: 'csv' | 'json') => void;
  onRefresh?: () => void;
}

interface EnhancedResult extends PriceScrapingResult {
  normalizedProduct?: NormalizedProductData;
  margin?: number;
  marginPercentage?: number;
  isOpportunity?: boolean;
}

export default function PriceResultsTable({
  results,
  normalizedProducts,
  onExport,
  onRefresh
}: PriceResultsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [marginFilter, setMarginFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('confidenceScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Enhance results with normalized product data and margin calculations
  const enhancedResults = useMemo(() => {
    return results.map(result => {
      const normalizedProduct = normalizedProducts.find(p => p.id === result.normalizedProductId);
      
      if (!normalizedProduct) return result as EnhancedResult;

      // Convert Decimal types to numbers for calculations
      const wholesalePrice = typeof normalizedProduct.wholesalePrice === 'object' && normalizedProduct.wholesalePrice !== null 
        ? parseFloat(normalizedProduct.wholesalePrice.toString()) 
        : parseFloat(String(normalizedProduct.wholesalePrice || '0'));
      
      const retailPrice = typeof result.price === 'object' && result.price !== null 
        ? parseFloat(result.price.toString()) 
        : parseFloat(String(result.price || '0'));
      
      const margin = retailPrice - wholesalePrice;
      const marginPercentage = wholesalePrice > 0 ? (margin / wholesalePrice) * 100 : 0;
      const isOpportunity = margin > 0 && marginPercentage >= 20; // 20% margin threshold

      return {
        ...result,
        normalizedProduct,
        margin,
        marginPercentage,
        isOpportunity
      } as EnhancedResult;
    });
  }, [results, normalizedProducts]);

  // Filter and sort results
  const filteredAndSortedResults = useMemo(() => {
    let filtered = enhancedResults.filter(result => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const productName = result.normalizedProduct?.productName || '';
        const brand = result.normalizedProduct?.brand || '';
        const merchant = result.merchant || '';
        
        if (!productName.toLowerCase().includes(searchLower) &&
            !brand.toLowerCase().includes(searchLower) &&
            !merchant.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Confidence filter
      if (confidenceFilter !== 'all') {
        const confidence = typeof result.confidenceScore === 'object' && result.confidenceScore !== null
          ? parseFloat(result.confidenceScore.toString())
          : parseFloat(String(result.confidenceScore || '0'));
          
        if (confidenceFilter === 'high' && confidence < 0.8) return false;
        if (confidenceFilter === 'medium' && (confidence < 0.6 || confidence >= 0.8)) return false;
        if (confidenceFilter === 'low' && confidence >= 0.6) return false;
      }

      // Margin filter
      if (marginFilter !== 'all') {
        const margin = result.margin || 0;
        if (marginFilter === 'positive' && margin <= 0) return false;
        if (marginFilter === 'negative' && margin >= 0) return false;
        if (marginFilter === 'opportunity' && !result.isOpportunity) return false;
      }

      return true;
    });

    // Sort results
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'confidenceScore':
          aValue = typeof a.confidenceScore === 'object' && a.confidenceScore !== null
            ? parseFloat(a.confidenceScore.toString())
            : parseFloat(String(a.confidenceScore || '0'));
          bValue = typeof b.confidenceScore === 'object' && b.confidenceScore !== null
            ? parseFloat(b.confidenceScore.toString())
            : parseFloat(String(b.confidenceScore || '0'));
          break;
        case 'price':
          aValue = typeof a.price === 'object' && a.price !== null
            ? parseFloat(a.price.toString())
            : parseFloat(String(a.price || '0'));
          bValue = typeof b.price === 'object' && b.price !== null
            ? parseFloat(b.price.toString())
            : parseFloat(String(b.price || '0'));
          break;
        case 'margin':
          aValue = a.margin || 0;
          bValue = b.margin || 0;
          break;
        case 'merchant':
          aValue = a.merchant || '';
          bValue = b.merchant || '';
          break;
        default:
          aValue = typeof a.confidenceScore === 'object' && a.confidenceScore !== null
            ? parseFloat(a.confidenceScore.toString())
            : parseFloat(String(a.confidenceScore || '0'));
          bValue = typeof b.confidenceScore === 'object' && b.confidenceScore !== null
            ? parseFloat(b.confidenceScore.toString())
            : parseFloat(String(b.confidenceScore || '0'));
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [enhancedResults, searchTerm, confidenceFilter, marginFilter, sortBy, sortOrder]);

  const getConfidenceBadge = (score: string) => {
    const confidence = parseFloat(score);
    if (confidence >= 0.8) {
      return <Badge label="High" variant="success" />;
    } else if (confidence >= 0.6) {
      return <Badge label="Medium" variant="warning" />;
    } else {
      return <Badge label="Low" variant="danger" />;
    }
  };

  const getMarginBadge = (margin: number) => {
    if (margin > 0) {
      return <Badge label={`+€${margin.toFixed(2)}`} variant="success" />;
    } else if (margin < 0) {
      return <Badge label={`€${margin.toFixed(2)}`} variant="danger" />;
    } else {
      return <Badge label="€0.00" variant="neutral" />;
    }
  };

  const getOpportunityBadge = (isOpportunity: boolean) => {
    if (isOpportunity) {
      return <Badge label="Opportunity" variant="success" />;
    } else {
      return <Badge label="No Opportunity" variant="neutral" />;
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const SortableHeader = ({ field, label }: { field: string; label: string }) => (
    <th
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortBy === field && (
          <span className="text-gray-400">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Price Scraping Results</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onExport('csv')}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => onExport('json')}>
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
              {onRefresh && (
                <Button variant="outline" onClick={onRefresh}>
                  Refresh
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{filteredAndSortedResults.length}</div>
              <div className="text-sm text-blue-600">Total Results</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {filteredAndSortedResults.filter(r => r.isOpportunity).length}
              </div>
              <div className="text-sm text-green-600">Opportunities</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {filteredAndSortedResults.filter(r => (typeof r.confidenceScore === 'object' ? parseFloat(r.confidenceScore.toString()) : parseFloat(String(r.confidenceScore || '0'))) >= 0.8).length}
              </div>
              <div className="text-sm text-yellow-600">High Confidence</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {filteredAndSortedResults.filter(r => r.margin && r.margin > 0).length}
              </div>
              <div className="text-sm text-purple-600">Positive Margin</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Product, brand, or merchant..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confidence</label>
              <select
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="all">All Levels</option>
                <option value="high">High (≥80%)</option>
                <option value="medium">Medium (60-79%)</option>
                <option value="low">Low (&lt;60%)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Margin</label>
              <select
                value={marginFilter}
                onChange={(e) => setMarginFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="all">All Margins</option>
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
                <option value="opportunity">Opportunities</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="confidenceScore">Confidence</option>
                <option value="price">Price</option>
                <option value="margin">Margin</option>
                <option value="merchant">Merchant</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Merchant
                  </th>
                  <SortableHeader field="price" label="Price" />
                  <SortableHeader field="confidenceScore" label="Confidence" />
                  <SortableHeader field="margin" label="Margin" />
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedResults.map((result, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">
                          {result.normalizedProduct?.productName || 'Unknown Product'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {result.normalizedProduct?.brand} • {result.normalizedProduct?.variantSize}
                        </div>
                        {result.normalizedProduct?.ean && (
                          <div className="text-xs text-gray-400 font-mono">
                            EAN: {result.normalizedProduct.ean}
                          </div>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">{result.merchant}</div>
                        <div className="text-sm text-gray-500">{result.url}</div>
                        {result.availability && (
                          <Badge label={String(result.availability)} variant="neutral" className="text-xs" />
                        )}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">
                          €{(typeof result.price === 'object' ? parseFloat(result.price.toString()) : parseFloat(String(result.price || '0'))).toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {result.currency} • {result.priceInclVat ? 'VAT incl.' : 'VAT excl.'}
                        </div>
                        {result.shippingCost && (
                          <div className="text-xs text-gray-400">
                            +€{(typeof result.shippingCost === 'object' ? parseFloat(result.shippingCost.toString()) : parseFloat(String(result.shippingCost || '0'))).toFixed(2)} shipping
                          </div>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      {getConfidenceBadge(typeof result.confidenceScore === 'object' ? result.confidenceScore.toString() : String(result.confidenceScore || '0'))}
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        {result.margin !== undefined && result.marginPercentage !== undefined && (
                          getMarginBadge(result.margin)
                        )}
                        {result.isOpportunity && getOpportunityBadge(result.isOpportunity)}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(result.url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredAndSortedResults.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No results found matching your criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
