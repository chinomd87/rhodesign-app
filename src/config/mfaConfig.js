// MFA Configuration
// Centralized configuration for Multi-Factor Authentication settings

export const MFA_CONFIG = {
  // Supported MFA Methods
  METHODS: {
    TOTP: 'totp',
    SMS: 'sms',
    BIOMETRIC: 'biometric',
    BACKUP: 'backup'
  },

  // Compliance Levels and Requirements
  COMPLIANCE_LEVELS: {
    BASIC: {
      level: 'basic',
      displayName: 'Basic Security',
      description: 'TOTP authenticator app required',
      requiredMethods: ['totp'],
      legalValue: 'advanced_electronic_signature'
    },
    ADVANCED: {
      level: 'advanced',
      displayName: 'Advanced Security',
      description: 'Multiple authentication factors required',
      requiredMethods: ['totp', 'sms'],
      legalValue: 'qualified_electronic_signature'
    },
    QUALIFIED: {
      level: 'qualified',
      displayName: 'Qualified Security',
      description: 'Highest security with biometric verification',
      requiredMethods: ['totp', 'sms', 'biometric'],
      legalValue: 'highest_assurance_signature'
    }
  },

  // Operation-specific MFA requirements
  OPERATION_REQUIREMENTS: {
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
    },
    timestamp_signature: {
      basic: ['totp'],
      advanced: ['totp', 'sms'],
      qualified: ['totp', 'sms', 'biometric']
    },
    key_generation: {
      basic: ['totp'],
      advanced: ['totp', 'sms'],
      qualified: ['totp', 'sms', 'biometric']
    },
    certificate_renewal: {
      basic: ['totp'],
      advanced: ['totp'],
      qualified: ['totp', 'sms']
    }
  },

  // TOTP Settings
  TOTP: {
    issuer: 'RhodeSign',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    window: 1, // Allow codes from previous/next time window
    qrCodeOptions: {
      width: 256,
      height: 256,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    }
  },

  // SMS Settings
  SMS: {
    codeLength: 6,
    validityPeriod: 300, // 5 minutes in seconds
    maxAttempts: 3,
    rateLimitWindow: 60, // 1 minute between requests
    providers: {
      primary: 'twilio',
      fallback: 'aws_sns'
    },
    messageTemplate: 'Your RhodeSign verification code is: {code}. Valid for 5 minutes.',
    phoneNumberFormat: 'E164' // International format
  },

  // Biometric Settings
  BIOMETRIC: {
    timeout: 300000, // 5 minutes
    userVerification: 'required',
    attestation: 'direct',
    algorithms: [-7, -257], // ES256, RS256
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'preferred'
    },
    extensions: {
      credProps: true
    }
  },

  // Backup Codes
  BACKUP_CODES: {
    count: 10,
    length: 8,
    format: 'XXXX-XXXX', // 4 chars, dash, 4 chars
    oneTimeUse: true,
    regenerateThreshold: 3 // Regenerate when 3 or fewer codes remain
  },

  // Security Settings
  SECURITY: {
    maxAttempts: 3,
    lockoutDuration: 900, // 15 minutes
    sessionValidity: 3600, // 1 hour
    requireMFAForSensitiveOps: true,
    allowFallbackMethods: true,
    enforceDeviceRegistration: false,
    auditAllAttempts: true
  },

  // Legal and Compliance
  LEGAL: {
    retentionPeriod: 2555, // 7 years in days
    auditLogLevel: 'detailed',
    nonRepudiationRequired: true,
    timestampMFAEvents: true,
    legalValueMapping: {
      'totp': 'advanced_electronic_signature',
      'sms': 'advanced_electronic_signature',
      'biometric': 'qualified_electronic_signature',
      'totp+sms': 'qualified_electronic_signature',
      'totp+biometric': 'highest_assurance_signature',
      'totp+sms+biometric': 'highest_assurance_signature'
    }
  },

  // UI/UX Settings
  UI: {
    showSetupGuide: true,
    allowMethodSelection: true,
    preferredMethodOrder: ['biometric', 'totp', 'sms'],
    showComplianceLevel: true,
    enableProgressIndicator: true,
    autoSubmitCodeLength: 6,
    maskSensitiveData: true
  },

  // Integration Settings
  INTEGRATION: {
    firebase: {
      collection: 'mfa_configurations',
      enableRealTimeUpdates: true,
      useFirestoreTimestamps: true
    },
    pki: {
      enhanceSignatures: true,
      includeMFAProof: true,
      timestampMFAEvents: true
    },
    logging: {
      logLevel: 'info',
      enableAuditTrail: true,
      includeClientInfo: true
    }
  },

  // Error Messages
  ERROR_MESSAGES: {
    INVALID_CODE: 'Invalid verification code. Please try again.',
    EXPIRED_CODE: 'Verification code has expired. Please request a new one.',
    MAX_ATTEMPTS: 'Maximum verification attempts exceeded. Please try again later.',
    METHOD_NOT_SETUP: 'This MFA method is not set up. Please configure it first.',
    BIOMETRIC_NOT_SUPPORTED: 'Biometric authentication is not supported on this device.',
    SMS_SEND_FAILED: 'Failed to send SMS code. Please try again.',
    TOTP_SETUP_FAILED: 'Failed to set up authenticator app. Please try again.',
    GENERAL_ERROR: 'An error occurred during MFA verification. Please try again.'
  },

  // Success Messages
  SUCCESS_MESSAGES: {
    SETUP_COMPLETE: 'MFA setup completed successfully!',
    VERIFICATION_SUCCESS: 'Identity verified successfully.',
    METHOD_ENABLED: 'MFA method enabled successfully.',
    METHOD_DISABLED: 'MFA method disabled successfully.',
    BACKUP_CODES_GENERATED: 'Backup codes generated successfully. Please save them securely.'
  },

  // Development/Testing
  DEVELOPMENT: {
    bypassMFA: false, // Never set to true in production
    testPhoneNumber: null,
    logVerbose: true,
    enableTestMode: false
  }
};

// Helper Functions
export const MFA_HELPERS = {
  /**
   * Get required methods for operation and compliance level
   */
  getRequiredMethods(operation, complianceLevel = 'advanced') {
    return MFA_CONFIG.OPERATION_REQUIREMENTS[operation]?.[complianceLevel] || ['totp'];
  },

  /**
   * Check if method combination meets compliance level
   */
  meetsComplianceLevel(enabledMethods, targetLevel) {
    const required = MFA_CONFIG.COMPLIANCE_LEVELS[targetLevel.toUpperCase()]?.requiredMethods || [];
    return required.every(method => enabledMethods.includes(method));
  },

  /**
   * Get legal value for method combination
   */
  getLegalValue(methods) {
    const methodKey = Array.isArray(methods) ? methods.sort().join('+') : methods;
    return MFA_CONFIG.LEGAL.legalValueMapping[methodKey] || 'basic_electronic_signature';
  },

  /**
   * Format phone number to E164
   */
  formatPhoneNumber(phoneNumber) {
    // Remove all non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add + if not present and assuming US number if no country code
    if (!cleaned.startsWith('1') && cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (!cleaned.startsWith('+')) {
      return `+${cleaned}`;
    }
    
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  },

  /**
   * Generate backup code in specified format
   */
  generateBackupCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${part1}-${part2}`;
  },

  /**
   * Validate verification code format
   */
  isValidCodeFormat(code, method) {
    if (!code || typeof code !== 'string') return false;
    
    switch (method) {
      case 'totp':
      case 'sms':
        return /^\d{6}$/.test(code);
      case 'backup':
        return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
      default:
        return false;
    }
  },

  /**
   * Get method display info
   */
  getMethodInfo(method) {
    const methodInfo = {
      totp: {
        name: 'Authenticator App',
        description: 'Time-based codes from your authenticator app',
        icon: 'key',
        setupTime: '2-3 minutes'
      },
      sms: {
        name: 'SMS Text Message',
        description: 'Codes sent to your mobile phone',
        icon: 'smartphone',
        setupTime: '1 minute'
      },
      biometric: {
        name: 'Biometric',
        description: 'Fingerprint, face, or other biometric verification',
        icon: 'eye',
        setupTime: '1-2 minutes'
      },
      backup: {
        name: 'Backup Codes',
        description: 'Pre-generated recovery codes',
        icon: 'shield',
        setupTime: 'Instant'
      }
    };

    return methodInfo[method] || { name: method, description: '', icon: 'shield', setupTime: 'Unknown' };
  }
};

export default MFA_CONFIG;
