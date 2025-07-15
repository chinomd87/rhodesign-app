// Data Loss Prevention Service
// Content scanning, policy enforcement, and data leak prevention

import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where, 
  orderBy,
  limit,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase/config';

/**
 * Data Loss Prevention Service
 * 
 * Provides comprehensive DLP capabilities:
 * - Real-time content scanning and classification
 * - Sensitive data detection (PII, PHI, financial data)
 * - Policy-based access controls and blocking
 * - Document watermarking and tracking
 * - Egress monitoring and prevention
 * - Incident response and reporting
 * - Machine learning-based anomaly detection
 * - Integration with document signing workflows
 */
class DataLossPreventionService {
  constructor() {
    this.dlpPoliciesCollection = collection(db, 'dlpPolicies');
    this.contentScansCollection = collection(db, 'contentScans');
    this.dlpIncidentsCollection = collection(db, 'dlpIncidents');
    this.dataClassificationCollection = collection(db, 'dataClassification');
    this.watermarksCollection = collection(db, 'documentWatermarks');
    this.egressMonitoringCollection = collection(db, 'egressMonitoring');

    // Content classification patterns
    this.classificationPatterns = {
      pii: {
        ssn: {
          pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
          confidence: 0.9,
          description: 'Social Security Number'
        },
        creditCard: {
          pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
          confidence: 0.8,
          description: 'Credit Card Number',
          validator: this.validateCreditCard
        },
        email: {
          pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
          confidence: 0.7,
          description: 'Email Address'
        },
        phone: {
          pattern: /\b(?:\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
          confidence: 0.8,
          description: 'Phone Number'
        },
        driversLicense: {
          pattern: /\b[A-Z]{1,2}\d{6,8}\b/g,
          confidence: 0.6,
          description: 'Driver\'s License'
        }
      },
      phi: {
        mrn: {
          pattern: /\b(?:MRN|Medical Record|Patient ID)[\s:]*([\w\d-]+)\b/gi,
          confidence: 0.8,
          description: 'Medical Record Number'
        },
        dob: {
          pattern: /\b(?:DOB|Date of Birth|Born)[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/gi,
          confidence: 0.7,
          description: 'Date of Birth'
        },
        insurance: {
          pattern: /\b(?:Insurance|Policy)[\s#:]*([A-Z0-9]{8,15})\b/gi,
          confidence: 0.6,
          description: 'Insurance Number'
        }
      },
      financial: {
        bankAccount: {
          pattern: /\b(?:Account|Acct)[\s#:]*(\d{8,17})\b/gi,
          confidence: 0.7,
          description: 'Bank Account Number'
        },
        routingNumber: {
          pattern: /\b(?:Routing|ABA)[\s#:]*(\d{9})\b/gi,
          confidence: 0.8,
          description: 'Bank Routing Number'
        },
        iban: {
          pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g,
          confidence: 0.8,
          description: 'IBAN'
        }
      },
      intellectual_property: {
        confidential: {
          pattern: /\b(?:CONFIDENTIAL|PROPRIETARY|INTERNAL USE|TRADE SECRET)\b/gi,
          confidence: 0.9,
          description: 'Confidential Information'
        },
        copyright: {
          pattern: /\b(?:©|Copyright|All Rights Reserved)\b/gi,
          confidence: 0.8,
          description: 'Copyright Notice'
        }
      },
      legal: {
        attorney_client: {
          pattern: /\b(?:Attorney[- ]Client|Legal[- ]Privilege|Privileged)\b/gi,
          confidence: 0.9,
          description: 'Attorney-Client Privileged'
        },
        contract: {
          pattern: /\b(?:AGREEMENT|CONTRACT|WHEREAS|PARTY OF THE FIRST PART)\b/gi,
          confidence: 0.7,
          description: 'Contract/Agreement'
        }
      }
    };

    // DLP policies
    this.defaultPolicies = {
      block_high_risk_pii: {
        name: 'Block High-Risk PII',
        enabled: true,
        action: 'block',
        priority: 'high',
        conditions: {
          dataTypes: ['ssn', 'creditCard'],
          minimumConfidence: 0.8,
          context: ['email', 'upload', 'sharing']
        }
      },
      monitor_phi: {
        name: 'Monitor PHI Access',
        enabled: true,
        action: 'monitor',
        priority: 'high',
        conditions: {
          dataTypes: ['mrn', 'dob', 'insurance'],
          minimumConfidence: 0.7,
          context: ['access', 'download']
        }
      },
      watermark_confidential: {
        name: 'Watermark Confidential Documents',
        enabled: true,
        action: 'watermark',
        priority: 'medium',
        conditions: {
          dataTypes: ['confidential', 'intellectual_property'],
          minimumConfidence: 0.8,
          context: ['download', 'sharing']
        }
      }
    };

    this.initializeDLPService();
  }

  /**
   * Scan content for sensitive data
   */
  async scanContent(scanRequest) {
    try {
      const {
        content,
        contentType = 'text', // 'text', 'document', 'image'
        context = 'upload', // 'upload', 'access', 'sharing', 'email'
        userId,
        documentId,
        scanId = `scan_${Date.now()}`
      } = scanRequest;

      const scanResult = {
        scanId,
        timestamp: new Date(),
        contentType,
        context,
        userId,
        documentId,
        detections: [],
        riskScore: 0,
        classification: 'unknown',
        policyViolations: [],
        recommendedActions: []
      };

      // Extract text content based on type
      const textContent = await this.extractTextContent(content, contentType);

      // Perform pattern-based detection
      const patternDetections = await this.performPatternDetection(textContent);
      scanResult.detections.push(...patternDetections);

      // Perform ML-based classification
      const mlDetections = await this.performMLClassification(textContent);
      scanResult.detections.push(...mlDetections);

      // Calculate risk score
      scanResult.riskScore = this.calculateRiskScore(scanResult.detections);
      scanResult.classification = this.classifyContent(scanResult.detections, scanResult.riskScore);

      // Check policy violations
      const policyViolations = await this.checkPolicyViolations(scanResult, context);
      scanResult.policyViolations = policyViolations;

      // Generate recommendations
      scanResult.recommendedActions = this.generateRecommendations(scanResult);

      // Store scan result
      await addDoc(this.contentScansCollection, {
        ...scanResult,
        createdAt: serverTimestamp()
      });

      // Process policy actions
      await this.processPolicyActions(scanResult);

      // Log DLP event
      await this.logDLPEvent({
        type: 'content_scanned',
        scanId,
        userId,
        documentId,
        riskScore: scanResult.riskScore,
        violationsCount: policyViolations.length,
        context
      });

      return {
        success: true,
        scanResult
      };

    } catch (error) {
      console.error('Failed to scan content:', error);
      throw new Error(`Content scanning failed: ${error.message}`);
    }
  }

  /**
   * Apply document watermark
   */
  async applyWatermark(watermarkRequest) {
    try {
      const {
        documentId,
        userId,
        watermarkType = 'dynamic', // 'static', 'dynamic', 'invisible'
        watermarkText,
        position = 'center',
        opacity = 0.3,
        trackingEnabled = true
      } = watermarkRequest;

      const watermarkId = `watermark_${Date.now()}`;

      // Generate watermark content
      const watermarkContent = watermarkText || this.generateDynamicWatermark(userId, documentId);

      // Apply watermark based on type
      const watermarkResult = await this.generateWatermark({
        documentId,
        watermarkId,
        type: watermarkType,
        content: watermarkContent,
        position,
        opacity,
        userId
      });

      // Store watermark record
      const watermarkRecord = {
        watermarkId,
        documentId,
        userId,
        type: watermarkType,
        content: watermarkContent,
        position,
        opacity,
        trackingEnabled,
        createdAt: serverTimestamp(),
        status: 'applied',
        metadata: {
          ipAddress: watermarkRequest.ipAddress,
          userAgent: watermarkRequest.userAgent,
          timestamp: new Date()
        }
      };

      await addDoc(this.watermarksCollection, watermarkRecord);

      // Enable tracking if requested
      if (trackingEnabled) {
        await this.enableWatermarkTracking(watermarkId, documentId);
      }

      // Log DLP event
      await this.logDLPEvent({
        type: 'watermark_applied',
        watermarkId,
        documentId,
        userId,
        watermarkType
      });

      return {
        success: true,
        watermarkId,
        watermarkContent,
        trackingEnabled
      };

    } catch (error) {
      console.error('Failed to apply watermark:', error);
      throw new Error(`Watermarking failed: ${error.message}`);
    }
  }

  /**
   * Monitor egress activities
   */
  async monitorEgress(egressRequest) {
    try {
      const {
        userId,
        action, // 'download', 'email', 'share', 'print'
        documentId,
        recipients = [],
        destination,
        contentSize,
        metadata = {}
      } = egressRequest;

      const egressId = `egress_${Date.now()}`;

      // Analyze egress pattern
      const patternAnalysis = await this.analyzeEgressPattern(userId, action, documentId);

      // Check for anomalies
      const anomalyDetection = await this.detectEgressAnomalies(userId, action, {
        documentId,
        recipients,
        destination,
        contentSize,
        timestamp: new Date()
      });

      // Apply egress policies
      const policyResult = await this.applyEgressPolicies({
        userId,
        action,
        documentId,
        recipients,
        destination,
        patternAnalysis,
        anomalyDetection
      });

      // Create egress record
      const egressRecord = {
        egressId,
        userId,
        action,
        documentId,
        recipients,
        destination,
        contentSize,
        timestamp: new Date(),
        patternAnalysis,
        anomalyDetection,
        policyResult,
        status: policyResult.allowed ? 'allowed' : 'blocked',
        metadata,
        createdAt: serverTimestamp()
      };

      await addDoc(this.egressMonitoringCollection, egressRecord);

      // Handle blocked egress
      if (!policyResult.allowed) {
        await this.handleBlockedEgress(egressRecord);
      }

      // Log DLP event
      await this.logDLPEvent({
        type: 'egress_monitored',
        egressId,
        userId,
        action,
        documentId,
        status: egressRecord.status,
        anomaliesDetected: anomalyDetection.anomalies.length
      });

      return {
        success: true,
        egressId,
        allowed: policyResult.allowed,
        reason: policyResult.reason,
        anomalies: anomalyDetection.anomalies,
        recommendations: policyResult.recommendations
      };

    } catch (error) {
      console.error('Failed to monitor egress:', error);
      throw new Error(`Egress monitoring failed: ${error.message}`);
    }
  }

  /**
   * Create DLP incident
   */
  async createIncident(incidentData) {
    try {
      const {
        type, // 'policy_violation', 'data_leak', 'unauthorized_access'
        severity, // 'low', 'medium', 'high', 'critical'
        userId,
        documentId,
        description,
        evidence = {},
        assignedTo = null
      } = incidentData;

      const incidentId = `incident_${Date.now()}`;

      const incident = {
        incidentId,
        type,
        severity,
        userId,
        documentId,
        description,
        evidence,
        status: 'open',
        assignedTo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        timeline: [{
          action: 'incident_created',
          timestamp: new Date(),
          details: 'Incident automatically created by DLP system'
        }],
        containmentActions: [],
        remediationActions: []
      };

      await addDoc(this.dlpIncidentsCollection, incident);

      // Auto-assign based on severity
      if (severity === 'critical' || severity === 'high') {
        await this.autoAssignIncident(incidentId, severity);
      }

      // Trigger containment actions for critical incidents
      if (severity === 'critical') {
        await this.triggerEmergencyContainment(incident);
      }

      // Send notifications
      await this.sendIncidentNotifications(incident);

      // Log DLP event
      await this.logDLPEvent({
        type: 'incident_created',
        incidentId,
        severity,
        userId,
        documentId,
        incidentType: type
      });

      return {
        success: true,
        incidentId,
        incident
      };

    } catch (error) {
      console.error('Failed to create DLP incident:', error);
      throw new Error(`Incident creation failed: ${error.message}`);
    }
  }

  /**
   * Generate DLP report
   */
  async generateDLPReport(reportRequest) {
    try {
      const {
        type = 'summary', // 'summary', 'detailed', 'compliance'
        startDate,
        endDate,
        userId = null,
        department = null,
        includeCharts = true
      } = reportRequest;

      const report = {
        id: `dlp_report_${Date.now()}`,
        type,
        generatedAt: new Date(),
        period: {
          startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          endDate: endDate || new Date()
        },
        filters: { userId, department },
        summary: {},
        details: {},
        charts: includeCharts ? {} : null
      };

      // Generate report based on type
      switch (type) {
        case 'summary':
          report.summary = await this.generateSummaryMetrics(report.period, { userId, department });
          break;

        case 'detailed':
          report.details = await this.generateDetailedAnalysis(report.period, { userId, department });
          break;

        case 'compliance':
          report.details = await this.generateComplianceReport(report.period, { userId, department });
          break;

        default:
          throw new Error(`Unsupported report type: ${type}`);
      }

      // Generate charts if requested
      if (includeCharts) {
        report.charts = await this.generateReportCharts(report.summary, report.details);
      }

      // Store report
      await addDoc(collection(db, 'dlpReports'), report);

      return {
        success: true,
        report
      };

    } catch (error) {
      console.error('Failed to generate DLP report:', error);
      throw new Error(`DLP report generation failed: ${error.message}`);
    }
  }

  // Helper methods

  async extractTextContent(content, contentType) {
    switch (contentType) {
      case 'text':
        return content;
      
      case 'document':
        // In production, this would use document parsing libraries
        return this.extractTextFromDocument(content);
      
      case 'image':
        // In production, this would use OCR services
        return this.extractTextFromImage(content);
      
      default:
        return String(content);
    }
  }

  async performPatternDetection(textContent) {
    const detections = [];

    // Iterate through all classification patterns
    for (const [category, patterns] of Object.entries(this.classificationPatterns)) {
      for (const [type, pattern] of Object.entries(patterns)) {
        const matches = textContent.match(pattern.pattern);
        
        if (matches) {
          for (const match of matches) {
            // Additional validation if available
            let isValid = true;
            if (pattern.validator) {
              isValid = pattern.validator(match);
            }

            if (isValid) {
              detections.push({
                type,
                category,
                match: match.replace(/./g, '*'), // Mask the actual value
                confidence: pattern.confidence,
                description: pattern.description,
                position: textContent.indexOf(match),
                method: 'pattern'
              });
            }
          }
        }
      }
    }

    return detections;
  }

  async performMLClassification(textContent) {
    // Mock ML classification - in production this would call ML services
    const mlDetections = [];

    // Simulate ML detection based on content analysis
    const sensitivityIndicators = [
      'confidential', 'private', 'sensitive', 'classified',
      'personal', 'financial', 'medical', 'proprietary'
    ];

    const foundIndicators = sensitivityIndicators.filter(indicator => 
      textContent.toLowerCase().includes(indicator)
    );

    if (foundIndicators.length > 0) {
      mlDetections.push({
        type: 'sensitive_context',
        category: 'general',
        indicators: foundIndicators,
        confidence: Math.min(0.6 + (foundIndicators.length * 0.1), 0.9),
        description: 'ML-detected sensitive context',
        method: 'machine_learning'
      });
    }

    return mlDetections;
  }

  calculateRiskScore(detections) {
    if (detections.length === 0) return 0;

    // Weight detections by confidence and category
    const categoryWeights = {
      pii: 1.0,
      phi: 1.0,
      financial: 0.9,
      intellectual_property: 0.8,
      legal: 0.7,
      general: 0.5
    };

    let totalScore = 0;
    let maxScore = 0;

    detections.forEach(detection => {
      const weight = categoryWeights[detection.category] || 0.5;
      const score = detection.confidence * weight * 100;
      totalScore += score;
      maxScore = Math.max(maxScore, score);
    });

    // Return the higher of average score or max single detection score
    const avgScore = totalScore / detections.length;
    return Math.min(Math.max(avgScore, maxScore), 100);
  }

  classifyContent(detections, riskScore) {
    if (riskScore >= 80) return 'highly_sensitive';
    if (riskScore >= 60) return 'sensitive';
    if (riskScore >= 40) return 'restricted';
    if (riskScore >= 20) return 'internal';
    return 'public';
  }

  async checkPolicyViolations(scanResult, context) {
    const violations = [];
    const policies = await this.getActivePolicies();

    for (const policy of policies) {
      if (this.isPolicyViolated(scanResult, policy, context)) {
        violations.push({
          policyId: policy.id,
          policyName: policy.name,
          action: policy.action,
          priority: policy.priority,
          reason: this.getPolicyViolationReason(scanResult, policy)
        });
      }
    }

    return violations;
  }

  generateRecommendations(scanResult) {
    const recommendations = [];

    if (scanResult.riskScore >= 80) {
      recommendations.push({
        type: 'immediate_action',
        action: 'block_and_review',
        reason: 'High-risk content detected'
      });
    }

    if (scanResult.detections.some(d => d.category === 'pii')) {
      recommendations.push({
        type: 'encryption',
        action: 'encrypt_document',
        reason: 'PII detected - encryption recommended'
      });
    }

    if (scanResult.detections.some(d => d.category === 'confidential')) {
      recommendations.push({
        type: 'watermark',
        action: 'apply_watermark',
        reason: 'Confidential content - watermark required'
      });
    }

    return recommendations;
  }

  async processPolicyActions(scanResult) {
    for (const violation of scanResult.policyViolations) {
      switch (violation.action) {
        case 'block':
          await this.blockContent(scanResult, violation);
          break;
        
        case 'watermark':
          await this.applyWatermark({
            documentId: scanResult.documentId,
            userId: scanResult.userId,
            watermarkType: 'dynamic'
          });
          break;
        
        case 'monitor':
          await this.enhanceMonitoring(scanResult, violation);
          break;
        
        case 'alert':
          await this.sendPolicyAlert(scanResult, violation);
          break;
      }
    }
  }

  validateCreditCard(cardNumber) {
    // Luhn algorithm for credit card validation
    const num = cardNumber.replace(/\D/g, '');
    let sum = 0;
    let isEven = false;

    for (let i = num.length - 1; i >= 0; i--) {
      let digit = parseInt(num.charAt(i), 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return (sum % 10) === 0;
  }

  generateDynamicWatermark(userId, documentId) {
    const timestamp = new Date().toISOString();
    return `${userId}-${documentId}-${timestamp}`;
  }

  async initializeDLPService() {
    // Initialize default policies
    for (const [key, policy] of Object.entries(this.defaultPolicies)) {
      const policyDoc = await getDoc(doc(this.dlpPoliciesCollection, key));
      if (!policyDoc.exists()) {
        await setDoc(doc(this.dlpPoliciesCollection, key), {
          ...policy,
          id: key,
          createdAt: serverTimestamp()
        });
      }
    }

    console.log('DLP Service initialized');
  }

  async logDLPEvent(event) {
    try {
      await addDoc(collection(db, 'dlpEvents'), {
        ...event,
        timestamp: serverTimestamp(),
        source: 'dlp_service'
      });
    } catch (error) {
      console.error('Failed to log DLP event:', error);
    }
  }

  // Additional helper methods would be implemented here...
  async extractTextFromDocument(content) { return ''; }
  async extractTextFromImage(content) { return ''; }
  async getActivePolicies() { return Object.values(this.defaultPolicies); }
  isPolicyViolated(scanResult, policy, context) { return false; }
  getPolicyViolationReason(scanResult, policy) { return ''; }
  async blockContent(scanResult, violation) { }
  async enhanceMonitoring(scanResult, violation) { }
  async sendPolicyAlert(scanResult, violation) { }
  async generateWatermark(params) { return {}; }
  async enableWatermarkTracking(watermarkId, documentId) { }
  async analyzeEgressPattern(userId, action, documentId) { return {}; }
  async detectEgressAnomalies(userId, action, details) { return { anomalies: [] }; }
  async applyEgressPolicies(params) { return { allowed: true, reason: '', recommendations: [] }; }
  async handleBlockedEgress(egressRecord) { }
  async autoAssignIncident(incidentId, severity) { }
  async triggerEmergencyContainment(incident) { }
  async sendIncidentNotifications(incident) { }
  async generateSummaryMetrics(period, filters) { return {}; }
  async generateDetailedAnalysis(period, filters) { return {}; }
  async generateComplianceReport(period, filters) { return {}; }
  async generateReportCharts(summary, details) { return {}; }
}

export default new DataLossPreventionService();
