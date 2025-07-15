// Public Key Infrastructure (PKI) Service
// Core service for certificate management and digital signatures

import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import CAIntegrationService from './CAIntegrationService';
import CertificateLifecycleService from './CertificateLifecycleService';
import HSMIntegrationService from './HSMIntegrationService';
import TimestampIntegrationService from '../timestamping/TimestampIntegrationService';

export class PKIService {
  constructor() {
    this.initialized = false;
    this.certificates = new Map();
    this.caProviders = new Map();
    this.hsmEnabled = false;
    this.init();
  }

  async init() {
    if (this.initialized) return;

    try {
      // Initialize CA providers
      await this.initializeCAProviders();
      
      // Initialize HSM if available
      await this.initializeHSM();
      
      this.initialized = true;
      console.log('PKI Service initialized successfully');
    } catch (error) {
      console.error('PKI Service initialization failed:', error);
      throw error;
    }
  }

  async initializeCAProviders() {
    // Register Sectigo CA
    CAIntegrationService.registerProvider('sectigo', {
      name: 'Sectigo',
      baseUrl: 'https://cert-manager.com/api',
      apiVersion: 'v1',
      endpoints: {
        request: '/certificates/request',
        status: '/certificates/{id}/status',
        download: '/certificates/{id}/download'
      },
      supportedTypes: ['personal', 'organization', 'extended_validation'],
      authentication: 'api_key'
    });

    // Register DigiCert CA
    CAIntegrationService.registerProvider('digicert', {
      name: 'DigiCert',
      baseUrl: 'https://www.digicert.com/services/v2',
      apiVersion: 'v2',
      endpoints: {
        request: '/order/certificate',
        status: '/order/certificate/{id}',
        download: '/certificate/{id}/download'
      },
      supportedTypes: ['ssl', 'code_signing', 'client'],
      authentication: 'api_key'
    });

    // Register GlobalSign CA
    CAIntegrationService.registerProvider('globalsign', {
      name: 'GlobalSign',
      baseUrl: 'https://emea.api.globalsign.com',
      apiVersion: 'v2',
      endpoints: {
        request: '/certificate',
        status: '/certificate/{id}',
        download: '/certificate/{id}/download'
      },
      supportedTypes: ['personal', 'organization', 'extended_validation'],
      authentication: 'oauth'
    });

    console.log('CA providers initialized');
  }

  async initializeHSM() {
    try {
      // Register AWS CloudHSM if available
      if (import.meta.env.VITE_AWS_CLOUDHSM_ENABLED === 'true') {
        HSMIntegrationService.registerHSMProvider('aws-cloudhsm', {
          type: 'cloud',
          vendor: 'aws',
          connection: {
            region: import.meta.env.VITE_AWS_REGION,
            clusterId: import.meta.env.VITE_AWS_CLOUDHSM_CLUSTER_ID
          },
          authentication: 'aws_credentials',
          capabilities: ['keygeneration', 'sign', 'verify', 'encrypt', 'decrypt'],
          fipsLevel: 'level3'
        });
      }

      // Register Azure Key Vault if available
      if (import.meta.env.VITE_AZURE_KEYVAULT_ENABLED === 'true') {
        HSMIntegrationService.registerHSMProvider('azure-keyvault', {
          type: 'cloud',
          vendor: 'azure',
          connection: {
            vaultUrl: import.meta.env.VITE_AZURE_KEYVAULT_URL
          },
          authentication: 'azure_credentials',
          capabilities: ['keygeneration', 'sign', 'verify', 'encrypt', 'decrypt'],
          fipsLevel: 'level3'
        });
      }

      this.hsmEnabled = true;
      console.log('HSM providers initialized');
    } catch (error) {
      console.warn('HSM initialization failed, continuing without HSM:', error);
      this.hsmEnabled = false;
    }
  }

  /**
   * Request a new certificate from a Certificate Authority
   * @param {Object} certificateRequest - Certificate request parameters
   */
  async requestCertificate(certificateRequest) {
    const {
      provider,
      certificateType,
      subject,
      keyOptions = {},
      validationData,
      userId,
      useHSM = false
    } = certificateRequest;

    try {
      let keyPair;
      let keyId = null;

      // Generate key pair (HSM or software)
      if (useHSM && this.hsmEnabled) {
        const hsmResult = await HSMIntegrationService.generateKeyPairInHSM(
          this.getPreferredHSMProvider(),
          {
            algorithm: keyOptions.algorithm || 'RSA-PSS',
            keySize: keyOptions.keySize || 2048,
            usage: ['sign', 'verify']
          }
        );
        keyId = hsmResult.keyId;
        keyPair = {
          publicKey: hsmResult.publicKey,
          privateKey: null // Stays in HSM
        };
      } else {
        keyPair = await this.generateKeyPair(keyOptions);
      }

      // Create Certificate Signing Request
      const csr = await this.createCertificateSigningRequest(keyPair, subject);

      // Submit request to CA
      const caResponse = await this.submitToCA(provider, csr, certificateType, validationData);

      // Store request details
      const requestId = await this.storeRequestDetails({
        provider,
        certificateType,
        subject,
        userId,
        caRequestId: caResponse.requestId,
        keyPair: useHSM ? null : keyPair,
        hsmKeyId: keyId,
        status: 'pending',
        validationData
      });

      // Start monitoring for certificate issuance
      this.monitorCertificateIssuance(requestId, provider, caResponse.requestId);

      return {
        success: true,
        requestId,
        caRequestId: caResponse.requestId,
        status: caResponse.status,
        validationRequired: caResponse.validationRequired,
        estimatedIssuance: caResponse.estimatedIssuance
      };

    } catch (error) {
      console.error('Certificate request failed:', error);
      throw error;
    }
  }

  async submitToCA(provider, csr, certificateType, validationData) {
    switch (provider) {
      case 'sectigo':
        return await CAIntegrationService.requestSectigo(csr, certificateType, validationData);
      case 'digicert':
        return await CAIntegrationService.requestDigiCert(csr, certificateType, validationData);
      case 'globalsign':
        return await CAIntegrationService.requestGlobalSign(csr, certificateType, validationData);
      default:
        throw new Error(`Unsupported CA provider: ${provider}`);
    }
  }

  /**
   * Monitor certificate issuance process
   * @param {string} requestId - Internal request ID
   * @param {string} provider - CA provider
   * @param {string} caRequestId - CA request ID
   */
  async monitorCertificateIssuance(requestId, provider, caRequestId) {
    const checkInterval = 300000; // 5 minutes
    let attempts = 0;
    const maxAttempts = 288; // 24 hours maximum

    const monitor = async () => {
      try {
        attempts++;
        const status = await CAIntegrationService.checkCertificateStatus(provider, caRequestId);

        if (status.issued && status.certificate) {
          // Certificate issued successfully
          await this.completeCertificateRequest(requestId, status.certificate);
          console.log(`Certificate ${requestId} issued successfully`);
          return;
        }

        // Continue monitoring if not issued and within attempt limit
        if (attempts < maxAttempts) {
          setTimeout(monitor, checkInterval);
        } else {
          console.warn(`Certificate monitoring timeout for request ${requestId}`);
          await this.updateRequestStatus(requestId, 'timeout');
        }

      } catch (error) {
        console.error(`Certificate monitoring error for ${requestId}:`, error);
        if (attempts < maxAttempts) {
          setTimeout(monitor, checkInterval * 2); // Back off on error
        }
      }
    };

    // Start monitoring after initial delay
    setTimeout(monitor, checkInterval);
  }

  /**
   * Complete certificate request after issuance
   * @param {string} requestId - Internal request ID
   * @param {string} certificate - Issued certificate (PEM format)
   */
  async completeCertificateRequest(requestId, certificate) {
    try {
      // Get request details
      const requestDoc = await getDoc(doc(db, 'certificate_requests', requestId));
      if (!requestDoc.exists()) {
        throw new Error(`Request ${requestId} not found`);
      }

      const requestData = requestDoc.data();
      
      // Parse certificate
      const certData = this.parseCertificate(certificate);
      
      // Generate certificate ID
      const certificateId = this.generateCertificateId();

      // Prepare certificate data for storage
      const certificateData = {
        certificateId,
        certificate,
        publicKey: await this.extractPublicKeyFromCertificate(certificate),
        privateKey: requestData.hsmKeyId ? null : requestData.keyPair.privateKey,
        issuer: certData.issuer,
        subject: certData.subject,
        serialNumber: certData.serialNumber,
        validFrom: certData.validFrom,
        validTo: certData.validTo,
        keyUsage: certData.keyUsage,
        provider: requestData.provider,
        requestId: requestData.caRequestId,
        userId: requestData.userId,
        hsmKeyId: requestData.hsmKeyId
      };

      // Store certificate using lifecycle service
      await CertificateLifecycleService.storeCertificate(certificateData);

      // Update request status
      await updateDoc(doc(db, 'certificate_requests', requestId), {
        status: 'completed',
        certificateId,
        completedAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`Certificate request ${requestId} completed successfully`);
      return { success: true, certificateId };

    } catch (error) {
      console.error('Failed to complete certificate request:', error);
      await this.updateRequestStatus(requestId, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Create digital signature with trusted timestamp
   * @param {Object} signatureRequest - Signature request parameters
   */
  async createDigitalSignatureWithTimestamp(signatureRequest) {
    const {
      certificateId,
      data,
      documentId,
      userId,
      timestampProvider = 'digicert',
      includeQualifiedTimestamp = true
    } = signatureRequest;

    try {
      // Use the timestamp integration service for enhanced signatures
      const result = await TimestampIntegrationService.createTimestampedSignature({
        certificateId,
        data,
        documentId,
        userId,
        timestampProvider,
        includeQualifiedTimestamp
      });

      return {
        success: true,
        signatureId: result.signatureId,
        timestampedSignature: result.timestampedSignature,
        timestampTime: result.timestampTime,
        legalValue: result.legalValue,
        qualified: result.qualified,
        provider: result.provider
      };

    } catch (error) {
      console.error('Timestamped digital signature creation failed:', error);
      throw error;
    }
  }
  async createDigitalSignature(signatureRequest) {
    const {
      certificateId,
      data,
      signatureFormat = 'PKCS7',
      includeTimestamp = true,
      signingPurpose = 'document_signing'
    } = signatureRequest;

    try {
      // Get certificate and key
      const certificate = await CertificateLifecycleService.getCertificate(
        certificateId,
        true // Include private key if not in HSM
      );

      if (certificate.status !== 'active') {
        throw new Error(`Certificate ${certificateId} is not active (status: ${certificate.status})`);
      }

      // Check certificate validity
      const now = new Date();
      if (now < new Date(certificate.validFrom) || now > new Date(certificate.validTo)) {
        throw new Error(`Certificate ${certificateId} is not valid at current time`);
      }

      let signature;

      // Sign with HSM or software key
      if (certificate.hsmKeyId) {
        signature = await HSMIntegrationService.signWithHSM(
          this.getHSMProviderForKey(certificate.hsmKeyId),
          certificate.hsmKeyId,
          data,
          {
            algorithm: 'RSA-PSS',
            hashAlgorithm: 'SHA-256'
          }
        );
      } else {
        signature = await this.signWithSoftwareKey(
          certificate.privateKey,
          data,
          {
            algorithm: 'RSA-PSS',
            hashAlgorithm: 'SHA-256'
          }
        );
      }

      // Create signature container
      const signatureContainer = await this.createSignatureContainer({
        signature: signature.signature || signature,
        certificate: certificate.certificate,
        data,
        signatureFormat,
        includeTimestamp,
        signingPurpose,
        signedAt: new Date()
      });

      // Store signature details
      const signatureId = await this.storeSignatureDetails({
        certificateId,
        signatureContainer,
        signatureFormat,
        signingPurpose,
        signedAt: new Date(),
        userId: certificate.userId
      });

      return {
        success: true,
        signatureId,
        signature: signatureContainer,
        certificate: certificate.certificate,
        signedAt: new Date()
      };

    } catch (error) {
      console.error('Digital signature creation failed:', error);
      throw error;
    }
  }

  async generateKeyPair(options = {}) {
    const {
      algorithm = 'RSA-PSS',
      keySize = 2048,
      namedCurve = 'P-256'
    } = options;

    try {
      let keyGenParams;
      let keyUsages = ['sign', 'verify'];

      if (algorithm === 'ECDSA') {
        keyGenParams = {
          name: 'ECDSA',
          namedCurve
        };
      } else {
        keyGenParams = {
          name: 'RSA-PSS',
          modulusLength: keySize,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256'
        };
      }

      const keyPair = await window.crypto.subtle.generateKey(
        keyGenParams,
        true,
        keyUsages
      );

      // Export keys
      const publicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
      const privateKey = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

      return {
        publicKey: this.arrayBufferToPem(publicKey, 'PUBLIC KEY'),
        privateKey: this.arrayBufferToPem(privateKey, 'PRIVATE KEY'),
        algorithm,
        keySize: algorithm === 'ECDSA' ? namedCurve : keySize
      };

    } catch (error) {
      console.error('Key pair generation failed:', error);
      throw error;
    }
  }

  getPreferredHSMProvider() {
    // Return the first available HSM provider
    const connections = HSMIntegrationService.getActiveConnections();
    return connections.length > 0 ? connections[0].name : null;
  }

  getHSMProviderForKey(keyId) {
    // Get HSM provider based on key ID
    // This would be stored in key metadata
    return 'aws-cloudhsm'; // Default for now
  }

  async signWithSoftwareKey(privateKeyPem, data, options) {
    const { algorithm = 'RSA-PSS', hashAlgorithm = 'SHA-256' } = options;
    
    try {
      // Import private key
      const privateKeyBuffer = this.pemToArrayBuffer(privateKeyPem);
      const privateKey = await window.crypto.subtle.importKey(
        'pkcs8',
        privateKeyBuffer,
        {
          name: algorithm,
          hash: hashAlgorithm
        },
        false,
        ['sign']
      );

      // Sign data
      const signature = await window.crypto.subtle.sign(
        {
          name: algorithm,
          saltLength: 32
        },
        privateKey,
        data
      );

      return {
        signature,
        algorithm,
        hashAlgorithm,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('Software signing failed:', error);
      throw error;
    }
  }

  // Helper methods and remaining implementation...
  generateCertificateId() {
    return `cert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  arrayBufferToPem(buffer, type) {
    const binary = String.fromCharCode.apply(null, new Uint8Array(buffer));
    const base64 = btoa(binary);
    const pem = base64.match(/.{1,64}/g).join('\n');
    return `-----BEGIN ${type}-----\n${pem}\n-----END ${type}-----`;
  }

  pemToArrayBuffer(pem) {
    const base64 = pem
      .replace(/-----BEGIN[^-]+-----/, '')
      .replace(/-----END[^-]+-----/, '')
      .replace(/\s/g, '');
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      view[i] = binary.charCodeAt(i);
    }
    return buffer;
  }

  // ... rest of the existing PKIService methods ...
}

// Export singleton instance
export default new PKIService();
