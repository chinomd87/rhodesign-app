// MFA Security Notifications Service
// Handles security notifications for MFA events and anomalies

import { collection, addDoc, doc, updateDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';

export class MFASecurityNotifications {
  constructor() {
    this.notificationTypes = {
      MFA_ENABLED: 'mfa_enabled',
      MFA_DISABLED: 'mfa_disabled',
      MFA_METHOD_ADDED: 'mfa_method_added',
      MFA_METHOD_REMOVED: 'mfa_method_removed',
      MFA_FAILED_ATTEMPT: 'mfa_failed_attempt',
      MFA_SUSPICIOUS_ACTIVITY: 'mfa_suspicious_activity',
      MFA_COMPLIANCE_VIOLATION: 'mfa_compliance_violation',
      MFA_BACKUP_CODE_USED: 'mfa_backup_code_used',
      MFA_DEVICE_REGISTERED: 'mfa_device_registered',
      MFA_DEVICE_REMOVED: 'mfa_device_removed'
    };

    this.severityLevels = {
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
      CRITICAL: 'critical'
    };
  }

  /**
   * Create a security notification for MFA events
   * @param {string} userId - User ID
   * @param {string} type - Notification type
   * @param {Object} details - Event details
   */
  async createSecurityNotification(userId, type, details = {}) {
    try {
      const notification = {
        userId,
        type,
        severity: this.getSeverityForType(type),
        title: this.getTitleForType(type),
        message: this.getMessageForType(type, details),
        details,
        timestamp: new Date(),
        read: false,
        acknowledged: false,
        clientInfo: {
          userAgent: navigator.userAgent,
          timestamp: new Date(),
          ipAddress: details.ipAddress || 'unknown'
        }
      };

      const docRef = await addDoc(collection(db, 'security_notifications'), notification);
      
      // Send real-time notification if high severity
      if (notification.severity === this.severityLevels.HIGH || 
          notification.severity === this.severityLevels.CRITICAL) {
        await this.sendRealTimeAlert(userId, notification);
      }

      return {
        success: true,
        notificationId: docRef.id,
        notification
      };

    } catch (error) {
      console.error('Failed to create security notification:', error);
      throw error;
    }
  }

  /**
   * Get security notifications for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   */
  async getSecurityNotifications(userId, options = {}) {
    try {
      const {
        limit: queryLimit = 50,
        unreadOnly = false,
        severity = null,
        startDate = null,
        endDate = null
      } = options;

      let q = query(
        collection(db, 'security_notifications'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(queryLimit)
      );

      if (unreadOnly) {
        q = query(q, where('read', '==', false));
      }

      if (severity) {
        q = query(q, where('severity', '==', severity));
      }

      const snapshot = await getDocs(q);
      const notifications = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Filter by date range if specified
        if (startDate && data.timestamp.toDate() < startDate) return;
        if (endDate && data.timestamp.toDate() > endDate) return;

        notifications.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate()
        });
      });

      return {
        success: true,
        notifications,
        total: notifications.length
      };

    } catch (error) {
      console.error('Failed to get security notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notifications as read
   * @param {string} userId - User ID
   * @param {Array} notificationIds - Notification IDs to mark as read
   */
  async markNotificationsAsRead(userId, notificationIds) {
    try {
      const updatePromises = notificationIds.map(async (id) => {
        await updateDoc(doc(db, 'security_notifications', id), {
          read: true,
          readAt: new Date()
        });
      });

      await Promise.all(updatePromises);

      return { success: true };

    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
      throw error;
    }
  }

  /**
   * Acknowledge critical notifications
   * @param {string} userId - User ID
   * @param {string} notificationId - Notification ID
   * @param {string} acknowledgedBy - User who acknowledged
   */
  async acknowledgeNotification(userId, notificationId, acknowledgedBy) {
    try {
      await updateDoc(doc(db, 'security_notifications', notificationId), {
        acknowledged: true,
        acknowledgedBy,
        acknowledgedAt: new Date()
      });

      return { success: true };

    } catch (error) {
      console.error('Failed to acknowledge notification:', error);
      throw error;
    }
  }

  /**
   * Detect suspicious MFA activity
   * @param {string} userId - User ID
   * @param {Object} activityData - Activity data
   */
  async detectSuspiciousActivity(userId, activityData) {
    try {
      const {
        method,
        failureCount = 0,
        timeWindow = 300000, // 5 minutes
        deviceFingerprint = null,
        location = null
      } = activityData;

      const suspiciousPatterns = [];

      // Check for excessive failed attempts
      if (failureCount >= 5) {
        suspiciousPatterns.push('excessive_failed_attempts');
      }

      // Check for unusual device/location
      if (deviceFingerprint && await this.isUnusualDevice(userId, deviceFingerprint)) {
        suspiciousPatterns.push('unusual_device');
      }

      if (location && await this.isUnusualLocation(userId, location)) {
        suspiciousPatterns.push('unusual_location');
      }

      // Check for rapid attempts from multiple methods
      const recentAttempts = await this.getRecentMFAAttempts(userId, timeWindow);
      if (recentAttempts.length >= 10) {
        suspiciousPatterns.push('rapid_multiple_attempts');
      }

      if (suspiciousPatterns.length > 0) {
        await this.createSecurityNotification(userId, this.notificationTypes.MFA_SUSPICIOUS_ACTIVITY, {
          patterns: suspiciousPatterns,
          method,
          failureCount,
          deviceFingerprint,
          location,
          timestamp: new Date()
        });

        return {
          suspicious: true,
          patterns: suspiciousPatterns,
          riskLevel: this.calculateRiskLevel(suspiciousPatterns)
        };
      }

      return { suspicious: false };

    } catch (error) {
      console.error('Failed to detect suspicious activity:', error);
      throw error;
    }
  }

  /**
   * Log MFA compliance violations
   * @param {string} userId - User ID
   * @param {Object} violationData - Violation details
   */
  async logComplianceViolation(userId, violationData) {
    try {
      const {
        operation,
        requiredLevel,
        currentLevel,
        missingMethods = [],
        attemptedBypass = false
      } = violationData;

      await this.createSecurityNotification(
        userId, 
        this.notificationTypes.MFA_COMPLIANCE_VIOLATION,
        {
          operation,
          requiredLevel,
          currentLevel,
          missingMethods,
          attemptedBypass,
          severity: attemptedBypass ? this.severityLevels.CRITICAL : this.severityLevels.HIGH
        }
      );

      return { success: true };

    } catch (error) {
      console.error('Failed to log compliance violation:', error);
      throw error;
    }
  }

  // Helper methods

  getSeverityForType(type) {
    const severityMapping = {
      [this.notificationTypes.MFA_ENABLED]: this.severityLevels.MEDIUM,
      [this.notificationTypes.MFA_DISABLED]: this.severityLevels.HIGH,
      [this.notificationTypes.MFA_METHOD_ADDED]: this.severityLevels.LOW,
      [this.notificationTypes.MFA_METHOD_REMOVED]: this.severityLevels.MEDIUM,
      [this.notificationTypes.MFA_FAILED_ATTEMPT]: this.severityLevels.LOW,
      [this.notificationTypes.MFA_SUSPICIOUS_ACTIVITY]: this.severityLevels.HIGH,
      [this.notificationTypes.MFA_COMPLIANCE_VIOLATION]: this.severityLevels.HIGH,
      [this.notificationTypes.MFA_BACKUP_CODE_USED]: this.severityLevels.MEDIUM,
      [this.notificationTypes.MFA_DEVICE_REGISTERED]: this.severityLevels.LOW,
      [this.notificationTypes.MFA_DEVICE_REMOVED]: this.severityLevels.MEDIUM
    };

    return severityMapping[type] || this.severityLevels.LOW;
  }

  getTitleForType(type) {
    const titleMapping = {
      [this.notificationTypes.MFA_ENABLED]: 'Multi-Factor Authentication Enabled',
      [this.notificationTypes.MFA_DISABLED]: 'Multi-Factor Authentication Disabled',
      [this.notificationTypes.MFA_METHOD_ADDED]: 'New MFA Method Added',
      [this.notificationTypes.MFA_METHOD_REMOVED]: 'MFA Method Removed',
      [this.notificationTypes.MFA_FAILED_ATTEMPT]: 'MFA Verification Failed',
      [this.notificationTypes.MFA_SUSPICIOUS_ACTIVITY]: 'Suspicious MFA Activity Detected',
      [this.notificationTypes.MFA_COMPLIANCE_VIOLATION]: 'MFA Compliance Violation',
      [this.notificationTypes.MFA_BACKUP_CODE_USED]: 'Backup Code Used',
      [this.notificationTypes.MFA_DEVICE_REGISTERED]: 'New Device Registered',
      [this.notificationTypes.MFA_DEVICE_REMOVED]: 'Device Removed'
    };

    return titleMapping[type] || 'MFA Security Event';
  }

  getMessageForType(type, details) {
    const baseMessages = {
      [this.notificationTypes.MFA_ENABLED]: 'Multi-factor authentication has been enabled for your account.',
      [this.notificationTypes.MFA_DISABLED]: 'Multi-factor authentication has been disabled for your account.',
      [this.notificationTypes.MFA_METHOD_ADDED]: `New MFA method '${details.method || 'unknown'}' has been added to your account.`,
      [this.notificationTypes.MFA_METHOD_REMOVED]: `MFA method '${details.method || 'unknown'}' has been removed from your account.`,
      [this.notificationTypes.MFA_FAILED_ATTEMPT]: `Failed MFA verification attempt using ${details.method || 'unknown'} method.`,
      [this.notificationTypes.MFA_SUSPICIOUS_ACTIVITY]: `Suspicious activity detected: ${details.patterns?.join(', ') || 'unknown pattern'}.`,
      [this.notificationTypes.MFA_COMPLIANCE_VIOLATION]: `Operation '${details.operation || 'unknown'}' violated MFA compliance requirements.`,
      [this.notificationTypes.MFA_BACKUP_CODE_USED]: 'A backup code was used to access your account.',
      [this.notificationTypes.MFA_DEVICE_REGISTERED]: `New device '${details.deviceName || 'unknown'}' has been registered for MFA.`,
      [this.notificationTypes.MFA_DEVICE_REMOVED]: `Device '${details.deviceName || 'unknown'}' has been removed from MFA.`
    };

    return baseMessages[type] || 'MFA security event occurred.';
  }

  async sendRealTimeAlert(userId, notification) {
    // In a real implementation, this would send push notifications,
    // emails, or other real-time alerts for high-severity events
    console.warn('HIGH SEVERITY MFA EVENT:', {
      userId,
      type: notification.type,
      severity: notification.severity,
      timestamp: notification.timestamp
    });

    // Could integrate with:
    // - Firebase Cloud Messaging for push notifications
    // - Email service for critical alerts
    // - SMS service for immediate alerts
    // - Slack/Teams webhooks for team notifications
  }

  async isUnusualDevice(userId, deviceFingerprint) {
    // In production, check against user's known devices
    return false; // Simplified for demo
  }

  async isUnusualLocation(userId, location) {
    // In production, check against user's historical locations
    return false; // Simplified for demo
  }

  async getRecentMFAAttempts(userId, timeWindow) {
    // In production, query recent MFA attempts from logs
    return []; // Simplified for demo
  }

  calculateRiskLevel(patterns) {
    const highRiskPatterns = ['excessive_failed_attempts', 'rapid_multiple_attempts'];
    const mediumRiskPatterns = ['unusual_device', 'unusual_location'];

    const hasHighRisk = patterns.some(p => highRiskPatterns.includes(p));
    const hasMediumRisk = patterns.some(p => mediumRiskPatterns.includes(p));

    if (hasHighRisk) return 'high';
    if (hasMediumRisk) return 'medium';
    return 'low';
  }

  /**
   * Get notification statistics for dashboard
   * @param {string} userId - User ID
   * @param {number} days - Number of days to look back
   */
  async getNotificationStats(userId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const notifications = await this.getSecurityNotifications(userId, {
        startDate,
        limit: 1000
      });

      const stats = {
        total: notifications.notifications.length,
        unread: notifications.notifications.filter(n => !n.read).length,
        critical: notifications.notifications.filter(n => n.severity === this.severityLevels.CRITICAL).length,
        high: notifications.notifications.filter(n => n.severity === this.severityLevels.HIGH).length,
        byType: {}
      };

      // Count by type
      notifications.notifications.forEach(notification => {
        stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
      });

      return {
        success: true,
        stats,
        period: `${days} days`
      };

    } catch (error) {
      console.error('Failed to get notification stats:', error);
      throw error;
    }
  }
}

export default new MFASecurityNotifications();
