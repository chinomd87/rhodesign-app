// Compliance and Governance Service
// GDPR/CCPA compliance, data governance, and automated regulatory reporting

import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  writeBatch 
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase/config';

/**
 * Compliance and Governance Service
 * 
 * Provides comprehensive compliance management:
 * - GDPR/CCPA data protection compliance
 * - Data subject rights management (access, portability, deletion)
 * - Consent management and tracking
 * - Data processing purpose limitation
 * - Automated compliance reporting
 * - Data retention policy enforcement
 * - Privacy impact assessments
 * - Breach notification management
 */
class ComplianceService {
  constructor() {
    this.dataSubjectsCollection = collection(db, 'dataSubjects');
    this.consentCollection = collection(db, 'consentRecords');
    this.processingActivitiesCollection = collection(db, 'processingActivities');
    this.dataRequestsCollection = collection(db, 'dataSubjectRequests');
    this.breachCollection = collection(db, 'dataBreaches');
    this.auditCollection = collection(db, 'complianceAudit');
    this.retentionPoliciesCollection = collection(db, 'retentionPolicies');

    // Compliance frameworks
    this.frameworks = {
      gdpr: {
        name: 'General Data Protection Regulation',
        jurisdiction: 'EU',
        lawfulBases: [
          'consent',
          'contract',
          'legal_obligation',
          'vital_interests',
          'public_task',
          'legitimate_interests'
        ],
        dataSubjectRights: [
          'access',
          'rectification',
          'erasure',
          'restrict_processing',
          'data_portability',
          'object',
          'not_subject_to_automated_decision_making'
        ]
      },
      ccpa: {
        name: 'California Consumer Privacy Act',
        jurisdiction: 'California',
        consumerRights: [
          'know',
          'delete',
          'opt_out',
          'non_discrimination'
        ]
      },
      pipeda: {
        name: 'Personal Information Protection and Electronic Documents Act',
        jurisdiction: 'Canada'
      }
    };

    // Data categories for classification
    this.dataCategories = {
      identity: {
        name: 'Identity Data',
        examples: ['name', 'email', 'phone', 'address'],
        sensitivity: 'medium',
        retention: '7_years'
      },
      financial: {
        name: 'Financial Data',
        examples: ['payment_info', 'bank_details', 'transaction_history'],
        sensitivity: 'high',
        retention: '7_years'
      },
      biometric: {
        name: 'Biometric Data',
        examples: ['fingerprints', 'facial_recognition', 'voice_patterns'],
        sensitivity: 'very_high',
        retention: '1_year'
      },
      behavioral: {
        name: 'Behavioral Data',
        examples: ['usage_patterns', 'preferences', 'analytics'],
        sensitivity: 'medium',
        retention: '3_years'
      },
      technical: {
        name: 'Technical Data',
        examples: ['ip_address', 'device_id', 'cookies'],
        sensitivity: 'low',
        retention: '1_year'
      }
    };

    this.initializeComplianceFramework();
  }

  /**
   * Process data subject consent
   */
  async processConsent(consentData) {
    try {
      const {
        dataSubjectId,
        userId,
        email,
        consentType,
        purposes,
        lawfulBasis,
        jurisdiction,
        consentMethod,
        ipAddress,
        userAgent
      } = consentData;

      // Validate consent data
      this.validateConsentData(consentData);

      // Create consent record
      const consentRecord = {
        dataSubjectId: dataSubjectId || userId,
        userId,
        email,
        consentType, // 'explicit', 'implicit', 'legitimate_interest'
        purposes: purposes || [],
        lawfulBasis: lawfulBasis || 'consent',
        jurisdiction: jurisdiction || 'EU',
        status: 'active',
        consentMethod, // 'web_form', 'api', 'manual'
        metadata: {
          ipAddress,
          userAgent,
          timestamp: serverTimestamp(),
          version: '1.0'
        },
        withdrawalMethod: null,
        withdrawnAt: null,
        expiresAt: this.calculateConsentExpiry(consentType, jurisdiction)
      };

      const consentRef = await addDoc(this.consentCollection, consentRecord);

      // Update data subject record
      await this.updateDataSubjectRecord(dataSubjectId || userId, {
        lastConsentUpdate: serverTimestamp(),
        activeConsents: consentRecord.purposes,
        jurisdiction
      });

      // Log compliance event
      await this.logComplianceEvent({
        type: 'consent_granted',
        dataSubjectId: dataSubjectId || userId,
        details: {
          consentId: consentRef.id,
          purposes: purposes,
          lawfulBasis,
          jurisdiction
        }
      });

      return {
        success: true,
        consentId: consentRef.id,
        consent: {
          id: consentRef.id,
          ...consentRecord
        }
      };

    } catch (error) {
      console.error('Failed to process consent:', error);
      throw new Error(`Consent processing failed: ${error.message}`);
    }
  }

  /**
   * Withdraw consent
   */
  async withdrawConsent(withdrawalData) {
    try {
      const {
        consentId,
        dataSubjectId,
        withdrawalReason,
        withdrawalMethod,
        ipAddress,
        userAgent
      } = withdrawalData;

      // Get existing consent
      const consentDoc = await getDoc(doc(this.consentCollection, consentId));
      if (!consentDoc.exists()) {
        throw new Error('Consent record not found');
      }

      const consent = consentDoc.data();

      // Verify consent belongs to data subject
      if (consent.dataSubjectId !== dataSubjectId) {
        throw new Error('Unauthorized consent withdrawal attempt');
      }

      // Update consent record
      await updateDoc(doc(this.consentCollection, consentId), {
        status: 'withdrawn',
        withdrawalReason,
        withdrawalMethod,
        withdrawnAt: serverTimestamp(),
        withdrawalMetadata: {
          ipAddress,
          userAgent,
          timestamp: serverTimestamp()
        }
      });

      // Process data subject rights (e.g., stop processing, delete data)
      await this.processConsentWithdrawal(consent, withdrawalData);

      // Log compliance event
      await this.logComplianceEvent({
        type: 'consent_withdrawn',
        dataSubjectId,
        details: {
          consentId,
          withdrawalReason,
          affectedPurposes: consent.purposes
        }
      });

      return {
        success: true,
        message: 'Consent withdrawn successfully',
        effectiveDate: new Date(),
        affectedPurposes: consent.purposes
      };

    } catch (error) {
      console.error('Failed to withdraw consent:', error);
      throw new Error(`Consent withdrawal failed: ${error.message}`);
    }
  }

  /**
   * Handle data subject access request (GDPR Article 15, CCPA Right to Know)
   */
  async handleAccessRequest(requestData) {
    try {
      const {
        dataSubjectId,
        email,
        requestType = 'access',
        jurisdiction = 'EU',
        verificationMethod,
        requesterInfo
      } = requestData;

      // Create data subject request record
      const request = await this.createDataSubjectRequest({
        dataSubjectId,
        email,
        requestType,
        jurisdiction,
        verificationMethod,
        requesterInfo,
        status: 'pending_verification'
      });

      // Verify data subject identity
      const verificationResult = await this.verifyDataSubjectIdentity(request.requestId, verificationMethod);
      
      if (!verificationResult.verified) {
        await this.updateRequestStatus(request.requestId, 'verification_failed');
        throw new Error('Data subject identity verification failed');
      }

      // Update request status
      await this.updateRequestStatus(request.requestId, 'processing');

      // Collect all personal data
      const personalData = await this.collectPersonalData(dataSubjectId);

      // Generate access report
      const accessReport = await this.generateAccessReport(personalData, jurisdiction);

      // Update request with results
      await this.updateRequestStatus(request.requestId, 'completed', {
        completedAt: serverTimestamp(),
        dataProvided: true,
        reportGenerated: true
      });

      // Log compliance event
      await this.logComplianceEvent({
        type: 'access_request_fulfilled',
        dataSubjectId,
        details: {
          requestId: request.requestId,
          jurisdiction,
          dataCategories: Object.keys(personalData),
          reportSize: JSON.stringify(accessReport).length
        }
      });

      return {
        success: true,
        requestId: request.requestId,
        report: accessReport,
        deliveryMethod: 'secure_download',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      };

    } catch (error) {
      console.error('Failed to handle access request:', error);
      throw new Error(`Access request failed: ${error.message}`);
    }
  }

  /**
   * Handle data deletion request (GDPR Article 17, CCPA Right to Delete)
   */
  async handleDeletionRequest(requestData) {
    try {
      const {
        dataSubjectId,
        email,
        deletionScope = 'all', // 'all', 'specific_categories', 'specific_purposes'
        retainForLegal = false,
        jurisdiction = 'EU',
        verificationMethod,
        requesterInfo
      } = requestData;

      // Create deletion request
      const request = await this.createDataSubjectRequest({
        dataSubjectId,
        email,
        requestType: 'deletion',
        jurisdiction,
        verificationMethod,
        requesterInfo,
        requestDetails: {
          deletionScope,
          retainForLegal
        },
        status: 'pending_verification'
      });

      // Verify identity
      const verificationResult = await this.verifyDataSubjectIdentity(request.requestId, verificationMethod);
      
      if (!verificationResult.verified) {
        await this.updateRequestStatus(request.requestId, 'verification_failed');
        throw new Error('Identity verification failed');
      }

      // Check for legal obligations to retain data
      const retentionRequirements = await this.checkRetentionRequirements(dataSubjectId);
      
      await this.updateRequestStatus(request.requestId, 'processing');

      // Execute deletion based on scope and legal requirements
      const deletionResult = await this.executeDataDeletion(
        dataSubjectId, 
        deletionScope, 
        retentionRequirements,
        request.requestId
      );

      // Update request status
      await this.updateRequestStatus(request.requestId, 'completed', {
        completedAt: serverTimestamp(),
        deletionExecuted: true,
        itemsDeleted: deletionResult.deletedItems,
        itemsRetained: deletionResult.retainedItems
      });

      // Log compliance event
      await this.logComplianceEvent({
        type: 'deletion_request_fulfilled',
        dataSubjectId,
        details: {
          requestId: request.requestId,
          deletionScope,
          itemsDeleted: deletionResult.deletedItems,
          itemsRetained: deletionResult.retainedItems,
          retentionReasons: retentionRequirements
        }
      });

      return {
        success: true,
        requestId: request.requestId,
        deletionSummary: {
          totalItemsDeleted: deletionResult.deletedItems,
          totalItemsRetained: deletionResult.retainedItems,
          retentionReasons: retentionRequirements,
          completionDate: new Date()
        }
      };

    } catch (error) {
      console.error('Failed to handle deletion request:', error);
      throw new Error(`Deletion request failed: ${error.message}`);
    }
  }

  /**
   * Handle data portability request (GDPR Article 20)
   */
  async handlePortabilityRequest(requestData) {
    try {
      const {
        dataSubjectId,
        email,
        format = 'json', // 'json', 'csv', 'xml'
        jurisdiction = 'EU',
        verificationMethod,
        transferTo = null // Optional: direct transfer to another controller
      } = requestData;

      // Create portability request
      const request = await this.createDataSubjectRequest({
        dataSubjectId,
        email,
        requestType: 'portability',
        jurisdiction,
        verificationMethod,
        requestDetails: {
          format,
          transferTo
        },
        status: 'pending_verification'
      });

      // Verify identity
      const verificationResult = await this.verifyDataSubjectIdentity(request.requestId, verificationMethod);
      
      if (!verificationResult.verified) {
        await this.updateRequestStatus(request.requestId, 'verification_failed');
        throw new Error('Identity verification failed');
      }

      await this.updateRequestStatus(request.requestId, 'processing');

      // Collect portable data (only data provided by data subject and processed by consent/contract)
      const portableData = await this.collectPortableData(dataSubjectId);

      // Generate portable format
      const portableFile = await this.generatePortableFile(portableData, format);

      // Handle direct transfer if requested
      if (transferTo) {
        await this.initiateDirectTransfer(portableFile, transferTo, request.requestId);
      }

      await this.updateRequestStatus(request.requestId, 'completed', {
        completedAt: serverTimestamp(),
        dataExported: true,
        exportFormat: format,
        directTransfer: !!transferTo
      });

      // Log compliance event
      await this.logComplianceEvent({
        type: 'portability_request_fulfilled',
        dataSubjectId,
        details: {
          requestId: request.requestId,
          format,
          transferTo,
          dataSize: portableFile.size
        }
      });

      return {
        success: true,
        requestId: request.requestId,
        exportFile: portableFile,
        directTransfer: transferTo ? {
          recipient: transferTo,
          transferInitiated: true
        } : null
      };

    } catch (error) {
      console.error('Failed to handle portability request:', error);
      throw new Error(`Portability request failed: ${error.message}`);
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(reportType, parameters = {}) {
    try {
      const {
        startDate,
        endDate,
        jurisdiction = 'EU',
        framework = 'gdpr',
        includeMetrics = true,
        includeBreaches = true,
        includeRequests = true
      } = parameters;

      const report = {
        id: `report_${Date.now()}`,
        type: reportType,
        framework,
        jurisdiction,
        generatedAt: new Date(),
        period: {
          startDate: startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
          endDate: endDate || new Date()
        },
        summary: {},
        details: {}
      };

      // Generate different report types
      switch (reportType) {
        case 'data_protection_impact_assessment':
          report.details = await this.generateDPIAReport(parameters);
          break;

        case 'processing_activities':
          report.details = await this.generateProcessingActivitiesReport(parameters);
          break;

        case 'consent_management':
          report.details = await this.generateConsentReport(parameters);
          break;

        case 'data_subject_requests':
          report.details = await this.generateDataSubjectRequestsReport(parameters);
          break;

        case 'data_breaches':
          report.details = await this.generateDataBreachesReport(parameters);
          break;

        case 'comprehensive':
          report.details = {
            processing: await this.generateProcessingActivitiesReport(parameters),
            consent: await this.generateConsentReport(parameters),
            requests: await this.generateDataSubjectRequestsReport(parameters),
            breaches: await this.generateDataBreachesReport(parameters)
          };
          break;

        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }

      // Generate summary metrics
      if (includeMetrics) {
        report.summary = await this.generateReportMetrics(report.details, framework);
      }

      // Store report
      await addDoc(collection(db, 'complianceReports'), report);

      // Log report generation
      await this.logComplianceEvent({
        type: 'compliance_report_generated',
        details: {
          reportId: report.id,
          reportType,
          framework,
          jurisdiction
        }
      });

      return {
        success: true,
        report
      };

    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw new Error(`Report generation failed: ${error.message}`);
    }
  }

  /**
   * Perform automated compliance check
   */
  async performComplianceCheck(checkType = 'full') {
    try {
      const checks = {
        consent: await this.checkConsentCompliance(),
        retention: await this.checkRetentionCompliance(),
        processing: await this.checkProcessingCompliance(),
        security: await this.checkSecurityCompliance(),
        documentation: await this.checkDocumentationCompliance()
      };

      // Calculate overall compliance score
      const scores = Object.values(checks).map(check => check.score);
      const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      // Identify critical issues
      const criticalIssues = [];
      Object.entries(checks).forEach(([area, check]) => {
        criticalIssues.push(...check.issues.filter(issue => issue.severity === 'critical'));
      });

      // Generate recommendations
      const recommendations = this.generateComplianceRecommendations(checks);

      const result = {
        checkId: `check_${Date.now()}`,
        timestamp: new Date(),
        overallScore: Math.round(overallScore),
        status: overallScore >= 80 ? 'compliant' : overallScore >= 60 ? 'partially_compliant' : 'non_compliant',
        areas: checks,
        criticalIssues,
        recommendations,
        nextCheckDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      };

      // Store compliance check result
      await addDoc(collection(db, 'complianceChecks'), result);

      // Log compliance check
      await this.logComplianceEvent({
        type: 'compliance_check_performed',
        details: {
          checkId: result.checkId,
          overallScore,
          status: result.status,
          criticalIssuesCount: criticalIssues.length
        }
      });

      return {
        success: true,
        complianceCheck: result
      };

    } catch (error) {
      console.error('Failed to perform compliance check:', error);
      throw new Error(`Compliance check failed: ${error.message}`);
    }
  }

  // Helper methods

  validateConsentData(consentData) {
    if (!consentData.userId && !consentData.dataSubjectId) {
      throw new Error('User ID or Data Subject ID is required');
    }

    if (!consentData.purposes || consentData.purposes.length === 0) {
      throw new Error('At least one processing purpose is required');
    }

    if (consentData.jurisdiction === 'EU' && !consentData.lawfulBasis) {
      throw new Error('Lawful basis is required for GDPR compliance');
    }
  }

  calculateConsentExpiry(consentType, jurisdiction) {
    // GDPR doesn't specify consent expiry, but best practice is 1-2 years
    if (jurisdiction === 'EU') {
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 2); // 2 years
      return expiry;
    }

    // Other jurisdictions may have different requirements
    return null;
  }

  async updateDataSubjectRecord(dataSubjectId, updates) {
    const subjectRef = doc(this.dataSubjectsCollection, dataSubjectId);
    const subjectDoc = await getDoc(subjectRef);

    if (subjectDoc.exists()) {
      await updateDoc(subjectRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(subjectRef, {
        id: dataSubjectId,
        ...updates,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  }

  async processConsentWithdrawal(consent, withdrawalData) {
    // Stop processing data for withdrawn purposes
    const affectedPurposes = consent.purposes;
    
    // This would trigger data processing stops based on purposes
    for (const purpose of affectedPurposes) {
      await this.stopProcessingForPurpose(consent.dataSubjectId, purpose);
    }

    // If all consent withdrawn, consider data deletion
    if (affectedPurposes.includes('all') || consent.consentType === 'comprehensive') {
      await this.scheduleDataDeletion(consent.dataSubjectId, 'consent_withdrawal');
    }
  }

  async createDataSubjectRequest(requestData) {
    const requestRef = await addDoc(this.dataRequestsCollection, {
      ...requestData,
      requestId: null, // Will be set after creation
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await updateDoc(requestRef, { requestId: requestRef.id });

    return {
      requestId: requestRef.id,
      ...requestData
    };
  }

  async verifyDataSubjectIdentity(requestId, verificationMethod) {
    // Mock verification - in production this would integrate with identity verification services
    return {
      verified: true,
      method: verificationMethod,
      confidence: 'high',
      timestamp: new Date()
    };
  }

  async updateRequestStatus(requestId, status, additionalData = {}) {
    await updateDoc(doc(this.dataRequestsCollection, requestId), {
      status,
      ...additionalData,
      updatedAt: serverTimestamp()
    });
  }

  async collectPersonalData(dataSubjectId) {
    // Collect all personal data across different collections
    const personalData = {
      profile: await this.getUserProfile(dataSubjectId),
      documents: await this.getUserDocuments(dataSubjectId),
      signatures: await this.getUserSignatures(dataSubjectId),
      audit: await this.getUserAuditLogs(dataSubjectId),
      consent: await this.getUserConsent(dataSubjectId)
    };

    return personalData;
  }

  async generateAccessReport(personalData, jurisdiction) {
    const report = {
      dataSubject: personalData.profile,
      dataCategories: Object.keys(personalData),
      processingPurposes: this.extractProcessingPurposes(personalData),
      legalBases: this.extractLegalBases(personalData),
      dataRetention: this.getRetentionPeriods(personalData),
      thirdPartyDisclosures: this.getThirdPartyDisclosures(personalData),
      dataTransfers: this.getInternationalTransfers(personalData),
      rights: this.getDataSubjectRights(jurisdiction),
      generatedAt: new Date()
    };

    return report;
  }

  async executeDataDeletion(dataSubjectId, deletionScope, retentionRequirements, requestId) {
    const batch = writeBatch(db);
    let deletedItems = 0;
    let retainedItems = 0;

    // Define collections to check for user data
    const userDataCollections = [
      'users',
      'documents',
      'signatures',
      'signingWorkflows',
      'ssoSessions',
      'userBehaviorProfiles'
    ];

    for (const collectionName of userDataCollections) {
      const q = query(
        collection(db, collectionName),
        where('userId', '==', dataSubjectId)
      );

      const snapshot = await getDocs(q);
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Check if data must be retained for legal reasons
        const mustRetain = this.checkMustRetain(data, retentionRequirements);
        
        if (mustRetain) {
          // Pseudonymize instead of delete
          batch.update(doc.ref, {
            userId: `pseudonymized_${Date.now()}`,
            personalDataRemoved: true,
            removalReason: 'data_subject_request',
            removalDate: serverTimestamp(),
            requestId
          });
          retainedItems++;
        } else {
          // Delete the document
          batch.delete(doc.ref);
          deletedItems++;
        }
      });
    }

    await batch.commit();

    return { deletedItems, retainedItems };
  }

  async initializeComplianceFramework() {
    // Initialize default compliance policies and procedures
    console.log('Compliance framework initialized');
  }

  async logComplianceEvent(event) {
    try {
      await addDoc(this.auditCollection, {
        ...event,
        timestamp: serverTimestamp(),
        source: 'compliance_service'
      });
    } catch (error) {
      console.error('Failed to log compliance event:', error);
    }
  }

  // Additional helper methods would be implemented here...
  async getUserProfile(userId) { return {}; }
  async getUserDocuments(userId) { return []; }
  async getUserSignatures(userId) { return []; }
  async getUserAuditLogs(userId) { return []; }
  async getUserConsent(userId) { return []; }
  async checkRetentionRequirements(dataSubjectId) { return []; }
  async stopProcessingForPurpose(dataSubjectId, purpose) { }
  async scheduleDataDeletion(dataSubjectId, reason) { }
  extractProcessingPurposes(data) { return []; }
  extractLegalBases(data) { return []; }
  getRetentionPeriods(data) { return {}; }
  getThirdPartyDisclosures(data) { return []; }
  getInternationalTransfers(data) { return []; }
  getDataSubjectRights(jurisdiction) { return this.frameworks[jurisdiction.toLowerCase()]?.dataSubjectRights || []; }
  checkMustRetain(data, requirements) { return false; }
  async collectPortableData(dataSubjectId) { return {}; }
  async generatePortableFile(data, format) { return { size: 0, url: '' }; }
  async initiateDirectTransfer(file, recipient, requestId) { }
  async generateDPIAReport(params) { return {}; }
  async generateProcessingActivitiesReport(params) { return {}; }
  async generateConsentReport(params) { return {}; }
  async generateDataSubjectRequestsReport(params) { return {}; }
  async generateDataBreachesReport(params) { return {}; }
  async generateReportMetrics(details, framework) { return {}; }
  async checkConsentCompliance() { return { score: 85, issues: [] }; }
  async checkRetentionCompliance() { return { score: 90, issues: [] }; }
  async checkProcessingCompliance() { return { score: 88, issues: [] }; }
  async checkSecurityCompliance() { return { score: 92, issues: [] }; }
  async checkDocumentationCompliance() { return { score: 87, issues: [] }; }
  generateComplianceRecommendations(checks) { return []; }
}

export default new ComplianceService();
