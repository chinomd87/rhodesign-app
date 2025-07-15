// Template Dashboard Component
// Comprehensive interface for managing document templates

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  Copy, 
  Edit3, 
  Trash2, 
  Eye, 
  Download,
  Star,
  Users,
  Calendar,
  Tag,
  FolderOpen
} from 'lucide-react';
import DocumentTemplateService from '../../services/templates/DocumentTemplateService';
import { useAuth } from '../../contexts/AuthContext';

const TemplateDashboard = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedIndustry, setSelectedIndustry] = useState('all');
  const [selectedCompliance, setSelectedCompliance] = useState('all');
  const [showPublicOnly, setShowPublicOnly] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [statistics, setStatistics] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      loadTemplates();
      loadStatistics();
    }
  }, [user]);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchTerm, selectedCategory, selectedIndustry, selectedCompliance, showPublicOnly]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const result = await DocumentTemplateService.getUserTemplates(user.uid, {
        includePublic: true,
        limitCount: 100
      });
      setTemplates(result.templates);
    } catch (error) {
      setError('Failed to load templates');
      console.error('Template loading error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const result = await DocumentTemplateService.getTemplateStatistics();
      setStatistics(result.statistics);
    } catch (error) {
      console.error('Statistics loading error:', error);
    }
  };

  const filterTemplates = () => {
    let filtered = templates;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.metadata.tags?.some(tag => 
          tag.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory);
    }

    // Industry filter
    if (selectedIndustry !== 'all') {
      filtered = filtered.filter(template => template.industryType === selectedIndustry);
    }

    // Compliance filter
    if (selectedCompliance !== 'all') {
      filtered = filtered.filter(template => template.complianceLevel === selectedCompliance);
    }

    // Public only filter
    if (showPublicOnly) {
      filtered = filtered.filter(template => template.metadata.isPublic);
    }

    setFilteredTemplates(filtered);
  };

  const handleCreateFromTemplate = async (templateId) => {
    try {
      setError('');
      const result = await DocumentTemplateService.createDocumentFromTemplate(templateId, {
        title: `New Document from Template`,
        createdBy: user.uid
      });

      setSuccess('Document created from template successfully!');
      // Navigate to document editor or show success message
      console.log('Document created:', result.documentData);
    } catch (error) {
      setError(`Failed to create document from template: ${error.message}`);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      setError('');
      await DocumentTemplateService.deleteTemplate(templateId, user.uid);
      setSuccess('Template deleted successfully');
      await loadTemplates();
    } catch (error) {
      setError(`Failed to delete template: ${error.message}`);
    }
  };

  const getComplianceBadgeColor = (level) => {
    const colors = {
      basic: 'bg-blue-100 text-blue-800 border-blue-200',
      advanced: 'bg-purple-100 text-purple-800 border-purple-200',
      qualified: 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[level] || colors.basic;
  };

  const getCategoryIcon = (category) => {
    const icons = {
      contract: FileText,
      legal: FileText,
      hr: Users,
      finance: FileText,
      general: FolderOpen
    };
    const IconComponent = icons[category] || FolderOpen;
    return <IconComponent className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Document Templates</h1>
          <p className="text-gray-600 mt-1">Create, manage, and use document templates</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {viewMode === 'grid' ? 'List View' : 'Grid View'}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Template</span>
          </button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Templates</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Public Templates</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.publicTemplates}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Tag className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Categories</p>
                <p className="text-2xl font-bold text-gray-900">{Object.keys(statistics.categories).length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Star className="w-8 h-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Most Used</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statistics.mostUsed[0]?.usageCount || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="contract">Contracts</option>
            <option value="legal">Legal Documents</option>
            <option value="hr">HR Documents</option>
            <option value="finance">Financial</option>
            <option value="general">General</option>
          </select>

          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Industries</option>
            <option value="technology">Technology</option>
            <option value="healthcare">Healthcare</option>
            <option value="finance">Finance</option>
            <option value="legal">Legal</option>
            <option value="real-estate">Real Estate</option>
            <option value="general">General</option>
          </select>

          <select
            value={selectedCompliance}
            onChange={(e) => setSelectedCompliance(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Compliance Levels</option>
            <option value="basic">Basic</option>
            <option value="advanced">Advanced</option>
            <option value="qualified">Qualified</option>
          </select>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="publicOnly"
              checked={showPublicOnly}
              onChange={(e) => setShowPublicOnly(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="publicOnly" className="text-sm text-gray-700">
              Public only
            </label>
          </div>
        </div>
      </div>

      {/* Templates Display */}
      <div className="bg-white rounded-lg shadow-sm border">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-600">
              {searchTerm || selectedCategory !== 'all' || selectedIndustry !== 'all' 
                ? 'Try adjusting your search criteria'
                : 'Create your first template to get started'}
            </p>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6' 
            : 'divide-y divide-gray-200'
          }>
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className={viewMode === 'grid' 
                  ? 'border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow' 
                  : 'p-6 hover:bg-gray-50 transition-colors'
                }
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {getCategoryIcon(template.category)}
                    <div>
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-600">{template.category}</p>
                    </div>
                  </div>
                  
                  {template.metadata.isPublic && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <Users className="w-3 h-3 mr-1" />
                      Public
                    </span>
                  )}
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {template.description || 'No description provided'}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getComplianceBadgeColor(template.complianceLevel)}`}>
                    {template.complianceLevel}
                  </span>
                  
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {template.industryType}
                  </span>

                  {template.metadata.usageCount > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <Star className="w-3 h-3 mr-1" />
                      {template.metadata.usageCount} uses
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {template.metadata.updatedAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                  </span>
                  <span>{template.fields?.length || 0} fields</span>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleCreateFromTemplate(template.id)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-1"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Use Template</span>
                  </button>
                  
                  <button
                    onClick={() => setSelectedTemplate(template)}
                    className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 flex items-center justify-center"
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {template.metadata.createdBy === user.uid && (
                    <>
                      <button
                        onClick={() => {/* Open edit modal */}}
                        className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 flex items-center justify-center"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="px-3 py-2 border border-red-300 text-red-700 text-sm rounded-lg hover:bg-red-50 flex items-center justify-center"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Template Preview Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Template Preview</h2>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <span className="sr-only">Close</span>
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedTemplate.name}</h3>
                <p className="text-gray-600">{selectedTemplate.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Template Details</h4>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Category:</dt>
                      <dd className="text-gray-900">{selectedTemplate.category}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Industry:</dt>
                      <dd className="text-gray-900">{selectedTemplate.industryType}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Compliance:</dt>
                      <dd className="text-gray-900">{selectedTemplate.complianceLevel}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Fields:</dt>
                      <dd className="text-gray-900">{selectedTemplate.fields?.length || 0}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Settings</h4>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Sequential Signing:</dt>
                      <dd className="text-gray-900">
                        {selectedTemplate.settings?.requireSequentialSigning ? 'Yes' : 'No'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">MFA Required:</dt>
                      <dd className="text-gray-900">
                        {selectedTemplate.settings?.requireMFA ? 'Yes' : 'No'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Expiration:</dt>
                      <dd className="text-gray-900">
                        {selectedTemplate.settings?.expirationDays || 30} days
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {selectedTemplate.fields && selectedTemplate.fields.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Signature Fields</h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Field
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Required
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Position
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedTemplate.fields.map((field, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {field.label}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                              {field.type}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {field.required ? 'Yes' : 'No'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              Page {field.position?.page || 1}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleCreateFromTemplate(selectedTemplate.id);
                    setSelectedTemplate(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Use This Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateDashboard;
