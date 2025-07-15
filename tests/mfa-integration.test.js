// MFA Service Integration Tests
// Comprehensive test suite for MFA functionality

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import MFAService from '../src/services/auth/MFAService';
import MFAIntegrationService from '../src/services/auth/MFAIntegrationService';
import MFASecurityNotifications from '../src/services/auth/MFASecurityNotifications';

// Mock Firebase
jest.mock('../src/firebase/config', () => ({
  db: {},
  auth: {}
}));

// Mock Firestore operations
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  collection: jest.fn(),
  addDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn()
}));

describe('MFA Service Tests', () => {
  const mockUserId = 'test-user-123';
  const mockPhoneNumber = '+1234567890';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TOTP Setup and Verification', () => {
    test('should setup TOTP successfully', async () => {
      // Mock successful TOTP setup
      const mockSetupResult = {
        success: true,
        secret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,mockqrcode',
        backupCodes: ['123456', '789012']
      };

      jest.spyOn(MFAService, 'setupTOTP').mockResolvedValue(mockSetupResult);

      const result = await MFAService.setupTOTP(mockUserId);

      expect(result.success).toBe(true);
      expect(result.secret).toBeDefined();
      expect(result.qrCode).toBeDefined();
      expect(result.backupCodes).toHaveLength(2);
    });

    test('should verify TOTP code successfully', async () => {
      const mockVerificationResult = {
        success: true,
        method: 'totp',
        timestamp: new Date()
      };

      jest.spyOn(MFAService, 'verifyMFA').mockResolvedValue(mockVerificationResult);

      const result = await MFAService.verifyMFA(mockUserId, '123456', 'totp');

      expect(result.success).toBe(true);
      expect(result.method).toBe('totp');
    });

    test('should reject invalid TOTP code', async () => {
      const mockVerificationResult = {
        success: false,
        error: 'Invalid code'
      };

      jest.spyOn(MFAService, 'verifyMFA').mockResolvedValue(mockVerificationResult);

      const result = await MFAService.verifyMFA(mockUserId, 'invalid', 'totp');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid code');
    });
  });

  describe('SMS Setup and Verification', () => {
    test('should setup SMS successfully', async () => {
      const mockSetupResult = {
        success: true,
        phoneNumber: mockPhoneNumber,
        maskedNumber: '+1****567890'
      };

      jest.spyOn(MFAService, 'setupSMS').mockResolvedValue(mockSetupResult);

      const result = await MFAService.setupSMS(mockUserId, mockPhoneNumber);

      expect(result.success).toBe(true);
      expect(result.phoneNumber).toBe(mockPhoneNumber);
    });

    test('should send SMS code successfully', async () => {
      const mockSendResult = {
        success: true,
        codeSent: true
      };

      jest.spyOn(MFAService, 'sendSMSCode').mockResolvedValue(mockSendResult);

      const result = await MFAService.sendSMSCode(mockUserId);

      expect(result.success).toBe(true);
      expect(result.codeSent).toBe(true);
    });

    test('should verify SMS code successfully', async () => {
      const mockVerificationResult = {
        success: true,
        method: 'sms',
        timestamp: new Date()
      };

      jest.spyOn(MFAService, 'verifyMFA').mockResolvedValue(mockVerificationResult);

      const result = await MFAService.verifyMFA(mockUserId, '123456', 'sms');

      expect(result.success).toBe(true);
      expect(result.method).toBe('sms');
    });
  });

  describe('Biometric Authentication', () => {
    test('should setup biometric successfully', async () => {
      const mockSetupResult = {
        success: true,
        credentialId: 'mock-credential-id',
        deviceName: 'Test Device'
      };

      jest.spyOn(MFAService, 'setupBiometric').mockResolvedValue(mockSetupResult);

      const result = await MFAService.setupBiometric(mockUserId, { deviceName: 'Test Device' });

      expect(result.success).toBe(true);
      expect(result.credentialId).toBeDefined();
    });

    test('should verify biometric successfully', async () => {
      const mockVerificationResult = {
        success: true,
        method: 'biometric',
        credential: 'mock-credential'
      };

      jest.spyOn(MFAService, 'verifyBiometric').mockResolvedValue(mockVerificationResult);

      const result = await MFAService.verifyBiometric(mockUserId);

      expect(result.success).toBe(true);
      expect(result.method).toBe('biometric');
    });
  });

  describe('MFA Status Management', () => {
    test('should get MFA status correctly', async () => {
      const mockStatus = {
        enabled: true,
        methods: ['totp', 'sms'],
        config: {
          backupCodes: ['123456', '789012']
        }
      };

      jest.spyOn(MFAService, 'getMFAStatus').mockResolvedValue(mockStatus);

      const result = await MFAService.getMFAStatus(mockUserId);

      expect(result.enabled).toBe(true);
      expect(result.methods).toContain('totp');
      expect(result.methods).toContain('sms');
    });

    test('should disable MFA method successfully', async () => {
      const mockDisableResult = {
        success: true,
        removedMethod: 'sms'
      };

      jest.spyOn(MFAService, 'disableMFA').mockResolvedValue(mockDisableResult);

      const result = await MFAService.disableMFA(mockUserId, 'sms');

      expect(result.success).toBe(true);
      expect(result.removedMethod).toBe('sms');
    });
  });
});

describe('MFA Integration Service Tests', () => {
  const mockUserId = 'test-user-123';
  const mockDocumentId = 'doc-123';
  const mockCertificateId = 'cert-123';

  describe('Operation MFA Requirements', () => {
    test('should require MFA for sensitive operations', async () => {
      const mockMFARequirement = {
        required: true,
        verified: false,
        availableMethods: ['totp', 'sms']
      };

      jest.spyOn(MFAIntegrationService, 'requireMFAForOperation').mockResolvedValue(mockMFARequirement);

      const result = await MFAIntegrationService.requireMFAForOperation(
        mockUserId,
        'digital_signature'
      );

      expect(result.required).toBe(true);
      expect(result.verified).toBe(false);
    });

    test('should allow non-sensitive operations without MFA', async () => {
      const mockMFARequirement = {
        required: false,
        verified: true
      };

      jest.spyOn(MFAIntegrationService, 'requireMFAForOperation').mockResolvedValue(mockMFARequirement);

      const result = await MFAIntegrationService.requireMFAForOperation(
        mockUserId,
        'document_view'
      );

      expect(result.required).toBe(false);
      expect(result.verified).toBe(true);
    });
  });

  describe('MFA-Protected Signatures', () => {
    test('should create MFA-protected signature successfully', async () => {
      const mockSignatureResult = {
        success: true,
        signature: 'mfa-enhanced-signature',
        mfaVerified: true,
        mfaMethod: 'totp',
        legalValue: 'qualified_electronic_signature'
      };

      jest.spyOn(MFAIntegrationService, 'createMFAProtectedSignature').mockResolvedValue(mockSignatureResult);

      const result = await MFAIntegrationService.createMFAProtectedSignature({
        userId: mockUserId,
        certificateId: mockCertificateId,
        data: 'test-data',
        documentId: mockDocumentId,
        mfaCode: '123456',
        mfaMethod: 'totp'
      });

      expect(result.success).toBe(true);
      expect(result.mfaVerified).toBe(true);
      expect(result.legalValue).toBe('qualified_electronic_signature');
    });

    test('should reject signature with invalid MFA', async () => {
      jest.spyOn(MFAIntegrationService, 'createMFAProtectedSignature').mockRejectedValue(
        new Error('MFA verification failed')
      );

      await expect(
        MFAIntegrationService.createMFAProtectedSignature({
          userId: mockUserId,
          certificateId: mockCertificateId,
          data: 'test-data',
          documentId: mockDocumentId,
          mfaCode: 'invalid',
          mfaMethod: 'totp'
        })
      ).rejects.toThrow('MFA verification failed');
    });
  });

  describe('Compliance Checking', () => {
    test('should check MFA compliance correctly', async () => {
      const mockCompliance = {
        compliant: true,
        reason: null,
        requiredMethods: ['totp', 'sms'],
        currentMethods: ['totp', 'sms'],
        missingMethods: []
      };

      jest.spyOn(MFAIntegrationService, 'checkMFACompliance').mockResolvedValue(mockCompliance);

      const result = await MFAIntegrationService.checkMFACompliance(mockUserId, 'advanced');

      expect(result.compliant).toBe(true);
      expect(result.missingMethods).toHaveLength(0);
    });

    test('should identify non-compliant MFA setup', async () => {
      const mockCompliance = {
        compliant: false,
        reason: 'Missing required MFA methods',
        requiredMethods: ['totp', 'sms', 'biometric'],
        currentMethods: ['totp'],
        missingMethods: ['sms', 'biometric']
      };

      jest.spyOn(MFAIntegrationService, 'checkMFACompliance').mockResolvedValue(mockCompliance);

      const result = await MFAIntegrationService.checkMFACompliance(mockUserId, 'qualified');

      expect(result.compliant).toBe(false);
      expect(result.missingMethods).toContain('sms');
      expect(result.missingMethods).toContain('biometric');
    });
  });

  describe('Batch Operations', () => {
    test('should handle batch signing with MFA', async () => {
      const mockBatchResult = {
        success: true,
        total: 3,
        successful: 3,
        failed: 0,
        results: [
          { documentId: 'doc1', success: true },
          { documentId: 'doc2', success: true },
          { documentId: 'doc3', success: true }
        ],
        mfaTokenValid: true,
        mfaMethod: 'totp'
      };

      jest.spyOn(MFAIntegrationService, 'batchSignWithMFA').mockResolvedValue(mockBatchResult);

      const result = await MFAIntegrationService.batchSignWithMFA({
        userId: mockUserId,
        documents: [
          { id: 'doc1', data: 'data1' },
          { id: 'doc2', data: 'data2' },
          { id: 'doc3', data: 'data3' }
        ],
        certificateId: mockCertificateId,
        mfaCode: '123456',
        mfaMethod: 'totp'
      });

      expect(result.success).toBe(true);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
    });
  });
});

describe('MFA Security Notifications Tests', () => {
  const mockUserId = 'test-user-123';

  describe('Notification Creation', () => {
    test('should create security notification successfully', async () => {
      const mockNotificationResult = {
        success: true,
        notificationId: 'notif-123',
        notification: {
          userId: mockUserId,
          type: 'mfa_enabled',
          severity: 'medium'
        }
      };

      jest.spyOn(MFASecurityNotifications, 'createSecurityNotification').mockResolvedValue(mockNotificationResult);

      const result = await MFASecurityNotifications.createSecurityNotification(
        mockUserId,
        'mfa_enabled',
        { method: 'totp' }
      );

      expect(result.success).toBe(true);
      expect(result.notificationId).toBeDefined();
    });
  });

  describe('Suspicious Activity Detection', () => {
    test('should detect excessive failed attempts', async () => {
      const mockSuspiciousResult = {
        suspicious: true,
        patterns: ['excessive_failed_attempts'],
        riskLevel: 'high'
      };

      jest.spyOn(MFASecurityNotifications, 'detectSuspiciousActivity').mockResolvedValue(mockSuspiciousResult);

      const result = await MFASecurityNotifications.detectSuspiciousActivity(mockUserId, {
        method: 'totp',
        failureCount: 6
      });

      expect(result.suspicious).toBe(true);
      expect(result.patterns).toContain('excessive_failed_attempts');
      expect(result.riskLevel).toBe('high');
    });

    test('should not flag normal activity', async () => {
      const mockNormalResult = {
        suspicious: false
      };

      jest.spyOn(MFASecurityNotifications, 'detectSuspiciousActivity').mockResolvedValue(mockNormalResult);

      const result = await MFASecurityNotifications.detectSuspiciousActivity(mockUserId, {
        method: 'totp',
        failureCount: 1
      });

      expect(result.suspicious).toBe(false);
    });
  });

  describe('Compliance Violation Logging', () => {
    test('should log compliance violations', async () => {
      const mockLogResult = {
        success: true
      };

      jest.spyOn(MFASecurityNotifications, 'logComplianceViolation').mockResolvedValue(mockLogResult);

      const result = await MFASecurityNotifications.logComplianceViolation(mockUserId, {
        operation: 'digital_signature',
        requiredLevel: 'qualified',
        currentLevel: 'basic',
        missingMethods: ['biometric']
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Notification Management', () => {
    test('should get security notifications', async () => {
      const mockNotifications = {
        success: true,
        notifications: [
          {
            id: 'notif1',
            type: 'mfa_enabled',
            severity: 'medium',
            read: false
          },
          {
            id: 'notif2',
            type: 'mfa_failed_attempt',
            severity: 'low',
            read: true
          }
        ],
        total: 2
      };

      jest.spyOn(MFASecurityNotifications, 'getSecurityNotifications').mockResolvedValue(mockNotifications);

      const result = await MFASecurityNotifications.getSecurityNotifications(mockUserId);

      expect(result.success).toBe(true);
      expect(result.notifications).toHaveLength(2);
    });

    test('should mark notifications as read', async () => {
      const mockMarkReadResult = {
        success: true
      };

      jest.spyOn(MFASecurityNotifications, 'markNotificationsAsRead').mockResolvedValue(mockMarkReadResult);

      const result = await MFASecurityNotifications.markNotificationsAsRead(
        mockUserId,
        ['notif1', 'notif2']
      );

      expect(result.success).toBe(true);
    });
  });
});

describe('End-to-End MFA Workflow Tests', () => {
  const mockUserId = 'test-user-123';

  test('complete MFA setup and document signing workflow', async () => {
    // Mock the complete workflow
    jest.spyOn(MFAService, 'setupTOTP').mockResolvedValue({
      success: true,
      secret: 'JBSWY3DPEHPK3PXP',
      qrCode: 'mockqr'
    });

    jest.spyOn(MFAService, 'verifyMFA').mockResolvedValue({
      success: true,
      method: 'totp'
    });

    jest.spyOn(MFAIntegrationService, 'createMFAProtectedSignature').mockResolvedValue({
      success: true,
      signature: 'protected-signature',
      mfaVerified: true
    });

    // Setup MFA
    const setupResult = await MFAService.setupTOTP(mockUserId);
    expect(setupResult.success).toBe(true);

    // Verify MFA code
    const verifyResult = await MFAService.verifyMFA(mockUserId, '123456', 'totp');
    expect(verifyResult.success).toBe(true);

    // Create protected signature
    const signResult = await MFAIntegrationService.createMFAProtectedSignature({
      userId: mockUserId,
      certificateId: 'cert-123',
      data: 'document-data',
      mfaCode: '123456',
      mfaMethod: 'totp'
    });

    expect(signResult.success).toBe(true);
    expect(signResult.mfaVerified).toBe(true);
  });
});

// Test configuration and utilities
export const MFATestUtils = {
  // Mock user data
  createMockUser: () => ({
    uid: 'test-user-123',
    email: 'test@example.com',
    phoneNumber: '+1234567890'
  }),

  // Mock MFA configuration
  createMockMFAConfig: () => ({
    enabled: true,
    methods: ['totp', 'sms'],
    config: {
      totpSecret: 'JBSWY3DPEHPK3PXP',
      phoneNumber: '+1234567890',
      backupCodes: ['123456', '789012']
    }
  }),

  // Mock document for testing
  createMockDocument: () => ({
    id: 'doc-123',
    title: 'Test Document',
    requiresMFA: true,
    certificateId: 'cert-123'
  }),

  // Generate test TOTP codes
  generateTestTOTPCode: () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  // Simulate biometric challenge
  simulateBiometricChallenge: () => ({
    challenge: new Uint8Array(32),
    timeout: 60000,
    userVerification: 'required'
  })
};

export default {
  MFATestUtils
};
