// MFA Integration Service
// Integrates MFA with PKI operations and signature workflows

import MFAService from './MFAService';
import PKIService from '../pki/PKIService';
import TimestampIntegrationService from '../timestamping/TimestampIntegrationService';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

export class MFAIntegrationService {
  constructor() {
    this.mfaService = MFAService;
    this.pkiService = PKIService;
    this.timestampService = TimestampIntegrationService;
    this.sensitiveOperations = new Set([
      'certificate_request',
      'digital_signature',
      'timestamp_signature',
      'key_generation',
      'certificate_renewal',
      'document_signing'
    ]);
  }

  /**
   * Require MFA verification for sensitive operations
   * @param {string} userId - User ID
   * @param {string} operation - Operation type
   * @param {Object} mfaData - MFA verification data
   */
  async requireMFAForOperation(userId, operation, mfaData = {}) {
    try {
      // Check if operation requires MFA
      if (!this.sensitiveOperations.has(operation)) {
        return { required: false, verified: true };
      }

      // Get user's MFA configuration
      const mfaStatus = await this.mfaService.getMFAStatus(userId);
      
      if (!mfaStatus.enabled) {
        // MFA not enabled - require setup for sensitive operations
        return {
          required: true,
          verified: false,
          setupRequired: true,
          message: 'Multi-factor authentication must be enabled for this operation'
        };
      }

      // Check if MFA verification was provided
      if (!mfaData.code || !mfaData.method) {
        return {
          required: true,
          verified: false,
          availableMethods: mfaStatus.methods,
          message: 'Multi-factor authentication required'
        };
      }

      // Verify MFA code
      const verification = await this.mfaService.verifyMFA(
        userId,
        mfaData.code,
        mfaData.method
      );

      if (!verification.success) {
        return {
          required: true,
          verified: false,
          error: 'Invalid MFA code',
          attemptsRemaining: this.calculateAttemptsRemaining(userId, mfaData.method)
        };
      }

      // Log successful MFA verification for operation
      await this.logMFAOperation(userId, operation, verification.method);

      return {
        required: true,
        verified: true,
        method: verification.method,
        timestamp: verification.timestamp
      };

    } catch (error) {
      console.error('MFA operation check failed:', error);
      throw error;
    }
  }

  /**
   * Create digital signature with MFA verification
   * @param {Object} signatureRequest - Signature request with MFA data
   */
  async createMFAProtectedSignature(signatureRequest) {
    const {
      userId,
      certificateId,
      data,
      documentId,
      mfaCode,
      mfaMethod = 'totp',
      includeTimestamp = true
    } = signatureRequest;

    try {
      // Require MFA verification for digital signature
      const mfaResult = await this.requireMFAForOperation(
        userId,
        'digital_signature',
        { code: mfaCode, method: mfaMethod }
      );

      if (!mfaResult.verified) {
        throw new Error(mfaResult.message || 'MFA verification failed');
      }

      // Proceed with signature creation
      let signatureResult;
      
      if (includeTimestamp) {
        signatureResult = await this.pkiService.createDigitalSignatureWithTimestamp({
          certificateId,
          data,
          documentId,
          userId
        });
      } else {
        signatureResult = await this.pkiService.createDigitalSignature({
          certificateId,
          data,
          signatureFormat: 'PKCS7',
          signingPurpose: 'document_signing'
        });
      }

      // Enhanced signature with MFA proof
      const mfaEnhancedSignature = await this.enhanceSignatureWithMFA({
        signature: signatureResult,
        mfaVerification: mfaResult,
        userId,
        documentId
      });

      return {
        success: true,
        signature: mfaEnhancedSignature,
        mfaVerified: true,
        mfaMethod: mfaResult.method,
        legalValue: this.determineLegalValueWithMFA(signatureResult, mfaResult)
      };

    } catch (error) {
      console.error('MFA-protected signature creation failed:', error);
      throw error;
    }
  }

  /**
   * Request certificate with MFA verification
   * @param {Object} certificateRequest - Certificate request with MFA data
   */
  async requestCertificateWithMFA(certificateRequest) {
    const {
      userId,
      provider,
      certificateType,
      subject,
      validationData,
      mfaCode,
      mfaMethod = 'totp'
    } = certificateRequest;

    try {
      // Require MFA verification for certificate request
      const mfaResult = await this.requireMFAForOperation(
        userId,
        'certificate_request',
        { code: mfaCode, method: mfaMethod }
      );

      if (!mfaResult.verified) {
        throw new Error(mfaResult.message || 'MFA verification required for certificate request');
      }

      // Proceed with certificate request
      const certResult = await this.pkiService.requestCertificate({
        provider,
        certificateType,
        subject,
        validationData,
        userId
      });

      // Log MFA-protected certificate request
      await this.logMFACertificateRequest({
        userId,
        requestId: certResult.requestId,
        mfaMethod: mfaResult.method,
        mfaTimestamp: mfaResult.timestamp
      });

      return {
        success: true,
        requestId: certResult.requestId,
        mfaVerified: true,
        mfaMethod: mfaResult.method
      };

    } catch (error) {
      console.error('MFA-protected certificate request failed:', error);
      throw error;
    }
  }

  /**
   * Batch signing with MFA verification
   * @param {Object} batchRequest - Batch signing request
   */
  async batchSignWithMFA(batchRequest) {
    const {
      userId,
      documents,
      certificateId,
      mfaCode,
      mfaMethod = 'totp',
      requireMFAPerDocument = false
    } = batchRequest;

    try {
      // Initial MFA verification for batch operation
      const mfaResult = await this.requireMFAForOperation(
        userId,
        'document_signing',
        { code: mfaCode, method: mfaMethod }
      );

      if (!mfaResult.verified) {
        throw new Error('MFA verification required for batch signing');
      }

      const results = [];
      let mfaTokenValid = true;
      const mfaValidityWindow = 300000; // 5 minutes

      for (const [index, document] of documents.entries()) {
        try {
          // Check if MFA re-verification is needed
          if (requireMFAPerDocument && index > 0) {
            const timeSinceLastMFA = Date.now() - mfaResult.timestamp.getTime();
            if (timeSinceLastMFA > mfaValidityWindow) {
              mfaTokenValid = false;
              break;
            }
          }

          // Sign document
          const signatureResult = await this.createMFAProtectedSignature({
            userId,
            certificateId,
            data: document.data,
            documentId: document.id,
            mfaCode: null, // Skip MFA for individual docs in batch
            mfaMethod: null
          });

          results.push({
            documentId: document.id,
            success: true,
            signature: signatureResult.signature
          });

        } catch (error) {
          results.push({
            documentId: document.id,
            success: false,
            error: error.message
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      return {
        success: failed === 0 && mfaTokenValid,
        total: documents.length,
        successful,
        failed,
        results,
        mfaTokenValid,
        mfaMethod: mfaResult.method
      };

    } catch (error) {
      console.error('MFA batch signing failed:', error);
      throw error;
    }
  }

  /**
   * Setup MFA for enhanced document signing
   * @param {string} userId - User ID
   * @param {Object} setupOptions - MFA setup options
   */
  async setupMFAForDocumentSigning(userId, setupOptions = {}) {
    const {
      methods = ['totp', 'sms'],
      phoneNumber = null,
      deviceName = 'Document Signing Device',
      complianceLevel = 'advanced' // basic, advanced, qualified
    } = setupOptions;

    try {
      // Determine required MFA methods based on compliance level
      const requiredMethods = this.getRequiredMFAMethods(complianceLevel);
      const finalMethods = methods.filter(m => requiredMethods.includes(m));

      if (finalMethods.length === 0) {
        throw new Error(`No valid MFA methods for compliance level: ${complianceLevel}`);
      }

      // Enable MFA with document signing configuration
      const mfaResult = await this.mfaService.enableMFA(userId, {
        methods: finalMethods,
        phoneNumber,
        deviceName,
        requireBackupCodes: true
      });

      // Store document signing specific configuration
      await this.storeMFADocumentSigningConfig(userId, {
        complianceLevel,
        methods: finalMethods,
        enabledAt: new Date(),
        requireMFAForAllSigning: complianceLevel === 'qualified'
      });

      return {
        success: true,
        methods: finalMethods,
        complianceLevel,
        setupInstructions: mfaResult.setupInstructions,
        qrCode: mfaResult.config.qrCode,
        backupCodes: mfaResult.config.backupCodes
      };

    } catch (error) {
      console.error('MFA setup for document signing failed:', error);
      throw error;
    }
  }

  /**
   * Enhance signature with MFA proof
   * @param {Object} signatureData - Original signature data
   */
  async enhanceSignatureWithMFA(signatureData) {
    const { signature, mfaVerification, userId, documentId } = signatureData;

    try {
      // Create MFA proof object
      const mfaProof = {
        userId,
        method: mfaVerification.method,
        timestamp: mfaVerification.timestamp,
        verified: true,
        documentId
      };

      // Create enhanced signature container
      const enhancedSignature = {
        originalSignature: signature.signature || signature.timestampedSignature,
        mfaProof,
        enhancedAt: new Date(),
        complianceLevel: this.determineComplianceLevel(mfaVerification.method),
        legalValue: 'mfa_enhanced_signature'
      };

      // Store enhanced signature
      await this.storeEnhancedSignature(userId, documentId, enhancedSignature);

      return enhancedSignature;

    } catch (error) {
      console.error('Signature MFA enhancement failed:', error);
      throw error;
    }
  }

  // Helper methods

  getRequiredMFAMethods(complianceLevel) {
    const requirements = {
      basic: ['totp'],
      advanced: ['totp', 'sms'],
      qualified: ['totp', 'sms', 'biometric']
    };

    return requirements[complianceLevel] || requirements.basic;
  }

  determineLegalValueWithMFA(signatureResult, mfaResult) {
    const baseLegalValue = signatureResult.legalValue || 'advanced_signature';
    const mfaEnhancement = this.getMFAEnhancementLevel(mfaResult.method);

    const legalValueMapping = {
      'basic_signature': {
        'basic_mfa': 'advanced_electronic_signature',
        'advanced_mfa': 'advanced_electronic_signature_mfa',
        'qualified_mfa': 'qualified_electronic_signature'
      },
      'advanced_signature': {
        'basic_mfa': 'advanced_electronic_signature_mfa',
        'advanced_mfa': 'qualified_electronic_signature',
        'qualified_mfa': 'qualified_electronic_signature_plus'
      },
      'qualified_signature': {
        'basic_mfa': 'qualified_electronic_signature_mfa',
        'advanced_mfa': 'qualified_electronic_signature_plus',
        'qualified_mfa': 'highest_assurance_signature'
      }
    };

    return legalValueMapping[baseLegalValue]?.[mfaEnhancement] || baseLegalValue;
  }

  getMFAEnhancementLevel(method) {
    const levels = {
      'totp': 'basic_mfa',
      'sms': 'basic_mfa',
      'biometric': 'advanced_mfa',
      'backup': 'basic_mfa'
    };

    return levels[method] || 'basic_mfa';
  }

  determineComplianceLevel(mfaMethod) {
    const complianceLevels = {
      'totp': 'eIDAS_advanced',
      'sms': 'eIDAS_advanced',
      'biometric': 'eIDAS_qualified',
      'backup': 'eIDAS_basic'
    };

    return complianceLevels[mfaMethod] || 'eIDAS_basic';
  }

  async calculateAttemptsRemaining(userId, method) {
    // In production, implement rate limiting logic
    return 3; // Default attempts remaining
  }

  async logMFAOperation(userId, operation, method) {
    const logId = `mfa_op_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await setDoc(doc(db, 'mfa_operations', logId), {
      userId,
      operation,
      method,
      timestamp: new Date(),
      success: true
    });
  }

  async logMFACertificateRequest(data) {
    const logId = `mfa_cert_${data.userId}_${Date.now()}`;
    
    await setDoc(doc(db, 'mfa_certificate_requests', logId), {
      ...data,
      loggedAt: new Date()
    });
  }

  async storeMFADocumentSigningConfig(userId, config) {
    await setDoc(doc(db, 'mfa_document_configs', userId), {
      userId,
      ...config,
      createdAt: new Date()
    });
  }

  async storeEnhancedSignature(userId, documentId, enhancedSignature) {
    const signatureId = `enhanced_${userId}_${documentId}_${Date.now()}`;
    
    await setDoc(doc(db, 'enhanced_signatures', signatureId), {
      signatureId,
      userId,
      documentId,
      ...enhancedSignature,
      storedAt: new Date()
    });
  }

  /**
   * Get MFA requirements for operation
   * @param {string} operation - Operation type
   * @param {string} complianceLevel - Compliance level required
   */
  getMFARequirements(operation, complianceLevel = 'advanced') {
    const requirements = {
      certificate_request: {
        basic: ['totp'],
        advanced: ['totp'],
        qualified: ['totp', 'sms']
      },
      digital_signature: {
        basic: ['totp'],
        advanced: ['totp', 'sms'],
        qualified: ['totp', 'sms', 'biometric']
      },
      document_signing: {
        basic: ['totp'],
        advanced: ['totp'],
        qualified: ['totp', 'biometric']
      }
    };

    return requirements[operation]?.[complianceLevel] || ['totp'];
  }

  /**
   * Check if user meets MFA requirements for compliance level
   * @param {string} userId - User ID
   * @param {string} complianceLevel - Required compliance level
   */
  async checkMFACompliance(userId, complianceLevel = 'advanced') {
    try {
      const mfaStatus = await this.mfaService.getMFAStatus(userId);
      const requiredMethods = this.getRequiredMFAMethods(complianceLevel);
      
      if (!mfaStatus.enabled) {
        return {
          compliant: false,
          reason: 'MFA not enabled',
          requiredMethods,
          currentMethods: []
        };
      }

      const hasRequiredMethods = requiredMethods.every(method => 
        mfaStatus.methods.includes(method)
      );

      return {
        compliant: hasRequiredMethods,
        reason: hasRequiredMethods ? null : 'Missing required MFA methods',
        requiredMethods,
        currentMethods: mfaStatus.methods,
        missingMethods: requiredMethods.filter(method => 
          !mfaStatus.methods.includes(method)
        )
      };

    } catch (error) {
      console.error('MFA compliance check failed:', error);
      return {
        compliant: false,
        reason: 'Error checking compliance',
        error: error.message
      };
    }
  }
}

export default new MFAIntegrationService();
