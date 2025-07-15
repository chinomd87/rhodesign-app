// MFA Status Indicator Component
// Shows user's current MFA status and provides quick access to configuration

import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, ShieldAlert, Settings, Check, X } from 'lucide-react';
import MFAService from '../services/auth/MFAService';
import MFAIntegrationService from '../services/auth/MFAIntegrationService';
import { useAuth } from '../contexts/AuthContext';

const MFAStatusIndicator = ({ showDetails = false, complianceLevel = 'advanced' }) => {
  const { user } = useAuth();
  const [mfaStatus, setMFAStatus] = useState(null);
  const [complianceStatus, setComplianceStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (user) {
      loadMFAStatus();
    }
  }, [user, complianceLevel]);

  const loadMFAStatus = async () => {
    try {
      setLoading(true);
      
      // Get MFA status
      const status = await MFAService.getMFAStatus(user.uid);
      setMFAStatus(status);

      // Check compliance
      const compliance = await MFAIntegrationService.checkMFACompliance(
        user.uid,
        complianceLevel
      );
      setComplianceStatus(compliance);
    } catch (error) {
      console.error('Failed to load MFA status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureClick = () => {
    window.location.href = '/mfa';
  };

  const getStatusIcon = () => {
    if (loading) {
      return <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />;
    }

    if (!mfaStatus?.enabled) {
      return <ShieldAlert className="w-4 h-4 text-red-500" />;
    }

    if (complianceStatus?.compliant) {
      return <ShieldCheck className="w-4 h-4 text-green-500" />;
    }

    return <Shield className="w-4 h-4 text-yellow-500" />;
  };

  const getStatusColor = () => {
    if (loading) return 'border-gray-200 bg-gray-50';
    if (!mfaStatus?.enabled) return 'border-red-200 bg-red-50';
    if (complianceStatus?.compliant) return 'border-green-200 bg-green-50';
    return 'border-yellow-200 bg-yellow-50';
  };

  const getStatusText = () => {
    if (loading) return 'Checking...';
    if (!mfaStatus?.enabled) return 'MFA Disabled';
    if (complianceStatus?.compliant) return 'MFA Active';
    return 'MFA Partial';
  };

  const getStatusDescription = () => {
    if (loading) return 'Loading MFA status...';
    if (!mfaStatus?.enabled) return 'Multi-factor authentication is not enabled';
    if (complianceStatus?.compliant) return `MFA enabled with ${complianceLevel} compliance`;
    return `MFA enabled but missing requirements for ${complianceLevel} compliance`;
  };

  if (!showDetails) {
    // Compact indicator for navigation bars, etc.
    return (
      <div 
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          onClick={handleConfigureClick}
          className={`p-2 border rounded-lg transition-colors hover:bg-opacity-80 ${getStatusColor()}`}
          title="MFA Status"
        >
          {getStatusIcon()}
        </button>

        {showTooltip && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
            <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap">
              {getStatusDescription()}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Detailed status card
  return (
    <div className={`border rounded-lg p-4 transition-colors ${getStatusColor()}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className="font-medium text-gray-900">{getStatusText()}</span>
        </div>
        <button
          onClick={handleConfigureClick}
          className="text-blue-600 hover:text-blue-800 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-3">
        {getStatusDescription()}
      </p>

      {mfaStatus?.enabled && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Configured Methods:</span>
            <span className="font-medium">{mfaStatus.methods?.length || 0}</span>
          </div>
          
          {mfaStatus.methods?.map((method) => (
            <div key={method} className="flex items-center justify-between text-sm">
              <span className="text-gray-600 capitalize">{method}</span>
              <Check className="w-4 h-4 text-green-500" />
            </div>
          ))}

          {complianceStatus && !complianceStatus.compliant && (
            <div className="mt-3 p-2 bg-yellow-100 border border-yellow-200 rounded">
              <p className="text-xs text-yellow-800 font-medium">Missing Methods:</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {complianceStatus.missingMethods?.map((method) => (
                  <span 
                    key={method}
                    className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded capitalize"
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!mfaStatus?.enabled && (
        <div className="mt-3">
          <button
            onClick={handleConfigureClick}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            Enable MFA
          </button>
        </div>
      )}
    </div>
  );
};

export default MFAStatusIndicator;
