// MFA Configuration Dashboard Component
// Provides comprehensive MFA setup and management interface

import React, { useState, useEffect } from 'react';
import { Shield, Smartphone, Key, Eye, Settings, AlertTriangle, CheckCircle } from 'lucide-react';
import MFAService from '../../services/auth/MFAService';
import MFAIntegrationService from '../../services/auth/MFAIntegrationService';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../firebase/config';

const MFADashboard = () => {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [mfaStatus, setMFAStatus] = useState(null);
  const [complianceStatus, setComplianceStatus] = useState(null);
  const [setupMethod, setSetupMethod] = useState(null);
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [complianceLevel, setComplianceLevel] = useState('advanced');
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      loadMFAStatus();
      checkCompliance();
    }
  }, [user]);

  const loadMFAStatus = async () => {
    try {
      setLoading(true);
      const status = await MFAService.getMFAStatus(user.uid);
      setMFAStatus(status);
    } catch (error) {
      setError('Failed to load MFA status');
      console.error('MFA status error:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkCompliance = async () => {
    try {
      const compliance = await MFAIntegrationService.checkMFACompliance(
        user.uid,
        complianceLevel
      );
      setComplianceStatus(compliance);
    } catch (error) {
      console.error('Compliance check error:', error);
    }
  };

  const handleSetupMFA = async (method) => {
    try {
      setError('');
      setLoading(true);
      setSetupMethod(method);

      let setup;
      switch (method) {
        case 'totp':
          setup = await MFAService.setupTOTP(user.uid);
          break;
        case 'sms':
          if (!phoneNumber) {
            setError('Phone number is required for SMS setup');
            return;
          }
          setup = await MFAService.setupSMS(user.uid, phoneNumber);
          break;
        case 'biometric':
          if (!deviceName) {
            setError('Device name is required for biometric setup');
            return;
          }
          setup = await MFAService.setupBiometric(user.uid, { deviceName });
          break;
        default:
          throw new Error('Unsupported MFA method');
      }

      setSetupData(setup);
    } catch (error) {
      setError(`Failed to setup ${method}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    try {
      setError('');
      setLoading(true);

      const result = await MFAService.verifyMFA(
        user.uid,
        verificationCode,
        setupMethod
      );

      if (result.success) {
        setSuccess(`${setupMethod.toUpperCase()} setup completed successfully!`);
        setSetupMethod(null);
        setSetupData(null);
        setVerificationCode('');
        await loadMFAStatus();
        await checkCompliance();
      } else {
        setError('Invalid verification code');
      }
    } catch (error) {
      setError(`Verification failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMFA = async (method) => {
    try {
      setError('');
      setLoading(true);

      await MFAService.disableMFA(user.uid, method);
      setSuccess(`${method.toUpperCase()} disabled successfully`);
      await loadMFAStatus();
      await checkCompliance();
    } catch (error) {
      setError(`Failed to disable ${method}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupForDocumentSigning = async () => {
    try {
      setError('');
      setLoading(true);

      const setup = await MFAIntegrationService.setupMFAForDocumentSigning(
        user.uid,
        {
          methods: ['totp', 'sms'],
          phoneNumber,
          deviceName: deviceName || 'Document Signing Device',
          complianceLevel
        }
      );

      setSetupData(setup);
      setSuccess('Document signing MFA configured successfully!');
      await loadMFAStatus();
      await checkCompliance();
    } catch (error) {
      setError(`Document signing setup failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getMFAMethodIcon = (method) => {
    const icons = {
      totp: <Key className="w-5 h-5" />,
      sms: <Smartphone className="w-5 h-5" />,
      biometric: <Eye className="w-5 h-5" />
    };
    return icons[method] || <Shield className="w-5 h-5" />;
  };

  const getComplianceLevelBadge = (level) => {
    const badges = {
      basic: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      advanced: 'bg-blue-100 text-blue-800 border-blue-200',
      qualified: 'bg-green-100 text-green-800 border-green-200'
    };
    return badges[level] || badges.basic;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Multi-Factor Authentication</h1>
            <p className="text-gray-600">Secure your account and document signing with additional verification</p>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <p className="text-green-700">{success}</p>
          </div>
        </div>
      )}

      {/* MFA Status Overview */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">MFA Status</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Status</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                mfaStatus?.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {mfaStatus?.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Methods</span>
              <span className="text-sm text-gray-900">
                {mfaStatus?.methods?.length || 0} configured
              </span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Compliance</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                getComplianceLevelBadge(complianceLevel)
              }`}>
                {complianceLevel}
              </span>
            </div>
          </div>
        </div>

        {/* Compliance Status */}
        {complianceStatus && (
          <div className={`border rounded-lg p-4 ${
            complianceStatus.compliant ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'
          }`}>
            <div className="flex items-center">
              {complianceStatus.compliant ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
              )}
              <div>
                <p className={`font-medium ${
                  complianceStatus.compliant ? 'text-green-800' : 'text-yellow-800'
                }`}>
                  {complianceStatus.compliant ? 'Compliance Met' : 'Compliance Requirements Not Met'}
                </p>
                {!complianceStatus.compliant && complianceStatus.missingMethods?.length > 0 && (
                  <p className="text-sm text-yellow-700 mt-1">
                    Missing methods: {complianceStatus.missingMethods.join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Current MFA Methods */}
      {mfaStatus?.enabled && mfaStatus.methods?.length > 0 && (
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Configured Methods</h2>
          
          <div className="space-y-3">
            {mfaStatus.methods.map((method) => (
              <div key={method} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {getMFAMethodIcon(method)}
                  <div>
                    <p className="font-medium text-gray-900 capitalize">{method}</p>
                    <p className="text-sm text-gray-600">
                      {method === 'totp' && 'Time-based One-Time Password'}
                      {method === 'sms' && 'SMS Text Message'}
                      {method === 'biometric' && 'Biometric Authentication'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDisableMFA(method)}
                  className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
                  disabled={loading}
                >
                  Disable
                </button>
              </div>
            ))}
          </div>

          {mfaStatus.config?.backupCodes && (
            <div className="mt-4">
              <button
                onClick={() => setShowBackupCodes(!showBackupCodes)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                {showBackupCodes ? 'Hide' : 'Show'} Backup Codes
              </button>
              
              {showBackupCodes && (
                <div className="mt-2 p-3 bg-gray-50 rounded border">
                  <p className="text-sm text-gray-700 mb-2">
                    Save these backup codes in a secure location:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                    {mfaStatus.config.backupCodes.map((code, index) => (
                      <div key={index} className="p-2 bg-white border rounded">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Setup New MFA Method */}
      {!setupMethod && (
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Add MFA Method</h2>
          
          {/* Configuration Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number (for SMS)
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1234567890"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Device Name (for Biometric)
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="My Device"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Compliance Level
            </label>
            <select
              value={complianceLevel}
              onChange={(e) => setComplianceLevel(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="basic">Basic (TOTP only)</option>
              <option value="advanced">Advanced (TOTP + SMS)</option>
              <option value="qualified">Qualified (TOTP + SMS + Biometric)</option>
            </select>
          </div>

          {/* MFA Method Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <button
              onClick={() => handleSetupMFA('totp')}
              className="flex items-center justify-center space-x-2 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              disabled={loading}
            >
              <Key className="w-6 h-6 text-blue-600" />
              <span className="font-medium">TOTP Authenticator</span>
            </button>

            <button
              onClick={() => handleSetupMFA('sms')}
              className="flex items-center justify-center space-x-2 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              disabled={loading || !phoneNumber}
            >
              <Smartphone className="w-6 h-6 text-blue-600" />
              <span className="font-medium">SMS</span>
            </button>

            <button
              onClick={() => handleSetupMFA('biometric')}
              className="flex items-center justify-center space-x-2 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              disabled={loading || !deviceName}
            >
              <Eye className="w-6 h-6 text-blue-600" />
              <span className="font-medium">Biometric</span>
            </button>
          </div>

          {/* Document Signing Setup */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Document Signing MFA</h3>
            <p className="text-gray-600 mb-4">
              Configure MFA specifically for document signing operations with compliance requirements.
            </p>
            <button
              onClick={handleSetupForDocumentSigning}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              disabled={loading}
            >
              Setup Document Signing MFA
            </button>
          </div>
        </div>
      )}

      {/* MFA Setup Process */}
      {setupMethod && setupData && (
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Setup {setupMethod.toUpperCase()}
          </h2>

          {setupMethod === 'totp' && setupData.qrCode && (
            <div className="text-center mb-6">
              <p className="text-gray-600 mb-4">
                Scan this QR code with your authenticator app:
              </p>
              <div className="inline-block p-4 bg-white border rounded-lg">
                <img src={setupData.qrCode} alt="QR Code" className="w-48 h-48" />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Or enter this secret manually: <code className="bg-gray-100 px-2 py-1 rounded">{setupData.secret}</code>
              </p>
            </div>
          )}

          {setupMethod === 'sms' && (
            <div className="mb-6">
              <p className="text-gray-600 mb-2">
                SMS verification code sent to: {phoneNumber}
              </p>
            </div>
          )}

          {setupMethod === 'biometric' && (
            <div className="mb-6">
              <p className="text-gray-600 mb-2">
                Please complete the biometric setup on your device.
              </p>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Verification Code
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Enter verification code"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex space-x-4">
            <button
              onClick={handleVerifySetup}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              disabled={loading || !verificationCode}
            >
              Verify & Enable
            </button>
            <button
              onClick={() => {
                setSetupMethod(null);
                setSetupData(null);
                setVerificationCode('');
              }}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
          </div>

          {/* Backup Codes Display */}
          {setupData.backupCodes && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-2">Important: Save Your Backup Codes</h4>
              <p className="text-sm text-yellow-700 mb-3">
                Store these backup codes in a secure location. You can use them to access your account if you lose your primary MFA device.
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                {setupData.backupCodes.map((code, index) => (
                  <div key={index} className="p-2 bg-white border rounded">
                    {code}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MFADashboard;
