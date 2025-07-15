// MFA Verification Modal Component
// Handles MFA verification during signing operations

import React, { useState, useEffect } from 'react';
import { Shield, Smartphone, Key, Eye, X, AlertTriangle, Loader } from 'lucide-react';
import MFAService from '../../services/auth/MFAService';
import MFAIntegrationService from '../../services/auth/MFAIntegrationService';

const MFAVerificationModal = ({ 
  isOpen, 
  onClose, 
  onVerify, 
  userId, 
  operation = 'digital_signature',
  complianceLevel = 'advanced',
  title = 'Multi-Factor Authentication Required'
}) => {
  const [availableMethods, setAvailableMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const [codeSent, setCodeSent] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      loadAvailableMethods();
      checkBiometricSupport();
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (availableMethods.length > 0 && !selectedMethod) {
      // Auto-select preferred method
      const preferredOrder = ['biometric', 'totp', 'sms'];
      const preferred = preferredOrder.find(method => availableMethods.includes(method));
      setSelectedMethod(preferred || availableMethods[0]);
    }
  }, [availableMethods, selectedMethod]);

  const loadAvailableMethods = async () => {
    try {
      const mfaStatus = await MFAService.getMFAStatus(userId);
      
      if (!mfaStatus.enabled || !mfaStatus.methods?.length) {
        setError('MFA is not configured. Please set up MFA before continuing.');
        return;
      }

      // Check compliance requirements
      const requirements = MFAIntegrationService.getMFARequirements(operation, complianceLevel);
      const validMethods = mfaStatus.methods.filter(method => 
        requirements.includes(method)
      );

      if (validMethods.length === 0) {
        setError(`No valid MFA methods for ${complianceLevel} compliance level.`);
        return;
      }

      setAvailableMethods(validMethods);
    } catch (error) {
      setError('Failed to load MFA methods');
      console.error('MFA methods error:', error);
    }
  };

  const checkBiometricSupport = async () => {
    try {
      if (window.PublicKeyCredential) {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setBiometricSupported(available);
      }
    } catch (error) {
      console.error('Biometric support check failed:', error);
    }
  };

  const handleSendSMSCode = async () => {
    try {
      setSendingCode(true);
      setError('');
      
      await MFAService.sendSMSCode(userId);
      setCodeSent(true);
    } catch (error) {
      setError('Failed to send SMS code');
    } finally {
      setSendingCode(false);
    }
  };

  const handleBiometricAuth = async () => {
    try {
      setLoading(true);
      setError('');

      const result = await MFAService.verifyBiometric(userId);
      
      if (result.success) {
        onVerify({
          success: true,
          method: 'biometric',
          code: result.credential,
          timestamp: new Date()
        });
        onClose();
      } else {
        setError('Biometric authentication failed');
      }
    } catch (error) {
      setError(`Biometric authentication error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    try {
      setLoading(true);
      setError('');

      const result = await MFAService.verifyMFA(userId, verificationCode, selectedMethod);
      
      if (result.success) {
        onVerify({
          success: true,
          method: selectedMethod,
          code: verificationCode,
          timestamp: new Date()
        });
        onClose();
      } else {
        setAttemptsRemaining(prev => prev - 1);
        setError(`Invalid verification code. ${attemptsRemaining - 1} attempts remaining.`);
        
        if (attemptsRemaining <= 1) {
          setError('Maximum attempts exceeded. Please try again later.');
          setTimeout(() => onClose(), 2000);
        }
      }
    } catch (error) {
      setError(`Verification failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMethodChange = (method) => {
    setSelectedMethod(method);
    setVerificationCode('');
    setError('');
    setCodeSent(false);
    
    // Auto-send SMS code when SMS is selected
    if (method === 'sms' && !codeSent) {
      handleSendSMSCode();
    }
  };

  const getMethodIcon = (method) => {
    const icons = {
      totp: <Key className="w-5 h-5" />,
      sms: <Smartphone className="w-5 h-5" />,
      biometric: <Eye className="w-5 h-5" />
    };
    return icons[method] || <Shield className="w-5 h-5" />;
  };

  const getMethodLabel = (method) => {
    const labels = {
      totp: 'Authenticator App',
      sms: 'SMS Code',
      biometric: 'Biometric'
    };
    return labels[method] || method;
  };

  const getMethodDescription = (method) => {
    const descriptions = {
      totp: 'Enter the 6-digit code from your authenticator app',
      sms: 'Enter the code sent to your phone',
      biometric: 'Use your fingerprint, face, or other biometric'
    };
    return descriptions[method] || '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Operation Info */}
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Operation:</strong> {operation.replace('_', ' ').toLowerCase()}
          </p>
          <p className="text-sm text-blue-700 mt-1">
            <strong>Compliance Level:</strong> {complianceLevel}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Method Selection */}
        {availableMethods.length > 1 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Choose verification method:
            </label>
            <div className="space-y-2">
              {availableMethods.map((method) => (
                <button
                  key={method}
                  onClick={() => handleMethodChange(method)}
                  className={`w-full flex items-center space-x-3 p-3 border rounded-lg text-left transition-colors ${
                    selectedMethod === method
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                  disabled={loading}
                >
                  {getMethodIcon(method)}
                  <div>
                    <p className="font-medium">{getMethodLabel(method)}</p>
                    <p className="text-sm opacity-75">{getMethodDescription(method)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Verification Input */}
        {selectedMethod && (
          <div className="mb-6">
            {selectedMethod === 'biometric' ? (
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  Click the button below to authenticate with your biometric sensor
                </p>
                <button
                  onClick={handleBiometricAuth}
                  className="w-full flex items-center justify-center space-x-2 p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={loading || !biometricSupported}
                >
                  {loading ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                  <span>
                    {loading ? 'Authenticating...' : 'Authenticate with Biometric'}
                  </span>
                </button>
                {!biometricSupported && (
                  <p className="text-sm text-gray-500 mt-2">
                    Biometric authentication is not supported on this device
                  </p>
                )}
              </div>
            ) : (
              <>
                {selectedMethod === 'sms' && (
                  <div className="mb-4">
                    {!codeSent ? (
                      <button
                        onClick={handleSendSMSCode}
                        className="w-full flex items-center justify-center space-x-2 p-3 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                        disabled={sendingCode}
                      >
                        {sendingCode ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Smartphone className="w-4 h-4" />
                        )}
                        <span>
                          {sendingCode ? 'Sending...' : 'Send SMS Code'}
                        </span>
                      </button>
                    ) : (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800">
                          SMS code sent to your phone. Enter it below.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={selectedMethod === 'totp' ? '123456' : '123456'}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono tracking-wider"
                    disabled={loading}
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {getMethodDescription(selectedMethod)}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {selectedMethod !== 'biometric' && (
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleVerifyCode}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              disabled={loading || !verificationCode || verificationCode.length !== 6}
            >
              {loading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              <span>{loading ? 'Verifying...' : 'Verify'}</span>
            </button>
          </div>
        )}

        {/* Attempts Remaining */}
        {attemptsRemaining < 3 && attemptsRemaining > 0 && (
          <div className="mt-4 text-center">
            <p className="text-sm text-yellow-600">
              {attemptsRemaining} attempts remaining
            </p>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Having trouble? Contact support for assistance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MFAVerificationModal;
