"use client";

import { useState, useEffect } from "react";
import Card, { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { 
  Settings, 
  Users, 
  Shield, 
  Database, 
  Bell, 
  Globe,
  ShoppingCart,
  Package,
  ExternalLink,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  CreditCard,
  UserPlus,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Lock,
  Unlock,
  Receipt
} from "lucide-react";
import Modal from "@/components/ui/Modal";

interface Integration {
  id: string;
  platform: string;
  isActive: boolean;
  apiKey?: string;
  apiSecret?: string;
  webhookUrl?: string;
  settings?: any;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  username: string;
  email?: string;
  role: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  customerId?: string;
  customer?: {
    id: string;
    name: string;
  };
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ClientRole {
  id: string;
  name: string;
  permissions: string[];
  userCount: number;
  createdAt: string;
}

export default function SettingsClient() {
  const [activeTab, setActiveTab] = useState("integrations");
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [clientRoles, setClientRoles] = useState<ClientRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingIntegration, setEditingIntegration] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  // POS receipt template editor state
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptHeader, setReceiptHeader] = useState("Project X Store\n123 Example St\nCity, NL");
  const [receiptFooter, setReceiptFooter] = useState("Thank you for your purchase!\nwww.example.com");
  const [receiptNotes, setReceiptNotes] = useState("");
  const [autoPrint, setAutoPrint] = useState(true);
  const [includeDescriptions, setIncludeDescriptions] = useState(true);
  const [includeQr, setIncludeQr] = useState(false);
  const loadReceiptSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings/pos/receipt');
      if (res.ok) {
        const s = await res.json();
        setReceiptHeader(s.header ?? receiptHeader);
        setReceiptFooter(s.footer ?? receiptFooter);
        setReceiptNotes(s.notes ?? "");
        setAutoPrint(Boolean(s.autoPrint));
        setIncludeDescriptions(Boolean(s.includeDescriptions));
        setIncludeQr(Boolean(s.includeQr));
      }
    } catch (e) {
      console.error('Failed to load POS receipt settings', e);
    }
  };
  const saveReceiptSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings/pos/receipt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          header: receiptHeader,
          footer: receiptFooter,
          notes: receiptNotes,
          autoPrint,
          includeDescriptions,
          includeQr,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Failed to save');
      }
    } catch (e) {
      alert((e as Error).message);
    }
  };
  useEffect(() => { loadReceiptSettings(); }, []);

  useEffect(() => {
    fetchIntegrations();
    fetchUsers();
    fetchClientRoles();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch("/api/admin/integrations");
      if (response.ok) {
        const data = await response.json();
        setIntegrations(data);
      }
    } catch (error) {
      console.error("Error fetching integrations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : []);
      } else {
        console.error("Failed to fetch users");
        setUsers([]);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    }
  };

  const fetchClientRoles = async () => {
    try {
      const response = await fetch("/api/admin/client-roles");
      if (response.ok) {
        const data = await response.json();
        setClientRoles(Array.isArray(data) ? data : []);
      } else {
        console.error("Failed to fetch client roles");
        setClientRoles([]);
      }
    } catch (error) {
      console.error("Error fetching client roles:", error);
      setClientRoles([]);
    }
  };

  const handleIntegrationToggle = async (integrationId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/integrations/${integrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      if (response.ok) {
        setIntegrations(prev => 
          prev.map(integration => 
            integration.id === integrationId 
              ? { ...integration, isActive }
              : integration
          )
        );
      }
    } catch (error) {
      console.error("Error updating integration:", error);
    }
  };

  const handleUserStatusToggle = async (userId: string, newStatus: "ACTIVE" | "INACTIVE") => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setUsers(prev => 
          prev.map(user => 
            user.id === userId 
              ? { ...user, status: newStatus }
              : user
          )
        );
      }
    } catch (error) {
      console.error("Error updating user status:", error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setUsers(prev => prev.filter(user => user.id !== userId));
      }
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const filteredUsers = (users || []).filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(userSearchTerm.toLowerCase());
    const matchesRole = userRoleFilter === "all" || user.role === userRoleFilter;
    const matchesStatus = userStatusFilter === "all" || user.status === userStatusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const tabs = [
    { id: "integrations", name: "Integrations", icon: ExternalLink },
    { id: "general", name: "General Settings", icon: Settings },
    { id: "users", name: "User Management", icon: Users },
    { id: "pos", name: "POS Settings", icon: CreditCard },
    { id: "security", name: "Security", icon: Shield },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your application settings and integrations</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === "integrations" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Platform Integrations</h2>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Integration
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading integrations...</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {integrations.map((integration) => (
                  <Card key={integration.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            {integration.platform === "shopify" && <ShoppingCart className="w-5 h-5 text-blue-600" />}
                            {integration.platform === "bol" && <Package className="w-5 h-5 text-blue-600" />}
                            {integration.platform === "amazon" && <ExternalLink className="w-5 h-5 text-blue-600" />}
                          </div>
                          <div>
                            <CardTitle className="text-lg capitalize">{integration.platform}</CardTitle>
                            <CardDescription>
                              {integration.isActive ? "Active" : "Inactive"} • Last updated {new Date(integration.updatedAt).toLocaleDateString()}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge 
                            label={integration.isActive ? "Active" : "Inactive"}
                            variant={integration.isActive ? "success" : "neutral"}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingIntegration(integration.id)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">API Key:</span>
                          <p className="text-gray-600">
                            {integration.apiKey ? "••••••••" + integration.apiKey.slice(-4) : "Not configured"}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Webhook URL:</span>
                          <p className="text-gray-600">
                            {integration.webhookUrl || "Not configured"}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Status:</span>
                          <p className="text-gray-600">
                            {integration.isActive ? "Connected" : "Disconnected"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {integrations.length === 0 && (
                  <Card>
                    <CardContent className="text-center py-8">
                      <ExternalLink className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No integrations configured</h3>
                      <p className="text-gray-600 mb-4">
                        Connect your store to external platforms like Shopify, Bol, or Amazon.
                      </p>
                      <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First Integration
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "general" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="w-5 h-5 mr-2" />
                  General Settings
                </CardTitle>
                <CardDescription>
                  Configure basic application settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Application Name
                    </label>
                    <input
                      type="text"
                      defaultValue="Project X"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Language
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900">
                      <option value="en">English</option>
                      <option value="nl">Dutch</option>
                    </select>
                  </div>
                </div>
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="w-5 h-5 mr-2" />
                  Notification Settings
                </CardTitle>
                <CardDescription>
                  Configure email and push notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input type="checkbox" defaultChecked className="mr-3" />
                    <span className="text-sm text-gray-700">Email notifications for new orders</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" defaultChecked className="mr-3" />
                    <span className="text-sm text-gray-700">Low stock alerts</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3" />
                    <span className="text-sm text-gray-700">Weekly sales reports</span>
                  </label>
                </div>
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "users" && (
          <div className="space-y-6">
            {/* User Management Header */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
                <p className="text-gray-600">Manage user accounts and permissions</p>
              </div>
              <Button onClick={() => setShowAddUserModal(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <select
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      <option value="all">All Roles</option>
                      <option value="ADMIN">Admin</option>
                      <option value="BUYER">Buyer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                                         <select
                       value={userStatusFilter}
                       onChange={(e) => setUserStatusFilter(e.target.value)}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                     >
                      <option value="all">All Status</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="SUSPENDED">Suspended</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" className="w-full">
                      <Filter className="w-4 h-4 mr-2" />
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Users List */}
            <Card>
              <CardHeader>
                <CardTitle>Active Users ({filteredUsers.length})</CardTitle>
                <CardDescription>
                  Manage user accounts, permissions, and access
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{user.username}</h3>
                          <p className="text-sm text-gray-500">{user.email || "No email"}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge 
                              label={user.role}
                              variant={user.role === "ADMIN" ? "success" : "neutral"}
                            />
                            <Badge 
                              label={user.status}
                              variant={
                                user.status === "ACTIVE" ? "success" : 
                                user.status === "SUSPENDED" ? "danger" : "neutral"
                              }
                            />
                            {user.customer && (
                              <Badge 
                                label={user.customer.name}
                                variant="neutral"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingUser(user)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUserStatusToggle(
                            user.id, 
                            user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
                          )}
                        >
                          {user.status === "ACTIVE" ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <Unlock className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                      <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Client Roles */}
            <Card>
              <CardHeader>
                <CardTitle>Client Roles</CardTitle>
                <CardDescription>
                  Manage client roles and permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {clientRoles.map((role) => (
                    <div key={role.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h3 className="font-medium text-gray-900">{role.name}</h3>
                        <p className="text-sm text-gray-500">
                          {role.permissions.length} permissions • {role.userCount} users
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {clientRoles.length === 0 && (
                    <div className="text-center py-8">
                      <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No client roles configured</h3>
                      <p className="text-gray-600">Create client roles to manage permissions.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "pos" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-5 h-5 mr-2" />
                  POS Settings
                </CardTitle>
                <CardDescription>
                  Configure Point of Sale system settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* General POS Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">General Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Default Payment Method
                      </label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900">
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="digital_wallet">Digital Wallet</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tax Rate (%)
                      </label>
                      <input
                        type="number"
                        defaultValue="21"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Receipt Printer
                      </label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900">
                        <option value="none">No Printer</option>
                        <option value="thermal">Thermal Printer</option>
                        <option value="inkjet">Inkjet Printer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Session Timeout (minutes)
                      </label>
                      <input
                        type="number"
                        defaultValue="30"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    </div>
                  </div>
                </div>

                {/* POS Receipt Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="w-5 h-5" />
                      POS Receipt Settings
                    </CardTitle>
                    <CardDescription>
                      Customize the appearance and content of POS receipts
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700">
                          Store Header
                        </label>
                        <textarea
                          value={receiptHeader}
                          onChange={(e) => setReceiptHeader(e.target.value)}
                          placeholder="Enter store name and address..."
                          className="w-full h-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={3}
                        />
                        <p className="text-xs text-gray-500">
                          Use \n for line breaks. Example: Store Name\nAddress\nCity, Country
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700">
                          Store Footer
                        </label>
                        <textarea
                          value={receiptFooter}
                          onChange={(e) => setReceiptFooter(e.target.value)}
                          placeholder="Enter thank you message and website..."
                          className="w-full h-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={3}
                        />
                        <p className="text-xs text-gray-500">
                          Use \n for line breaks. Example: Thank you!\nVisit our website
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-gray-700">
                        Additional Notes
                      </label>
                      <textarea
                        value={receiptNotes}
                        onChange={(e) => setReceiptNotes(e.target.value)}
                        placeholder="Enter any additional notes to display on receipts..."
                        className="w-full h-16 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={2}
                      />
                      <p className="text-xs text-gray-500">
                        Optional notes that will appear on all receipts (e.g., return policy, contact info)
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-gray-700">
                        Receipt Features
                      </label>
                      <div className="space-y-3">
                        <label className="flex items-center">
                          <input 
                            type="checkbox" 
                            className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                            checked={autoPrint} 
                            onChange={(e) => setAutoPrint(e.target.checked)} 
                          />
                          <span className="text-sm text-gray-700">Print receipts automatically after sale</span>
                        </label>
                        <label className="flex items-center">
                          <input 
                            type="checkbox" 
                            className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                            checked={includeDescriptions} 
                            onChange={(e) => setIncludeDescriptions(e.target.checked)} 
                          />
                          <span className="text-sm text-gray-700">Include product descriptions on receipts</span>
                        </label>
                        <label className="flex items-center">
                          <input 
                            type="checkbox" 
                            className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                            checked={includeQr} 
                            onChange={(e) => setIncludeQr(e.target.checked)} 
                          />
                          <span className="text-sm text-gray-700">Include QR code for digital receipts</span>
                        </label>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-gray-200">
                      <Button onClick={saveReceiptSettings} className="w-full">
                        <Save className="w-4 h-4 mr-2" />
                        Save Receipt Settings
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Button onClick={saveReceiptSettings}>
                  <Save className="w-4 h-4 mr-2" />
                  Save POS Settings
                </Button>
              </CardContent>
            </Card>

            {/* Receipt Template Editor Modal */}
            <Modal
              open={receiptModalOpen}
              onOpenChange={setReceiptModalOpen}
              title="Edit Receipt Template"
              description="Customize the printed receipt header, footer and extra notes."
              className="max-w-2xl"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Header</label>
                    <textarea
                      rows={6}
                      value={receiptHeader}
                      onChange={(e) => setReceiptHeader(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Footer</label>
                    <textarea
                      rows={6}
                      value={receiptFooter}
                      onChange={(e) => setReceiptFooter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                  <textarea
                    rows={4}
                    value={receiptNotes}
                    onChange={(e) => setReceiptNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div className="border rounded-md p-3">
                  <div className="text-sm font-medium text-gray-900 mb-2">Print Preview</div>
                  <div className="bg-white border text-sm p-3" style={{ width: "80mm" }}>
                    <div className="text-center whitespace-pre-wrap">{receiptHeader}</div>
                    <hr className="my-2" />
                    <div className="text-center text-gray-700">Items will appear here at runtime</div>
                    <hr className="my-2" />
                    <div className="text-center whitespace-pre-wrap">{receiptFooter}</div>
                    {receiptNotes && (
                      <div className="text-center mt-2 whitespace-pre-wrap">{receiptNotes}</div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setReceiptModalOpen(false)}>Close</Button>
                  <Button onClick={async () => { await saveReceiptSettings(); setReceiptModalOpen(false); }}>
                    <Save className="w-4 h-4 mr-2" /> Save Template
                  </Button>
                </div>
              </div>
            </Modal>
          </div>
        )}

        {activeTab === "security" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Configure security and authentication settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Session Timeout (minutes)
                    </label>
                    <input
                      type="number"
                      defaultValue="30"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password Policy
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900">
                      <option value="standard">Standard</option>
                      <option value="strong">Strong</option>
                      <option value="very-strong">Very Strong</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input type="checkbox" defaultChecked className="mr-3" />
                    <span className="text-sm text-gray-700">Require two-factor authentication for admins</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" defaultChecked className="mr-3" />
                    <span className="text-sm text-gray-700">Audit logging enabled</span>
                  </label>
                </div>
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
} 