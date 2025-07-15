// React component for timestamp management and visualization
import React, { useState, useEffect } from 'react';
import { Clock, Shield, CheckCircle, AlertTriangle, Info, Calendar } from 'lucide-react';
import TrustedTimestampService from '../../services/timestamping/TrustedTimestampService';
import TimestampIntegrationService from '../../services/timestamping/TimestampIntegrationService';

const TimestampDashboard = ({ documentId, userId }) => {
  const [timestamps, setTimestamps] = useState([]);
  const [providers, setProviders] = useState({});
  const [healthStatus, setHealthStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTimestamp, setSelectedTimestamp] = useState(null);

  useEffect(() => {
    loadTimestampData();
  }, [documentId, userId]);

  const loadTimestampData = async () => {
    try {
      setLoading(true);

      // Load timestamps
      const timestampFilters = {};
      if (documentId) timestampFilters.documentId = documentId;
      if (userId) timestampFilters.userId = userId;

      const timestampList = await TrustedTimestampService.listTimestamps(timestampFilters);
      setTimestamps(timestampList);

      // Load provider information
      const providerStats = TrustedTimestampService.getProviderStats();
      setProviders(providerStats);

      // Check provider health
      const health = await TrustedTimestampService.healthCheck();
      setHealthStatus(health);

    } catch (error) {
      console.error('Failed to load timestamp data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTimestamp = async (data, options = {}) => {
    try {
      const result = await TrustedTimestampService.createTimestamp(data, options);
      await loadTimestampData(); // Refresh the list
      return result;
    } catch (error) {
      console.error('Failed to create timestamp:', error);
      throw error;
    }
  };

  const verifyTimestamp = async (timestampId) => {
    try {
      const timestamp = await TrustedTimestampService.getTimestamp(timestampId);
      // For verification, we would need the original data
      // This is a simplified example
      console.log('Timestamp verification would be performed here');
    } catch (error) {
      console.error('Failed to verify timestamp:', error);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  };

  const getProviderBadgeColor = (provider) => {
    const info = providers[provider];
    if (!info) return 'bg-gray-100 text-gray-800';
    
    if (info.qualified) {
      return 'bg-green-100 text-green-800';
    }
    return 'bg-blue-100 text-blue-800';
  };

  const getHealthStatusIcon = (status) => {
    if (!status || !status.available) {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading timestamps...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3">
          <Clock className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Trusted Timestamps</h1>
            <p className="text-gray-600">RFC 3161 compliant timestamping for legal enforceability</p>
          </div>
        </div>
      </div>

      {/* Provider Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Shield className="h-5 w-5 text-green-600 mr-2" />
          Timestamp Authorities
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(providers).map(([key, provider]) => (
            <div key={key} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">{provider.name}</h3>
                {getHealthStatusIcon(healthStatus[key])}
              </div>
              
              <div className="space-y-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getProviderBadgeColor(key)}`}>
                  {provider.qualified ? 'Qualified' : 'Standard'}
                </span>
                
                <p className="text-sm text-gray-600">Region: {provider.region}</p>
                <p className="text-sm text-gray-600">Reliability: {provider.reliability}</p>
                
                {healthStatus[key] && (
                  <p className="text-xs text-gray-500">
                    Response: {healthStatus[key].responseTime || 'N/A'}ms
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timestamps List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Calendar className="h-5 w-5 text-blue-600 mr-2" />
            Timestamp History
            <span className="ml-2 bg-gray-100 text-gray-800 text-sm px-2 py-1 rounded-full">
              {timestamps.length}
            </span>
          </h2>
        </div>

        {timestamps.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p>No timestamps found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {timestamps.map((timestamp) => (
              <div
                key={timestamp.id}
                className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedTimestamp(timestamp)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <Clock className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {formatTimestamp(timestamp.createdAt)}
                        </p>
                        <p className="text-sm text-gray-600">
                          Provider: {providers[timestamp.provider]?.name || timestamp.provider}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                      <span>Algorithm: {timestamp.hashAlgorithm}</span>
                      <span>Hash: {timestamp.hash.substring(0, 16)}...</span>
                      <span>Size: {timestamp.data} bytes</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      timestamp.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {timestamp.status}
                    </span>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        verifyTimestamp(timestamp.id);
                      }}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      Verify
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timestamp Detail Modal */}
      {selectedTimestamp && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Info className="h-5 w-5 text-blue-600 mr-2" />
                  Timestamp Details
                </h3>
                <button
                  onClick={() => setSelectedTimestamp(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Timestamp ID</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">{selectedTimestamp.timestampId}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Created</label>
                  <p className="mt-1 text-sm text-gray-900">{formatTimestamp(selectedTimestamp.createdAt)}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Provider</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {providers[selectedTimestamp.provider]?.name || selectedTimestamp.provider}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Algorithm</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedTimestamp.hashAlgorithm}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Data Hash</label>
                <p className="mt-1 text-sm text-gray-900 font-mono break-all">{selectedTimestamp.hash}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Compliance</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {providers[selectedTimestamp.provider]?.compliance?.map((standard) => (
                    <span
                      key={standard}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {standard}
                    </span>
                  )) || (
                    <span className="text-sm text-gray-500">No compliance information</span>
                  )}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => verifyTimestamp(selectedTimestamp.id)}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
                >
                  Verify Timestamp
                </button>
                <button
                  onClick={() => setSelectedTimestamp(null)}
                  className="flex-1 bg-gray-100 text-gray-900 px-4 py-2 rounded-md hover:bg-gray-200 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimestampDashboard;
