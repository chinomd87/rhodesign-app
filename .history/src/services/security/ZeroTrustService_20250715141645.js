// Zero Trust Architecture Service
// Continuous verification and least-privilege access control

import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase/config';
import ThreatDetectionService from './ThreatDetectionService';

/**
 * Zero Trust Architecture Service
 * 
 * Implements Zero Trust security model with:
 * - Continuous authentication and authorization
 * - Least-privilege access control
 * - Device trust evaluation
 * - Network micro-segmentation
 * - Real-time risk assessment
 * - Policy-based access decisions
 * - Comprehensive audit logging
 */
class ZeroTrustService {
  constructor() {
    this.policiesCollection = collection(db, 'zeroTrustPolicies');
    this.decisionsCollection = collection(db, 'accessDecisions');
    this.deviceTrustCollection = collection(db, 'deviceTrust');
    this.networkContextCollection = collection(db, 'networkContext');
    this.auditCollection = collection(db, 'zeroTrustAudit');

    // Trust levels
    this.trustLevels = {
      unknown: 0,
      low: 25,
      medium: 50,
      high: 75,
      verified: 100
    };

    // Access decision types
    this.decisionTypes = {
      allow: 'allow',
      deny: 'deny',
      challenge: 'challenge', // Require additional authentication
      monitor: 'monitor', // Allow but with enhanced monitoring
      step_up: 'step_up' // Require step-up authentication
    };

    // Risk factors
    this.riskFactors = {
      device: 0.3,
      location: 0.2,
      behavior: 0.25,
      network: 0.15,
      time: 0.1
    };

    this.initializePolicies();
  }

  /**
   * Evaluate access request and make zero trust decision
   */
  async evaluateAccess(accessRequest) {
    try {
      const {
        userId,
        resourceId,
        resourceType,
        requestedAction,
        context
      } = accessRequest;

      // Start evaluation process
      const evaluationId = await this.startEvaluation(accessRequest);

      // Collect trust signals
      const trustSignals = await this.collectTrustSignals(userId, context);

      // Calculate composite trust score
      const trustScore = this.calculateTrustScore(trustSignals);

      // Get applicable policies
      const policies = await this.getApplicablePolicies(
        userId, 
        resourceType, 
        requestedAction,
        context
      );

      // Evaluate against policies
      const policyDecision = this.evaluatePolicies(policies, trustSignals, trustScore);

      // Perform risk analysis
      const riskAnalysis = await this.performRiskAnalysis(userId, context, trustSignals);

      // Make final access decision
      const finalDecision = this.makeFinalDecision(
        policyDecision,
        riskAnalysis,
        trustScore,
        context
      );

      // Log decision
      await this.logAccessDecision(evaluationId, {
        userId,
        resourceId,
        resourceType,
        requestedAction,
        trustScore,
        riskAnalysis,
        decision: finalDecision,
        policies: policies.map(p => p.id),
        trustSignals
      });

      // Apply continuous monitoring if access granted
      if (finalDecision.decision === this.decisionTypes.allow || 
          finalDecision.decision === this.decisionTypes.monitor) {
        await this.applyContinuousMonitoring(userId, evaluationId, context);
      }

      return {
        success: true,
        evaluationId,
        decision: finalDecision.decision,
        trustScore,
        conditions: finalDecision.conditions || [],
        monitoringRequired: finalDecision.monitoringRequired || false,
        message: finalDecision.message,
        validUntil: finalDecision.validUntil
      };

    } catch (error) {
      console.error('Zero Trust evaluation failed:', error);
      
      // Default to deny on error
      return {
        success: false,
        decision: this.decisionTypes.deny,
        trustScore: 0,
        message: 'Access denied due to evaluation error',
        error: error.message
      };
    }
  }

  /**
   * Collect trust signals from multiple sources
   */
  async collectTrustSignals(userId, context) {
    try {
      const signals = {
        device: await this.evaluateDeviceTrust(context.deviceFingerprint, userId),
        location: await this.evaluateLocationTrust(context.location, userId),
        network: await this.evaluateNetworkTrust(context.networkInfo, userId),
        behavior: await this.evaluateBehaviorTrust(userId, context),
        identity: await this.evaluateIdentityTrust(userId, context),
        time: this.evaluateTimeTrust(context.timestamp, userId)
      };

      return signals;

    } catch (error) {
      console.error('Failed to collect trust signals:', error);
      
      // Return minimal trust signals on error
      return {
        device: { score: 0, verified: false },
        location: { score: 0, verified: false },
        network: { score: 0, verified: false },
        behavior: { score: 0, verified: false },
        identity: { score: 0, verified: false },
        time: { score: 0, verified: false }
      };
    }
  }

  /**
   * Evaluate device trust
   */
  async evaluateDeviceTrust(deviceFingerprint, userId) {
    try {
      if (!deviceFingerprint) {
        return { score: 0, verified: false, reason: 'No device fingerprint' };
      }

      // Check if device is known and trusted
      const deviceDoc = await getDoc(doc(this.deviceTrustCollection, deviceFingerprint));
      
      if (!deviceDoc.exists()) {
        // Unknown device
        return { 
          score: this.trustLevels.unknown, 
          verified: false, 
          reason: 'Unknown device',
          isNew: true
        };
      }

      const deviceData = deviceDoc.data();
      
      // Check if device belongs to user
      if (!deviceData.authorizedUsers?.includes(userId)) {
        return { 
          score: this.trustLevels.unknown, 
          verified: false, 
          reason: 'Device not authorized for user' 
        };
      }

      // Calculate device trust score based on history
      let score = this.trustLevels.low;
      
      if (deviceData.verificationLevel === 'managed') {
        score = this.trustLevels.high;
      } else if (deviceData.verificationLevel === 'registered') {
        score = this.trustLevels.medium;
      }

      // Adjust based on device age and activity
      const daysSinceFirstSeen = (new Date() - deviceData.firstSeen.toDate()) / (1000 * 60 * 60 * 24);
      if (daysSinceFirstSeen > 30) {
        score = Math.min(score + 10, this.trustLevels.verified);
      }

      // Check for security issues
      if (deviceData.securityIssues && deviceData.securityIssues.length > 0) {
        score = Math.max(score - 20, this.trustLevels.unknown);
      }

      return {
        score,
        verified: score >= this.trustLevels.medium,
        reason: 'Device trust evaluated',
        deviceAge: Math.floor(daysSinceFirstSeen),
        verificationLevel: deviceData.verificationLevel,
        securityIssues: deviceData.securityIssues || []
      };

    } catch (error) {
      console.error('Device trust evaluation failed:', error);
      return { score: 0, verified: false, reason: 'Evaluation error' };
    }
  }

  /**
   * Evaluate location trust
   */
  async evaluateLocationTrust(location, userId) {
    try {
      if (!location) {
        return { score: 0, verified: false, reason: 'No location data' };
      }

      // Get user's location history and patterns
      const userProfileDoc = await getDoc(doc(db, 'userBehaviorProfiles', userId));
      const profile = userProfileDoc.exists() ? userProfileDoc.data() : null;

      let score = this.trustLevels.low;
      const factors = [];

      // Check if location is in known safe locations
      if (profile?.patterns?.trustedLocations) {
        const trustedLocation = profile.patterns.trustedLocations.find(loc => 
          this.isWithinRadius(location, loc, 50) // 50km radius
        );

        if (trustedLocation) {
          score = this.trustLevels.high;
          factors.push('Trusted location');
        }
      }

      // Check country risk level
      const countryRisk = this.getCountryRiskLevel(location.countryCode);
      if (countryRisk === 'high') {
        score = Math.max(score - 30, this.trustLevels.unknown);
        factors.push('High-risk country');
      } else if (countryRisk === 'low') {
        score = Math.min(score + 10, this.trustLevels.verified);
        factors.push('Low-risk country');
      }

      // Check for VPN/Proxy usage
      if (location.isVPN || location.isProxy || location.isTor) {
        score = Math.max(score - 25, this.trustLevels.unknown);
        factors.push('VPN/Proxy detected');
      }

      // Check for recent location history
      if (profile?.patterns?.recentLocations) {
        const recentLocation = profile.patterns.recentLocations
          .filter(loc => (new Date() - new Date(loc.timestamp)) < 24 * 60 * 60 * 1000) // Last 24 hours
          .find(loc => this.isWithinRadius(location, loc, 100));

        if (recentLocation) {
          score = Math.min(score + 15, this.trustLevels.verified);
          factors.push('Recent location match');
        }
      }

      return {
        score,
        verified: score >= this.trustLevels.medium,
        reason: 'Location trust evaluated',
        factors,
        countryRisk,
        isVPN: location.isVPN || false,
        isProxy: location.isProxy || false
      };

    } catch (error) {
      console.error('Location trust evaluation failed:', error);
      return { score: 0, verified: false, reason: 'Evaluation error' };
    }
  }

  /**
   * Evaluate network trust
   */
  async evaluateNetworkTrust(networkInfo, userId) {
    try {
      if (!networkInfo) {
        return { score: 0, verified: false, reason: 'No network data' };
      }

      let score = this.trustLevels.medium;
      const factors = [];

      // Check if IP is in threat intelligence
      const threatIntel = await this.checkIPThreatIntelligence(networkInfo.ipAddress);
      if (threatIntel.isMalicious) {
        score = this.trustLevels.unknown;
        factors.push(`Malicious IP: ${threatIntel.reason}`);
      }

      // Check network type
      if (networkInfo.networkType === 'corporate') {
        score = Math.min(score + 20, this.trustLevels.verified);
        factors.push('Corporate network');
      } else if (networkInfo.networkType === 'public_wifi') {
        score = Math.max(score - 15, this.trustLevels.low);
        factors.push('Public WiFi');
      }

      // Check for known trusted networks
      const trustedNetworks = await this.getTrustedNetworksForUser(userId);
      const isTrustedNetwork = trustedNetworks.some(network => 
        this.isIPInRange(networkInfo.ipAddress, network.range)
      );

      if (isTrustedNetwork) {
        score = Math.min(score + 25, this.trustLevels.verified);
        factors.push('Trusted network');
      }

      // Check for suspicious network activity
      if (networkInfo.suspiciousActivity) {
        score = Math.max(score - 20, this.trustLevels.unknown);
        factors.push('Suspicious network activity');
      }

      return {
        score,
        verified: score >= this.trustLevels.medium,
        reason: 'Network trust evaluated',
        factors,
        networkType: networkInfo.networkType,
        threatIntel: threatIntel.isMalicious ? threatIntel : null
      };

    } catch (error) {
      console.error('Network trust evaluation failed:', error);
      return { score: 0, verified: false, reason: 'Evaluation error' };
    }
  }

  /**
   * Evaluate behavior trust
   */
  async evaluateBehaviorTrust(userId, context) {
    try {
      // Use threat detection service for behavioral analysis
      const behaviorAnalysis = await ThreatDetectionService.analyzeUserActivity(userId, {
        type: context.activityType || 'access_request',
        userAgent: context.userAgent,
        ipAddress: context.networkInfo?.ipAddress,
        location: context.location,
        deviceFingerprint: context.deviceFingerprint,
        timestamp: context.timestamp
      });

      let score = this.trustLevels.medium;
      const factors = [];

      if (behaviorAnalysis.success) {
        const analysis = behaviorAnalysis.analysis;
        
        // Convert risk score to trust score (inverse relationship)
        score = Math.max(this.trustLevels.verified - analysis.riskScore, this.trustLevels.unknown);

        if (analysis.anomalies.length > 0) {
          factors.push(`${analysis.anomalies.length} behavioral anomalies detected`);
        }

        if (analysis.threats.length > 0) {
          factors.push(`${analysis.threats.length} threats detected`);
          score = this.trustLevels.unknown; // Any threat detection = low trust
        }
      }

      return {
        score,
        verified: score >= this.trustLevels.medium,
        reason: 'Behavior trust evaluated',
        factors,
        riskScore: behaviorAnalysis.analysis?.riskScore || 0,
        anomalies: behaviorAnalysis.analysis?.anomalies || [],
        threats: behaviorAnalysis.analysis?.threats || []
      };

    } catch (error) {
      console.error('Behavior trust evaluation failed:', error);
      return { score: 0, verified: false, reason: 'Evaluation error' };
    }
  }

  /**
   * Evaluate identity trust
   */
  async evaluateIdentityTrust(userId, context) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        return { score: 0, verified: false, reason: 'User not found' };
      }

      const userData = userDoc.data();
      let score = this.trustLevels.low;
      const factors = [];

      // Check account verification level
      if (userData.emailVerified) {
        score += 15;
        factors.push('Email verified');
      }

      if (userData.phoneVerified) {
        score += 10;
        factors.push('Phone verified');
      }

      if (userData.identityVerified) {
        score += 20;
        factors.push('Identity verified');
      }

      // Check MFA status
      if (userData.mfaEnabled) {
        score += 15;
        factors.push('MFA enabled');
      }

      // Check recent authentication
      if (context.recentAuthTime) {
        const authAge = new Date() - new Date(context.recentAuthTime);
        if (authAge < 15 * 60 * 1000) { // Less than 15 minutes
          score += 10;
          factors.push('Recent authentication');
        }
      }

      // Check account age and activity
      const accountAge = new Date() - userData.createdAt.toDate();
      if (accountAge > 30 * 24 * 60 * 60 * 1000) { // More than 30 days
        score += 10;
        factors.push('Established account');
      }

      // Check for recent security issues
      if (userData.securityFlags && userData.securityFlags.length > 0) {
        score = Math.max(score - 25, this.trustLevels.unknown);
        factors.push('Security flags present');
      }

      score = Math.min(score, this.trustLevels.verified);

      return {
        score,
        verified: score >= this.trustLevels.medium,
        reason: 'Identity trust evaluated',
        factors,
        verificationLevel: {
          email: userData.emailVerified || false,
          phone: userData.phoneVerified || false,
          identity: userData.identityVerified || false,
          mfa: userData.mfaEnabled || false
        }
      };

    } catch (error) {
      console.error('Identity trust evaluation failed:', error);
      return { score: 0, verified: false, reason: 'Evaluation error' };
    }
  }

  /**
   * Evaluate time-based trust
   */
  evaluateTimeTrust(timestamp, userId) {
    try {
      const now = new Date();
      const requestTime = new Date(timestamp);
      const hour = requestTime.getHours();
      const dayOfWeek = requestTime.getDay();

      let score = this.trustLevels.medium;
      const factors = [];

      // Check business hours (9 AM - 5 PM, Monday-Friday)
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour <= 17) {
        score += 15;
        factors.push('Business hours');
      } else if (dayOfWeek === 0 || dayOfWeek === 6) {
        score -= 10;
        factors.push('Weekend access');
      } else if (hour < 6 || hour > 22) {
        score -= 15;
        factors.push('After hours access');
      }

      // Check for unusual timing patterns
      const timeDiff = Math.abs(now - requestTime);
      if (timeDiff > 5 * 60 * 1000) { // More than 5 minutes difference
        score -= 5;
        factors.push('Time drift detected');
      }

      score = Math.max(Math.min(score, this.trustLevels.verified), this.trustLevels.unknown);

      return {
        score,
        verified: score >= this.trustLevels.medium,
        reason: 'Time trust evaluated',
        factors,
        accessTime: {
          hour,
          dayOfWeek,
          isBusinessHours: dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour <= 17
        }
      };

    } catch (error) {
      console.error('Time trust evaluation failed:', error);
      return { score: 0, verified: false, reason: 'Evaluation error' };
    }
  }

  /**
   * Calculate composite trust score
   */
  calculateTrustScore(trustSignals) {
    let compositeScore = 0;

    Object.keys(this.riskFactors).forEach(factor => {
      if (trustSignals[factor]) {
        compositeScore += trustSignals[factor].score * this.riskFactors[factor];
      }
    });

    return Math.round(compositeScore);
  }

  /**
   * Make final access decision
   */
  makeFinalDecision(policyDecision, riskAnalysis, trustScore, context) {
    try {
      let decision = this.decisionTypes.allow;
      let conditions = [];
      let monitoringRequired = false;
      let message = 'Access granted';
      let validUntil = new Date();
      validUntil.setHours(validUntil.getHours() + 8); // 8-hour default validity

      // Check policy decision first
      if (policyDecision.decision === this.decisionTypes.deny) {
        return {
          decision: this.decisionTypes.deny,
          message: policyDecision.reason || 'Access denied by policy',
          conditions: []
        };
      }

      // Evaluate trust score
      if (trustScore < this.trustLevels.low) {
        decision = this.decisionTypes.deny;
        message = 'Access denied - insufficient trust score';
      } else if (trustScore < this.trustLevels.medium) {
        decision = this.decisionTypes.challenge;
        message = 'Additional authentication required';
        conditions.push('step_up_auth');
      } else if (trustScore < this.trustLevels.high) {
        decision = this.decisionTypes.monitor;
        message = 'Access granted with monitoring';
        monitoringRequired = true;
        validUntil.setHours(validUntil.getHours() - 4); // Shorter validity
      }

      // Check risk analysis
      if (riskAnalysis.riskLevel === 'critical' || riskAnalysis.riskLevel === 'high') {
        if (decision === this.decisionTypes.allow) {
          decision = this.decisionTypes.step_up;
          conditions.push('mfa_required');
        }
        monitoringRequired = true;
      }

      // Apply contextual conditions
      if (context.sensitiveResource) {
        conditions.push('enhanced_logging');
        monitoringRequired = true;
      }

      if (context.highValueTransaction) {
        conditions.push('dual_approval');
        validUntil.setMinutes(validUntil.getMinutes() + 30); // Shorter validity for high-value
      }

      return {
        decision,
        message,
        conditions,
        monitoringRequired,
        validUntil,
        trustScore,
        riskLevel: riskAnalysis.riskLevel
      };

    } catch (error) {
      console.error('Failed to make final decision:', error);
      return {
        decision: this.decisionTypes.deny,
        message: 'Access denied due to decision error',
        conditions: []
      };
    }
  }

  // Helper methods

  async startEvaluation(accessRequest) {
    try {
      const evaluationRef = await addDoc(this.auditCollection, {
        type: 'access_evaluation',
        userId: accessRequest.userId,
        resourceId: accessRequest.resourceId,
        resourceType: accessRequest.resourceType,
        requestedAction: accessRequest.requestedAction,
        startTime: serverTimestamp(),
        status: 'in_progress'
      });

      return evaluationRef.id;
    } catch (error) {
      console.error('Failed to start evaluation:', error);
      return null;
    }
  }

  async getApplicablePolicies(userId, resourceType, requestedAction, context) {
    try {
      // This would fetch policies from your policy engine
      // For now, return default policies
      return [
        {
          id: 'default_policy',
          name: 'Default Access Policy',
          rules: [
            {
              condition: 'trustScore >= 50',
              action: 'allow'
            }
          ]
        }
      ];
    } catch (error) {
      console.error('Failed to get applicable policies:', error);
      return [];
    }
  }

  evaluatePolicies(policies, trustSignals, trustScore) {
    // Simple policy evaluation - in production this would be more sophisticated
    for (const policy of policies) {
      for (const rule of policy.rules) {
        if (rule.condition.includes('trustScore') && trustScore < 50) {
          return {
            decision: this.decisionTypes.deny,
            reason: `Failed policy: ${policy.name}`,
            policy: policy.id
          };
        }
      }
    }

    return {
      decision: this.decisionTypes.allow,
      reason: 'All policies satisfied'
    };
  }

  async performRiskAnalysis(userId, context, trustSignals) {
    try {
      // Calculate risk based on trust signals
      let riskScore = 0;
      const riskFactors = [];

      Object.keys(trustSignals).forEach(signalType => {
        const signal = trustSignals[signalType];
        if (signal.score < this.trustLevels.medium) {
          riskScore += (this.trustLevels.medium - signal.score) * this.riskFactors[signalType];
          riskFactors.push(`Low ${signalType} trust`);
        }
      });

      let riskLevel = 'low';
      if (riskScore > 60) riskLevel = 'critical';
      else if (riskScore > 40) riskLevel = 'high';
      else if (riskScore > 20) riskLevel = 'medium';

      return {
        riskScore,
        riskLevel,
        riskFactors
      };
    } catch (error) {
      console.error('Risk analysis failed:', error);
      return { riskScore: 100, riskLevel: 'critical', riskFactors: ['Analysis error'] };
    }
  }

  async logAccessDecision(evaluationId, decisionData) {
    try {
      await updateDoc(doc(this.auditCollection, evaluationId), {
        ...decisionData,
        endTime: serverTimestamp(),
        status: 'completed'
      });
    } catch (error) {
      console.error('Failed to log access decision:', error);
    }
  }

  async applyContinuousMonitoring(userId, evaluationId, context) {
    // Implement continuous monitoring logic
    console.log(`Continuous monitoring applied for user ${userId}, evaluation ${evaluationId}`);
  }

  isWithinRadius(location1, location2, radiusKm) {
    // Simple distance calculation
    const lat1 = location1.lat || location1.latitude;
    const lon1 = location1.lon || location1.longitude;
    const lat2 = location2.lat || location2.latitude;
    const lon2 = location2.lon || location2.longitude;

    if (!lat1 || !lon1 || !lat2 || !lon2) return false;

    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return distance <= radiusKm;
  }

  getCountryRiskLevel(countryCode) {
    const highRiskCountries = ['CN', 'RU', 'KP', 'IR'];
    const mediumRiskCountries = ['PK', 'BD', 'NG'];
    
    if (highRiskCountries.includes(countryCode)) return 'high';
    if (mediumRiskCountries.includes(countryCode)) return 'medium';
    return 'low';
  }

  async checkIPThreatIntelligence(ipAddress) {
    // Mock threat intelligence check
    const knownMaliciousIPs = ['192.168.1.100', '10.0.0.50'];
    
    if (knownMaliciousIPs.includes(ipAddress)) {
      return {
        isMalicious: true,
        reason: 'Known malware C2',
        confidence: 'high'
      };
    }

    return { isMalicious: false };
  }

  async getTrustedNetworksForUser(userId) {
    // Mock trusted networks
    return [
      { range: '192.168.1.0/24', name: 'Corporate Network' },
      { range: '10.0.0.0/16', name: 'VPN Network' }
    ];
  }

  isIPInRange(ip, range) {
    // Simple IP range check - in production use proper CIDR calculation
    return ip.startsWith(range.split('/')[0].substring(0, range.split('/')[0].lastIndexOf('.')));
  }

  async initializePolicies() {
    // Initialize default zero trust policies
    console.log('Zero Trust policies initialized');
  }
}

export default new ZeroTrustService();
