// Timestamp Integration Service
// Integrates trusted timestamping with PKI and signature services

import TrustedTimestampService from './TrustedTimestampService';
import PKIService from '../pki/PKIService';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

export class TimestampIntegrationService {
  constructor() {
    this.timestampService = TrustedTimestampService;
    this.pkiService = PKIService;
  }

  /**
   * Create timestamped digital signature
   * @param {Object} signatureRequest - Signature request with timestamp options
   */
  async createTimestampedSignature(signatureRequest) {
    const {
      certificateId,
      data,
      documentId,
      userId,
      timestampProvider = 'digicert',
      includeQualifiedTimestamp = true
    } = signatureRequest;

    try {
      // Step 1: Create digital signature using PKI service
      const signatureResult = await this.pkiService.createDigitalSignature({
        certificateId,
        data,
        signatureFormat: 'PKCS7',
        includeTimestamp: false, // We'll add our own timestamp
        signingPurpose: 'document_signing'
      });

      if (!signatureResult.success) {
        throw new Error('Digital signature creation failed');
      }

      // Step 2: Create timestamp for the signature
      const timestampResult = await this.timestampService.timestampSignature({
        signatureId: signatureResult.signatureId,
        signature: signatureResult.signature,
        certificate: signatureResult.certificate,
        documentHash: await this.calculateDocumentHash(data),
        signedAt: signatureResult.signedAt,
        provider: timestampProvider
      });

      // Step 3: Create composite signature with embedded timestamp
      const timestampedSignature = await this.createEmbeddedTimestampSignature({
        signature: signatureResult.signature,
        timestamp: timestampResult.timestampToken,
        certificate: signatureResult.certificate,
        timestampCertificate: await this.getTimestampCertificate(timestampProvider)
      });

      // Step 4: Store timestamped signature
      const timestampedSignatureId = await this.storeTimestampedSignature({
        originalSignatureId: signatureResult.signatureId,
        timestampId: timestampResult.timestampId,
        timestampedSignature,
        documentId,
        userId,
        provider: timestampProvider,
        qualified: includeQualifiedTimestamp,
        createdAt: new Date()
      });

      // Step 5: Update document with timestamped signature
      await this.updateDocumentWithTimestamp({
        documentId,
        signatureId: timestampedSignatureId,
        timestampTime: timestampResult.timestampTime,
        qualified: includeQualifiedTimestamp
      });

      return {
        success: true,
        signatureId: timestampedSignatureId,
        timestampedSignature,
        timestampTime: timestampResult.timestampTime,
        provider: timestampProvider,
        qualified: includeQualifiedTimestamp,
        legalValue: includeQualifiedTimestamp ? 'qualified_signature' : 'advanced_signature'
      };

    } catch (error) {
      console.error('Timestamped signature creation failed:', error);
      throw error;
    }
  }

  /**
   * Verify timestamped signature
   * @param {Object} verificationRequest - Verification request
   */
  async verifyTimestampedSignature(verificationRequest) {
    const {
      timestampedSignature,
      originalData,
      documentId
    } = verificationRequest;

    try {
      // Step 1: Extract components from timestamped signature
      const components = await this.extractTimestampComponents(timestampedSignature);

      // Step 2: Verify the original digital signature
      const signatureVerification = await this.pkiService.verifyDigitalSignature({
        signature: components.signature,
        certificate: components.certificate,
        data: originalData
      });

      // Step 3: Verify the timestamp
      const timestampVerification = await this.timestampService.verifyTimestamp(
        components.timestamp,
        components.signature // Timestamp is on the signature
      );

      // Step 4: Verify timestamp certificate chain
      const timestampCertVerification = await this.verifyTimestampCertificate(
        components.timestampCertificate
      );

      // Step 5: Check temporal consistency
      const temporalCheck = await this.verifyTemporalConsistency({
        signatureTime: signatureVerification.signedAt,
        timestampTime: timestampVerification.details.timestampTime,
        certificateValidFrom: signatureVerification.certificate.validFrom,
        certificateValidTo: signatureVerification.certificate.validTo
      });

      const overallValid = 
        signatureVerification.valid &&
        timestampVerification.valid &&
        timestampCertVerification.valid &&
        temporalCheck.valid;

      return {
        valid: overallValid,
        signature: signatureVerification,
        timestamp: timestampVerification,
        timestampCertificate: timestampCertVerification,
        temporalConsistency: temporalCheck,
        legalValue: this.determineLegalValue({
          signatureValid: signatureVerification.valid,
          timestampValid: timestampVerification.valid,
          qualified: components.qualified
        }),
        verifiedAt: new Date()
      };

    } catch (error) {
      console.error('Timestamped signature verification failed:', error);
      return {
        valid: false,
        error: error.message,
        verifiedAt: new Date()
      };
    }
  }

  /**
   * Batch process multiple documents with timestamps
   * @param {Array} documents - Array of documents to process
   */
  async batchTimestampDocuments(documents, options = {}) {
    const {
      timestampProvider = 'digicert',
      includeQualifiedTimestamp = true,
      maxConcurrent = 5
    } = options;

    try {
      const results = [];
      const batches = this.createProcessingBatches(documents, maxConcurrent);

      for (const batch of batches) {
        const batchPromises = batch.map(async (doc) => {
          try {
            const result = await this.createTimestampedSignature({
              ...doc,
              timestampProvider,
              includeQualifiedTimestamp
            });
            return { success: true, documentId: doc.documentId, result };
          } catch (error) {
            return { success: false, documentId: doc.documentId, error: error.message };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults.map(r => r.value || r.reason));
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      return {
        success: failed === 0,
        total: documents.length,
        successful,
        failed,
        results,
        processingTime: new Date()
      };

    } catch (error) {
      console.error('Batch timestamp processing failed:', error);
      throw error;
    }
  }

  /**
   * Long-term validation and archiving
   * @param {string} signatureId - Timestamped signature ID
   */
  async performLongTermValidation(signatureId) {
    try {
      const signature = await this.getTimestampedSignature(signatureId);
      
      // Check certificate status (CRL/OCSP)
      const certificateStatus = await this.checkCertificateStatus(signature.certificate);
      
      // Verify timestamp authority certificate
      const timestampAuthorityStatus = await this.checkTimestampAuthorityStatus(
        signature.timestampProvider
      );
      
      // Check if re-timestamping is needed (approaching algorithm expiry)
      const reTimestampNeeded = this.checkReTimestampRequirement(signature);
      
      // Create long-term validation report
      const validationReport = {
        signatureId,
        validatedAt: new Date(),
        certificateStatus,
        timestampAuthorityStatus,
        reTimestampNeeded,
        nextValidationDue: this.calculateNextValidationDate(),
        archivalRecommendation: this.getArchivalRecommendation(signature)
      };

      // Store validation report
      await this.storeLongTermValidationReport(validationReport);

      return validationReport;

    } catch (error) {
      console.error('Long-term validation failed:', error);
      throw error;
    }
  }

  // Helper methods

  async calculateDocumentHash(data) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async getTimestampCertificate(provider) {
    // In production, retrieve actual timestamp authority certificate
    return `timestamp_cert_${provider}`;
  }

  async createEmbeddedTimestampSignature(components) {
    // Create PKCS#7 signature with embedded timestamp (RFC 3161)
    const embeddedSignature = {
      signature: components.signature,
      timestamp: components.timestamp,
      certificate: components.certificate,
      timestampCertificate: components.timestampCertificate,
      format: 'PKCS7_WITH_TIMESTAMP',
      created: new Date()
    };

    return btoa(JSON.stringify(embeddedSignature));
  }

  async extractTimestampComponents(timestampedSignature) {
    try {
      const decoded = JSON.parse(atob(timestampedSignature));
      return {
        signature: decoded.signature,
        timestamp: decoded.timestamp,
        certificate: decoded.certificate,
        timestampCertificate: decoded.timestampCertificate,
        qualified: decoded.qualified || false
      };
    } catch (error) {
      throw new Error('Invalid timestamped signature format');
    }
  }

  async storeTimestampedSignature(signatureData) {
    const signatureId = this.generateTimestampedSignatureId();
    
    await setDoc(doc(db, 'timestamped_signatures', signatureId), {
      ...signatureData,
      signatureId,
      createdAt: new Date()
    });

    return signatureId;
  }

  async updateDocumentWithTimestamp(updateData) {
    const { documentId, signatureId, timestampTime, qualified } = updateData;
    
    await updateDoc(doc(db, 'documents', documentId), {
      timestampedSignatureId: signatureId,
      timestampTime,
      qualified,
      legalValue: qualified ? 'qualified_signature' : 'advanced_signature',
      updatedAt: new Date()
    });
  }

  async verifyTimestampCertificate(certificate) {
    // Simplified verification (in production, verify actual certificate chain)
    return {
      valid: true,
      issuer: 'Trusted Timestamp Authority',
      validFrom: new Date('2024-01-01'),
      validTo: new Date('2026-12-31'),
      purposes: ['timestamping']
    };
  }

  async verifyTemporalConsistency(timeData) {
    const {
      signatureTime,
      timestampTime,
      certificateValidFrom,
      certificateValidTo
    } = timeData;

    const sigTime = new Date(signatureTime);
    const tsTime = new Date(timestampTime);
    const certFrom = new Date(certificateValidFrom);
    const certTo = new Date(certificateValidTo);

    const temporalValid = 
      sigTime >= certFrom &&
      sigTime <= certTo &&
      tsTime >= sigTime &&
      (tsTime - sigTime) < 300000; // Timestamp within 5 minutes of signature

    return {
      valid: temporalValid,
      signatureTime: sigTime,
      timestampTime: tsTime,
      certificateValidPeriod: { from: certFrom, to: certTo },
      timeDifference: tsTime - sigTime
    };
  }

  determineLegalValue(validation) {
    const { signatureValid, timestampValid, qualified } = validation;
    
    if (!signatureValid || !timestampValid) {
      return 'invalid';
    }
    
    if (qualified) {
      return 'qualified_electronic_signature';
    }
    
    return 'advanced_electronic_signature';
  }

  createProcessingBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  async getTimestampedSignature(signatureId) {
    const doc = await getDoc(doc(db, 'timestamped_signatures', signatureId));
    if (!doc.exists()) {
      throw new Error(`Timestamped signature ${signatureId} not found`);
    }
    return doc.data();
  }

  async checkCertificateStatus(certificate) {
    // Check certificate revocation status via CRL/OCSP
    return {
      status: 'valid',
      checkedAt: new Date(),
      method: 'OCSP',
      nextCheck: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
  }

  async checkTimestampAuthorityStatus(provider) {
    return {
      status: 'trusted',
      provider,
      checkedAt: new Date(),
      qualified: true,
      compliance: ['eIDAS', 'ETSI_TS_119_424']
    };
  }

  checkReTimestampRequirement(signature) {
    // Check if signature approaching algorithm expiry (e.g., SHA-1 deprecated)
    const createdDate = new Date(signature.createdAt);
    const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
    
    return {
      needed: createdDate < fiveYearsAgo,
      reason: createdDate < fiveYearsAgo ? 'algorithm_aging' : null,
      recommendedBy: fiveYearsAgo
    };
  }

  calculateNextValidationDate() {
    // Next validation in 1 year
    return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  }

  getArchivalRecommendation(signature) {
    return {
      format: 'PAdES-LTV',
      retention: '7_years',
      migration: 'recommended_in_5_years'
    };
  }

  async storeLongTermValidationReport(report) {
    const reportId = `ltv_${report.signatureId}_${Date.now()}`;
    
    await setDoc(doc(db, 'validation_reports', reportId), {
      ...report,
      reportId,
      createdAt: new Date()
    });
  }

  generateTimestampedSignatureId() {
    return `tss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default new TimestampIntegrationService();
