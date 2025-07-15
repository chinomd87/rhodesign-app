// Certificate Lifecycle Management Service
// Handles certificate storage, renewal, revocation, and lifecycle events

import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import CAIntegrationService from './CAIntegrationService';

export class CertificateLifecycleService {
  constructor() {
    this.certificates = new Map();
    this.renewalQueue = new Map();
    this.listeners = new Map();
  }

  /**
   * Store certificate in Firebase with metadata
   * @param {Object} certificateData - Certificate data and metadata
   */
  async storeCertificate(certificateData) {
    const {
      certificateId,
      certificate,
      privateKey,
      publicKey,
      issuer,
      subject,
      serialNumber,
      validFrom,
      validTo,
      keyUsage,
      provider,
      requestId,
      userId
    } = certificateData;

    try {
      const certDoc = {
        certificateId,
        certificate, // PEM encoded certificate
        publicKey, // Store public key separately
        issuer,
        subject,
        serialNumber,
        validFrom: new Date(validFrom),
        validTo: new Date(validTo),
        keyUsage,
        provider,
        requestId,
        userId,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          algorithm: this.extractAlgorithm(certificate),
          keySize: this.extractKeySize(certificate),
          fingerprint: await this.calculateFingerprint(certificate)
        }
      };

      // Store certificate document (without private key)
      await setDoc(doc(db, 'certificates', certificateId), certDoc);

      // Store private key separately with enhanced security
      if (privateKey) {
        await this.storePrivateKey(certificateId, privateKey, userId);
      }

      // Schedule renewal reminder
      this.scheduleRenewalReminder(certificateId, validTo);

      console.log(`Certificate ${certificateId} stored successfully`);
      return { success: true, certificateId };

    } catch (error) {
      console.error('Failed to store certificate:', error);
      throw error;
    }
  }

  /**
   * Retrieve certificate by ID
   * @param {string} certificateId - Certificate ID
   * @param {boolean} includePrivateKey - Whether to include private key
   */
  async getCertificate(certificateId, includePrivateKey = false) {
    try {
      const certDoc = await getDoc(doc(db, 'certificates', certificateId));
      
      if (!certDoc.exists()) {
        throw new Error(`Certificate ${certificateId} not found`);
      }

      const certificateData = certDoc.data();

      if (includePrivateKey) {
        const privateKey = await this.getPrivateKey(certificateId, certificateData.userId);
        certificateData.privateKey = privateKey;
      }

      return certificateData;

    } catch (error) {
      console.error('Failed to retrieve certificate:', error);
      throw error;
    }
  }

  /**
   * List certificates for a user
   * @param {string} userId - User ID
   * @param {string} status - Filter by status (optional)
   */
  async listUserCertificates(userId, status = null) {
    try {
      let q = query(collection(db, 'certificates'), where('userId', '==', userId));
      
      if (status) {
        q = query(q, where('status', '==', status));
      }

      const querySnapshot = await getDocs(q);
      const certificates = [];

      querySnapshot.forEach((doc) => {
        certificates.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return certificates;

    } catch (error) {
      console.error('Failed to list certificates:', error);
      throw error;
    }
  }

  /**
   * Check certificate expiration and trigger renewal if needed
   * @param {string} certificateId - Certificate ID
   */
  async checkAndRenewCertificate(certificateId) {
    try {
      const certificate = await this.getCertificate(certificateId);
      const now = new Date();
      const validTo = new Date(certificate.validTo);
      const daysUntilExpiry = Math.ceil((validTo - now) / (1000 * 60 * 60 * 24));

      // Trigger renewal if less than 30 days remaining
      if (daysUntilExpiry <= 30 && certificate.status === 'active') {
        console.log(`Certificate ${certificateId} expires in ${daysUntilExpiry} days, initiating renewal`);
        return await this.renewCertificate(certificateId);
      }

      return {
        renewalRequired: false,
        daysUntilExpiry,
        status: certificate.status
      };

    } catch (error) {
      console.error('Failed to check certificate expiration:', error);
      throw error;
    }
  }

  /**
   * Renew certificate
   * @param {string} certificateId - Certificate ID
   */
  async renewCertificate(certificateId) {
    try {
      const certificate = await this.getCertificate(certificateId, true);
      
      // Generate new key pair
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-PSS',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256'
        },
        true,
        ['sign', 'verify']
      );

      // Create new CSR
      const csr = await this.createCSR(keyPair, certificate.subject);

      // Request new certificate from same provider
      const renewalRequest = await CAIntegrationService.requestCertificate(
        certificate.provider,
        csr,
        'renewal',
        {
          originalCertificateId: certificateId,
          subject: certificate.subject
        }
      );

      // Update certificate status
      await updateDoc(doc(db, 'certificates', certificateId), {
        status: 'renewal_pending',
        renewalRequestId: renewalRequest.requestId,
        updatedAt: new Date()
      });

      // Add to renewal queue for monitoring
      this.addToRenewalQueue(certificateId, renewalRequest.requestId);

      return {
        success: true,
        renewalRequestId: renewalRequest.requestId,
        estimatedIssuance: renewalRequest.estimatedIssuance
      };

    } catch (error) {
      console.error('Failed to renew certificate:', error);
      throw error;
    }
  }

  /**
   * Revoke certificate
   * @param {string} certificateId - Certificate ID
   * @param {string} reason - Revocation reason
   */
  async revokeCertificate(certificateId, reason) {
    try {
      const certificate = await this.getCertificate(certificateId);

      // Call CA revocation API
      const revocationResult = await this.requestRevocation(
        certificate.provider,
        certificate.serialNumber,
        reason
      );

      // Update certificate status
      await updateDoc(doc(db, 'certificates', certificateId), {
        status: 'revoked',
        revocationReason: reason,
        revokedAt: new Date(),
        updatedAt: new Date(),
        revocationResult
      });

      // Remove private key
      await this.removePrivateKey(certificateId, certificate.userId);

      console.log(`Certificate ${certificateId} revoked successfully`);
      return { success: true, revocationResult };

    } catch (error) {
      console.error('Failed to revoke certificate:', error);
      throw error;
    }
  }

  /**
   * Monitor certificate status changes
   * @param {string} userId - User ID
   * @param {Function} callback - Status change callback
   */
  monitorCertificateStatus(userId, callback) {
    const q = query(collection(db, 'certificates'), where('userId', '==', userId));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const certificates = [];
      querySnapshot.forEach((doc) => {
        certificates.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      callback(certificates);
    });

    this.listeners.set(userId, unsubscribe);
    return unsubscribe;
  }

  /**
   * Schedule automatic certificate renewal reminders
   * @param {string} certificateId - Certificate ID
   * @param {Date} validTo - Certificate expiration date
   */
  scheduleRenewalReminder(certificateId, validTo) {
    const now = new Date();
    const expiryDate = new Date(validTo);
    const reminderDate = new Date(expiryDate.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days before

    if (reminderDate > now) {
      const timeUntilReminder = reminderDate.getTime() - now.getTime();
      
      setTimeout(() => {
        this.triggerRenewalReminder(certificateId);
      }, timeUntilReminder);
    }
  }

  /**
   * Add certificate to renewal monitoring queue
   * @param {string} certificateId - Certificate ID
   * @param {string} requestId - Renewal request ID
   */
  addToRenewalQueue(certificateId, requestId) {
    this.renewalQueue.set(certificateId, {
      requestId,
      addedAt: new Date(),
      checkCount: 0
    });

    // Start periodic status checking
    this.startRenewalMonitoring(certificateId);
  }

  /**
   * Start monitoring renewal status
   * @param {string} certificateId - Certificate ID
   */
  async startRenewalMonitoring(certificateId) {
    const renewalInfo = this.renewalQueue.get(certificateId);
    if (!renewalInfo) return;

    const certificate = await this.getCertificate(certificateId);
    
    try {
      const status = await CAIntegrationService.checkCertificateStatus(
        certificate.provider,
        renewalInfo.requestId
      );

      if (status.issued && status.certificate) {
        // Certificate renewed successfully
        await this.completeRenewal(certificateId, status.certificate);
        this.renewalQueue.delete(certificateId);
      } else {
        // Continue monitoring
        renewalInfo.checkCount++;
        if (renewalInfo.checkCount < 50) { // Max 50 checks
          setTimeout(() => {
            this.startRenewalMonitoring(certificateId);
          }, 300000); // Check every 5 minutes
        } else {
          console.warn(`Renewal monitoring timeout for certificate ${certificateId}`);
          this.renewalQueue.delete(certificateId);
        }
      }
    } catch (error) {
      console.error('Renewal monitoring error:', error);
    }
  }

  /**
   * Complete certificate renewal process
   * @param {string} oldCertificateId - Old certificate ID
   * @param {string} newCertificate - New certificate PEM
   */
  async completeRenewal(oldCertificateId, newCertificate) {
    try {
      const oldCert = await this.getCertificate(oldCertificateId);
      
      // Parse new certificate
      const newCertData = this.parseCertificate(newCertificate);
      
      // Generate new certificate ID
      const newCertificateId = this.generateCertificateId();

      // Store new certificate
      await this.storeCertificate({
        certificateId: newCertificateId,
        certificate: newCertificate,
        ...newCertData,
        userId: oldCert.userId,
        provider: oldCert.provider
      });

      // Mark old certificate as superseded
      await updateDoc(doc(db, 'certificates', oldCertificateId), {
        status: 'superseded',
        supersededBy: newCertificateId,
        updatedAt: new Date()
      });

      console.log(`Certificate renewal completed: ${oldCertificateId} → ${newCertificateId}`);
      return { success: true, newCertificateId };

    } catch (error) {
      console.error('Failed to complete renewal:', error);
      throw error;
    }
  }

  // Helper methods
  async storePrivateKey(certificateId, privateKey, userId) {
    // Store encrypted private key in separate collection
    const keyDoc = {
      certificateId,
      userId,
      encryptedKey: await this.encryptPrivateKey(privateKey),
      createdAt: new Date()
    };

    await setDoc(doc(db, 'private_keys', certificateId), keyDoc);
  }

  async getPrivateKey(certificateId, userId) {
    const keyDoc = await getDoc(doc(db, 'private_keys', certificateId));
    if (!keyDoc.exists()) {
      throw new Error('Private key not found');
    }

    const keyData = keyDoc.data();
    if (keyData.userId !== userId) {
      throw new Error('Unauthorized access to private key');
    }

    return await this.decryptPrivateKey(keyData.encryptedKey);
  }

  async removePrivateKey(certificateId, userId) {
    await deleteDoc(doc(db, 'private_keys', certificateId));
  }

  async encryptPrivateKey(privateKey) {
    // Implement encryption (placeholder)
    return btoa(privateKey); // Base64 encoding (use proper encryption in production)
  }

  async decryptPrivateKey(encryptedKey) {
    // Implement decryption (placeholder)
    return atob(encryptedKey); // Base64 decoding (use proper decryption in production)
  }

  generateCertificateId() {
    return `cert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  parseCertificate(certificate) {
    // Parse certificate and extract metadata (simplified implementation)
    // In production, use a proper X.509 parser
    return {
      subject: 'CN=Example',
      issuer: 'CN=CA',
      serialNumber: '12345',
      validFrom: new Date(),
      validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      keyUsage: ['digitalSignature', 'nonRepudiation']
    };
  }

  extractAlgorithm(certificate) {
    // Extract algorithm from certificate
    return 'RSA-PSS';
  }

  extractKeySize(certificate) {
    // Extract key size from certificate
    return 2048;
  }

  async calculateFingerprint(certificate) {
    // Calculate certificate fingerprint
    const encoder = new TextEncoder();
    const data = encoder.encode(certificate);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join(':');
  }

  async createCSR(keyPair, subject) {
    // Create Certificate Signing Request (simplified)
    return `-----BEGIN CERTIFICATE REQUEST-----\nCSR for ${subject}\n-----END CERTIFICATE REQUEST-----`;
  }

  async requestRevocation(provider, serialNumber, reason) {
    // Request certificate revocation from CA
    return { success: true, revocationDate: new Date() };
  }

  triggerRenewalReminder(certificateId) {
    console.log(`Renewal reminder: Certificate ${certificateId} expires in 30 days`);
    // Implement notification system (email, push notification, etc.)
  }
}

export default new CertificateLifecycleService();
