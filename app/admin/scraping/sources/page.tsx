'use client';

import React, { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { Plus, Save, RefreshCcw } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Settings } from 'lucide-react';

interface Source {
  id: string;
  name: string;
  baseUrl: string;
  country: string;
  isActive: boolean;
  priority: number;
  rateLimit: number;
  lastScraped?: string | null;
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
}

export default function ScrapingSourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<any | null>(null);

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/scraping/sources');
      const data = await res.json();
      setSources(data.sources || []);
    } catch (e) {
      console.error('Failed to load sources', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = (id: string) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/scraping/sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources }),
      });
    } catch (e) {
      console.error('Failed to save sources', e);
    } finally {
      setSaving(false);
      loadSources();
    }
  };

  const openSettings = (source: any) => {
    setSelectedSource({ ...source, regionPriority: source.regionPriority || ['NL','BE','DE','FR'], includeVAT: source.includeVAT ?? true, includeShipping: source.includeShipping ?? true, allowDomains: source.allowDomains || [], denyDomains: source.denyDomains || [], selectors: source.selectors || { productTitle: '', price: '', availability: '', shipping: '' } });
    setSettingsOpen(true);
  };

  const saveSettings = async () => {
    if (!selectedSource) return;
    // Merge settings into local list and persist minimal fields in PUT for now
    setSources(prev => prev.map(s => s.id === selectedSource.id ? { ...s } : s));
    setSettingsOpen(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Scraping Sources</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadSources} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button onClick={saveChanges} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> Save
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured Sources</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">Loading...</div>
          ) : sources.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No sources configured</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Base URL</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rate Limit</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Health</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Settings</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sources.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-2 font-medium text-gray-900">{s.name}</td>
                      <td className="px-4 py-2 text-gray-700">{s.baseUrl}</td>
                      <td className="px-4 py-2">{s.country}</td>
                      <td className="px-4 py-2">
                        <input type="number" className="w-20 border rounded px-2 py-1" value={s.priority} onChange={(e) => setSources(prev => prev.map(x => x.id === s.id ? { ...x, priority: parseInt(e.target.value || '0', 10) } : x))} />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" className="w-24 border rounded px-2 py-1" value={s.rateLimit} onChange={(e) => setSources(prev => prev.map(x => x.id === s.id ? { ...x, rateLimit: parseInt(e.target.value || '0', 10) } : x))} />
                      </td>
                      <td className="px-4 py-2">
                        {s.healthStatus === 'HEALTHY' && <Badge label="Healthy" variant="success" />}
                        {s.healthStatus === 'DEGRADED' && <Badge label="Degraded" variant="warning" />}
                        {s.healthStatus === 'UNHEALTHY' && <Badge label="Unhealthy" variant="danger" />}
                      </td>
                      <td className="px-4 py-2">
                        <label className="inline-flex items-center gap-2">
                          <input type="checkbox" checked={s.isActive} onChange={() => toggleActive(s.id)} />
                          <span className="text-sm text-gray-700">Active</span>
                        </label>
                      </td>
                      <td className="px-4 py-2">
                        <Button variant="outline" size="sm" onClick={() => openSettings(s)}>
                          <Settings className="h-4 w-4 mr-1" /> Configure
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings Modal */}
      <Modal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title={selectedSource ? `Settings: ${selectedSource.name}` : 'Settings'}
      >
        {selectedSource && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Region Priority (comma-separated)</label>
              <Input
                value={(selectedSource.regionPriority || []).join(',')}
                onChange={(e) => setSelectedSource({ ...selectedSource, regionPriority: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={!!selectedSource.includeVAT} onChange={(e) => setSelectedSource({ ...selectedSource, includeVAT: e.target.checked })} />
                <span className="text-sm text-gray-700">Include VAT</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={!!selectedSource.includeShipping} onChange={(e) => setSelectedSource({ ...selectedSource, includeShipping: e.target.checked })} />
                <span className="text-sm text-gray-700">Include Shipping</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Allow Domains (comma-separated)</label>
              <Input
                value={(selectedSource.allowDomains || []).join(',')}
                onChange={(e) => setSelectedSource({ ...selectedSource, allowDomains: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deny Domains (comma-separated)</label>
              <Input
                value={(selectedSource.denyDomains || []).join(',')}
                onChange={(e) => setSelectedSource({ ...selectedSource, denyDomains: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selector: Product Title</label>
                <Input value={selectedSource.selectors?.productTitle || ''} onChange={(e) => setSelectedSource({ ...selectedSource, selectors: { ...selectedSource.selectors, productTitle: e.target.value } })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selector: Price</label>
                <Input value={selectedSource.selectors?.price || ''} onChange={(e) => setSelectedSource({ ...selectedSource, selectors: { ...selectedSource.selectors, price: e.target.value } })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selector: Availability</label>
                <Input value={selectedSource.selectors?.availability || ''} onChange={(e) => setSelectedSource({ ...selectedSource, selectors: { ...selectedSource.selectors, availability: e.target.value } })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selector: Shipping</label>
                <Input value={selectedSource.selectors?.shipping || ''} onChange={(e) => setSelectedSource({ ...selectedSource, selectors: { ...selectedSource.selectors, shipping: e.target.value } })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
              <Button onClick={saveSettings}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
