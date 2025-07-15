// FGA Admin Dashboard for managing policies, roles, and permissions
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Plus, Edit, Trash2, Shield, Users, Settings, Eye } from 'lucide-react';
import { useRoles, useFGADebug } from '../../authorization/hooks/useFGA.js';
import { Permissions, Roles, PolicyType, PolicyEffect } from '../../authorization/models/index.js';
import fgaService from '../../authorization/FGAService.js';

function FGAAdminDashboard() {
  const { hasRole } = useRoles();
  const { getCacheStats, clearCache, getAllPolicies } = useFGADebug();
  
  const [activeTab, setActiveTab] = useState('policies');
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cacheStats, setCacheStats] = useState(null);

  // Check if user has admin permissions
  const isAdmin = hasRole(Roles.SUPER_ADMIN) || hasRole(Roles.ORG_ADMIN);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, loadData]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [policiesData, statsData] = await Promise.all([
        getAllPolicies(),
        getCacheStats()
      ]);
      setPolicies(policiesData);
      setCacheStats(statsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getAllPolicies, getCacheStats]);

  const handleClearCache = () => {
    clearCache();
    setCacheStats(getCacheStats());
  };

  if (!isAdmin) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center">
          <Shield className="w-6 h-6 text-red-500 mr-2" />
          <h2 className="text-lg font-semibold text-red-800">Access Denied</h2>
        </div>
        <p className="text-red-700 mt-2">
          You need administrator privileges to access the FGA management dashboard.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600">Loading FGA data...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fine-Grained Authorization Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Manage policies, relationships, and permissions for your organization
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'policies', label: 'Policies', icon: Settings },
            { id: 'cache', label: 'Cache Management', icon: Shield },
            { id: 'debug', label: 'Debug Info', icon: Eye }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group inline-flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'policies' && <PoliciesTab policies={policies} onRefresh={loadData} />}
      {activeTab === 'cache' && <CacheTab stats={cacheStats} onClearCache={handleClearCache} />}
      {activeTab === 'debug' && <DebugTab policies={policies} />}
    </div>
  );
}

// Policies Management Tab
function PoliciesTab({ policies, onRefresh }) {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Authorization Policies</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Policy
        </button>
      </div>

      <div className="grid gap-4">
        {policies.map(policy => (
          <PolicyCard key={policy.id} policy={policy} onRefresh={onRefresh} />
        ))}
      </div>

      {showCreateModal && (
        <CreatePolicyModal 
          onClose={() => setShowCreateModal(false)} 
          onCreated={onRefresh}
        />
      )}
    </div>
  );
}

function PolicyCard({ policy, onRefresh }) {
  const handleToggleEnabled = async () => {
    try {
      await fgaService.updatePolicy(policy.id, { enabled: !policy.enabled });
      onRefresh();
    } catch (error) {
      console.error('Failed to toggle policy:', error);
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case PolicyType.RBAC: return 'bg-blue-100 text-blue-800';
      case PolicyType.REBAC: return 'bg-green-100 text-green-800';
      case PolicyType.ABAC: return 'bg-purple-100 text-purple-800';
      case PolicyType.HYBRID: return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEffectColor = (effect) => {
    return effect === PolicyEffect.ALLOW 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-lg font-medium text-gray-900">{policy.name}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(policy.type)}`}>
              {policy.type}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEffectColor(policy.effect)}`}>
              {policy.effect}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              policy.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {policy.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          
          <p className="text-gray-600 text-sm mb-2">{policy.description}</p>
          
          <div className="text-xs text-gray-500">
            Priority: {policy.priority} | Created: {new Date(policy.createdAt?.toDate?.() || policy.createdAt).toLocaleDateString()}
          </div>
          
          {/* Policy Details */}
          <div className="mt-3 space-y-1 text-sm">
            {policy.roles && policy.roles.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">Roles:</span> {policy.roles.join(', ')}
              </div>
            )}
            {policy.permissions && policy.permissions.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">Permissions:</span> {policy.permissions.slice(0, 3).join(', ')}
                {policy.permissions.length > 3 && ` +${policy.permissions.length - 3} more`}
              </div>
            )}
            {policy.relationships && policy.relationships.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">Relationships:</span> {policy.relationships.join(', ')}
              </div>
            )}
            {policy.conditions && policy.conditions.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">Conditions:</span> {policy.conditions.length} condition(s)
              </div>
            )}
          </div>
        </div>
        
        <div className="flex space-x-2 ml-4">
          <button
            onClick={handleToggleEnabled}
            className={`p-2 rounded-lg transition-colors ${
              policy.enabled 
                ? 'text-red-600 hover:bg-red-50' 
                : 'text-green-600 hover:bg-green-50'
            }`}
            title={policy.enabled ? 'Disable Policy' : 'Enable Policy'}
          >
            <Shield className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Cache Management Tab
function CacheTab({ stats, onClearCache }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Authorization Cache</h2>
        <button
          onClick={onClearCache}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
        >
          Clear Cache
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Cache Size</h3>
          <p className="text-2xl font-semibold text-gray-900">{stats?.size || 0}</p>
          <p className="text-sm text-gray-600">entries</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Cache Timeout</h3>
          <p className="text-2xl font-semibold text-gray-900">{Math.round((stats?.timeout || 0) / 60000)}</p>
          <p className="text-sm text-gray-600">minutes</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Memory Usage</h3>
          <p className="text-2xl font-semibold text-gray-900">~{Math.round((stats?.size || 0) * 0.5)}</p>
          <p className="text-sm text-gray-600">KB (estimated)</p>
        </div>
      </div>

      {stats?.entries && stats.entries.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Cached Entries</h3>
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="max-h-64 overflow-y-auto">
              {stats.entries.map((entry, index) => (
                <div key={index} className="px-4 py-2 border-b border-gray-100 last:border-b-0">
                  <code className="text-sm text-gray-700">{entry}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Debug Information Tab
function DebugTab({ policies }) {
  const policyTypeStats = policies.reduce((acc, policy) => {
    acc[policy.type] = (acc[policy.type] || 0) + 1;
    return acc;
  }, {});

  const enabledPolicies = policies.filter(p => p.enabled).length;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Debug Information</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Policy Statistics</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Total Policies:</span>
              <span className="font-medium">{policies.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Enabled Policies:</span>
              <span className="font-medium text-green-600">{enabledPolicies}</span>
            </div>
            <div className="flex justify-between">
              <span>Disabled Policies:</span>
              <span className="font-medium text-red-600">{policies.length - enabledPolicies}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Policy Types</h3>
          <div className="space-y-2">
            {Object.entries(policyTypeStats).map(([type, count]) => (
              <div key={type} className="flex justify-between">
                <span className="capitalize">{type}:</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">FGA Service Status:</span>
            <span className="ml-2 text-green-600">Active</span>
          </div>
          <div>
            <span className="font-medium">Authorization Engine:</span>
            <span className="ml-2">Hybrid (RBAC + ReBAC + ABAC)</span>
          </div>
          <div>
            <span className="font-medium">Policy Store:</span>
            <span className="ml-2">Firebase Firestore</span>
          </div>
          <div>
            <span className="font-medium">Relationship Store:</span>
            <span className="ml-2">Firebase Firestore</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Create Policy Modal (simplified)
function CreatePolicyModal({ onClose, onCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: PolicyType.RBAC,
    effect: PolicyEffect.ALLOW,
    enabled: true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fgaService.createPolicy(formData);
      onCreated();
      onClose();
    } catch (error) {
      console.error('Failed to create policy:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Create New Policy</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              rows={3}
            />
          </div>
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

PoliciesTab.propTypes = {
  policies: PropTypes.array.isRequired,
  onRefresh: PropTypes.func.isRequired
};

PolicyCard.propTypes = {
  policy: PropTypes.object.isRequired,
  onRefresh: PropTypes.func.isRequired
};

CacheTab.propTypes = {
  stats: PropTypes.object,
  onClearCache: PropTypes.func.isRequired
};

DebugTab.propTypes = {
  policies: PropTypes.array.isRequired
};

CreatePolicyModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func.isRequired
};

export default FGAAdminDashboard;
