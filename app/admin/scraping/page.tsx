'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card, { CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import BackButton from '@/components/ui/BackButton';
import { 
  Upload, 
  Search, 
  TrendingUp, 
  AlertTriangle,
  Globe,
  Clock,
  Database,
  BarChart3,
  Settings,
  Play,
  History,
  FileText
} from 'lucide-react';

interface ScrapingStats {
  totalSuppliers: number;
  totalProducts: number;
  activeJobs: number;
  lastScraped: Date | null;
  totalScrapedResults: number;
  recentOpportunities: number;
  averageMargin: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

export default function ScrapingDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<ScrapingStats>({
    totalSuppliers: 0,
    totalProducts: 0,
    activeJobs: 0,
    lastScraped: null,
    totalScrapedResults: 0,
    recentOpportunities: 0,
    averageMargin: 0,
    healthStatus: 'healthy'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await fetch('/api/admin/scraping/stats');
        if (!res.ok) throw new Error('Failed to load stats');
        const data = await res.json();
        setStats({
          totalSuppliers: data.totalSuppliers ?? 0,
          totalProducts: data.totalProducts ?? 0,
          activeJobs: data.activeJobs ?? 0,
          lastScraped: data.lastScraped ? new Date(data.lastScraped) : null,
          totalScrapedResults: data.totalScrapedResults ?? 0,
          recentOpportunities: data.recentOpportunities ?? 0,
          averageMargin: data.averageMargin ?? 0,
          healthStatus: (data.healthStatus || 'healthy') as any,
        });
        const ares = await fetch('/api/admin/scraping/alerts?limit=10');
        if (ares.ok) {
          const adata = await ares.json();
          setAlerts(adata.alerts || []);
        }
      } catch (e) {
        console.error('Failed to load scraping stats', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadStats();
  }, []);

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return <Badge label="Healthy" variant="success" />;
      case 'degraded':
        return <Badge label="Degraded" variant="warning" />;
      case 'unhealthy':
        return <Badge label="Unhealthy" variant="danger" />;
      default:
        return <Badge label="Unknown" variant="neutral" />;
    }
  };

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  const quickActions = [
    {
      title: 'Import Supplier Data',
      description: 'Upload and normalize CSV/XLSX files from suppliers',
      icon: Upload,
      action: () => router.push('/admin/scraping/import'),
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      title: 'Start Price Scanning',
      description: 'Find lowest retail prices for your products',
      icon: Search,
      action: () => router.push('/admin/scraping/price-scan'),
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      title: 'View Results',
      description: 'Browse scraped prices and margin analysis',
      icon: TrendingUp,
      action: () => router.push('/admin/scraping/results'),
      color: 'bg-purple-500 hover:bg-purple-600'
    },
    {
      title: 'Configure Sources',
      description: 'Manage scraping sources and settings',
      icon: Settings,
      action: () => router.push('/admin/scraping/sources'),
      color: 'bg-orange-500 hover:bg-orange-600'
    }
  ];

  const recentActivity = [
    {
      id: 1,
      type: 'import',
      message: 'Supplier "Luxury Fragrances Ltd" data imported successfully',
      timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      status: 'success'
    },
    {
      id: 2,
      type: 'scan',
      message: 'Price scanning job completed for 1247 products',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      status: 'success'
    },
    {
      id: 3,
      type: 'opportunity',
      message: '23 new margin opportunities detected',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      status: 'info'
    },
    {
      id: 4,
      type: 'error',
      message: 'Amazon DE scraper temporarily unavailable',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      status: 'warning'
    }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'import':
        return <Upload className="h-4 w-4" />;
      case 'scan':
        return <Search className="h-4 w-4" />;
      case 'opportunity':
        return <TrendingUp className="h-4 w-4" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getActivityColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'info':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

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
        {/* Back Button */}
        <BackButton href="/admin/dashboard">
          Back to Main Dashboard
        </BackButton>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Scraping Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Monitor and manage your web scraping operations for supplier data and price intelligence
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalProducts.toLocaleString()}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Globe className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Suppliers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalSuppliers}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Average Margin</p>
                <p className="text-2xl font-bold text-gray-900">{stats.averageMargin}%</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Opportunities</p>
                <p className="text-2xl font-bold text-gray-900">{stats.recentOpportunities}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={index}
                    onClick={action.action}
                    className={`${action.color} text-white h-auto p-6 flex flex-col items-center gap-3`}
                  >
                    <Icon className="h-8 w-8" />
                    <div className="text-center">
                      <div className="font-semibold">{action.title}</div>
                      <div className="text-sm opacity-90">{action.description}</div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* System Status and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Overall Health</span>
                  {getHealthBadge(stats.healthStatus)}
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Active Jobs</span>
                  <Badge label={stats.activeJobs.toString()} variant="neutral" />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last Scraped</span>
                  <span className="text-sm text-gray-900">{formatTimeAgo(stats.lastScraped)}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Results</span>
                  <span className="text-sm font-medium text-gray-900">{stats.totalScrapedResults.toLocaleString()}</span>
                </div>
                
                <div className="pt-4">
                  <Button variant="outline" className="w-full" onClick={() => router.push('/admin/scraping/status')}>
                    <Settings className="h-4 w-4 mr-2" />
                    View Detailed Status
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-sm text-gray-500">No alerts</div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
                      <Badge label={a.alertType} variant="warning" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{a.message}</p>
                        <p className="text-xs text-gray-500 mt-1">{new Date(a.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="pt-4">
                <Button variant="outline" className="w-full" onClick={() => router.push('/admin/scraping/results')}>
                  <History className="h-4 w-4 mr-2" />
                  View Results
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
