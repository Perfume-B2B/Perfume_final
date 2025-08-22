'use client';

import React, { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { useRouter } from 'next/navigation';
import { RefreshCcw, ArrowLeft, BarChart3, StopCircle, Trash2 } from 'lucide-react';

interface StatsResponse {
  totalSuppliers: number;
  totalProducts: number;
  activeJobs: number;
  lastScraped: string | null;
  totalScrapedResults: number;
  recentOpportunities: number;
  averageMargin: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

export default function ScrapingStatusPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [statsRes, jobsRes, sourcesRes] = await Promise.all([
        fetch('/api/admin/scraping/stats'),
        fetch('/api/admin/scraping/price-scan'),
        fetch('/api/admin/scraping/sources'),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs(data.jobs || []);
      }
      if (sourcesRes.ok) {
        const data = await sourcesRes.json();
        setSources(data.sources || []);
      }
    } catch (e) {
      console.error('Failed to load status data', e);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (iso: string | null) => {
    if (!iso) return 'Never';
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  const handleStopJob = async (jobId: string) => {
    setActionLoading(jobId);
    try {
      const response = await fetch(`/api/admin/scraping/jobs/${jobId}/stop`, {
        method: 'POST',
      });
      
      if (response.ok) {
        await loadAll(); // Refresh the data
      } else {
        const error = await response.json();
        alert(`Failed to stop job: ${error.error}`);
      }
    } catch (error) {
      console.error('Error stopping job:', error);
      alert('Failed to stop job. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return;
    }

    setActionLoading(jobId);
    try {
      const response = await fetch(`/api/admin/scraping/jobs/${jobId}/delete`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        await loadAll(); // Refresh the data
      } else {
        const error = await response.json();
        alert(`Failed to delete job: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting job:', error);
      alert('Failed to delete job. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.push('/admin/scraping')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Scraping Status</h1>
          </div>
          <Button variant="outline" onClick={loadAll}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" /> Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{stats?.totalProducts ?? 0}</div>
                    <div className="text-sm text-blue-600">Total Products</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{stats?.totalSuppliers ?? 0}</div>
                    <div className="text-sm text-green-600">Total Suppliers</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{stats?.activeJobs ?? 0}</div>
                    <div className="text-sm text-purple-600">Active Jobs</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{stats?.averageMargin ?? 0}%</div>
                    <div className="text-sm text-yellow-600">Avg Margin</div>
                  </div>
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <div className="text-2xl font-bold text-indigo-600">{stats?.recentOpportunities ?? 0}</div>
                    <div className="text-sm text-indigo-600">Opportunities</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600">Last Scraped</div>
                    <div className="text-base font-medium text-gray-900">{formatTimeAgo(stats?.lastScraped || null)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Jobs */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <div className="text-center text-gray-500 py-6">No recent jobs</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {jobs.map((j) => (
                          <tr key={j.id}>
                            <td className="px-4 py-2 font-medium text-gray-900">{j.name}</td>
                            <td className="px-4 py-2">
                              {j.status === 'RUNNING' && <Badge label="Running" variant="warning" />}
                              {j.status === 'PENDING' && <Badge label="Pending" variant="neutral" />}
                              {j.status === 'COMPLETED' && <Badge label="Completed" variant="success" />}
                              {j.status === 'FAILED' && <Badge label="Failed" variant="danger" />}
                              {j.status === 'STOPPED' && <Badge label="Stopped" variant="neutral" />}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-700">
                              {j.totalProducts > 0 ? `${j.processedProducts}/${j.totalProducts} (${Math.round((j.processedProducts / j.totalProducts) * 100)}%)` : '—'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-700">{j.startedAt ? new Date(j.startedAt).toLocaleString() : '—'}</td>
                            <td className="px-4 py-2 text-sm text-gray-700">{j.completedAt ? new Date(j.completedAt).toLocaleString() : '—'}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                {(j.status === 'RUNNING' || j.status === 'PENDING') && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleStopJob(j.id)}
                                    disabled={actionLoading === j.id}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                  >
                                    {actionLoading === j.id ? (
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                                    ) : (
                                      <StopCircle className="h-3 w-3" />
                                    )}
                                    <span className="ml-1">Stop</span>
                                  </Button>
                                )}
                                {(j.status === 'COMPLETED' || j.status === 'FAILED' || j.status === 'STOPPED') && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteJob(j.id)}
                                    disabled={actionLoading === j.id}
                                    className="text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                                  >
                                    {actionLoading === j.id ? (
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
                                    ) : (
                                      <Trash2 className="h-3 w-3" />
                                    )}
                                    <span className="ml-1">Delete</span>
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sources Health */}
            <Card>
              <CardHeader>
                <CardTitle>Sources</CardTitle>
              </CardHeader>
              <CardContent>
                {sources.length === 0 ? (
                  <div className="text-center text-gray-500 py-6">No sources configured</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rate Limit</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Health</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sources.map((s) => (
                          <tr key={s.id}>
                            <td className="px-4 py-2 font-medium text-gray-900">{s.name}</td>
                            <td className="px-4 py-2 text-gray-700">{s.country}</td>
                            <td className="px-4 py-2">{s.priority}</td>
                            <td className="px-4 py-2">{s.rateLimit}/hr</td>
                            <td className="px-4 py-2">
                              {s.healthStatus === 'HEALTHY' && <Badge label="Healthy" variant="success" />}
                              {s.healthStatus === 'DEGRADED' && <Badge label="Degraded" variant="warning" />}
                              {s.healthStatus === 'UNHEALTHY' && <Badge label="Unhealthy" variant="danger" />}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-700">{s.isActive ? 'Yes' : 'No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
