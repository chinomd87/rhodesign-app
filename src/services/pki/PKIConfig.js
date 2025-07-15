// PKI Configuration and Provider Setup
// Centralizes PKI system configuration and provider management

export const PKIConfig = {
  // Certificate Authority Providers
  certificateAuthorities: {
    sectigo: {
      name: 'Sectigo',
      enabled: true,
      testMode: true, // Set to false for production
      baseUrl: 'https://cert-manager.com/api',
      endpoints: {
        request: '/certificates/request',
        status: '/certificates/{id}/status',
        download: '/certificates/{id}/download',
        revoke: '/certificates/{id}/revoke'
      },
      supportedTypes: ['personal', 'organization', 'extended_validation'],
      pricing: {
        personal: 75, // USD per year
        organization: 199,
        extended_validation: 349
      },
      validationMethods: ['EMAIL', 'DNS', 'FILE'],
      maxValidityPeriod: 365 // days
    },
    
    digicert: {
      name: 'DigiCert',
      enabled: true,
      testMode: true,
      baseUrl: 'https://www.digicert.com/services/v2',
      endpoints: {
        request: '/order/certificate',
        status: '/order/certificate/{id}',
        download: '/certificate/{id}/download',
        revoke: '/certificate/{id}/revoke'
      },
      supportedTypes: ['ssl', 'code_signing', 'client', 'email'],
      pricing: {
        ssl: 175,
        code_signing: 474,
        client: 95,
        email: 95
      },
      validationMethods: ['EMAIL', 'DNS', 'FILE', 'ORGANIZATION'],
      maxValidityPeriod: 365
    },
    
    globalsign: {
      name: 'GlobalSign',
      enabled: true,
      testMode: true,
      baseUrl: 'https://emea.api.globalsign.com',
      endpoints: {
        request: '/certificate',
        status: '/certificate/{id}',
        download: '/certificate/{id}/download',
        revoke: '/certificate/{id}/revoke'
      },
      supportedTypes: ['personal', 'organization', 'extended_validation', 'code_signing'],
      pricing: {
        personal: 89,
        organization: 249,
        extended_validation: 449,
        code_signing: 599
      },
      validationMethods: ['EMAIL', 'DNS', 'ORGANIZATION'],
      maxValidityPeriod: 365
    }
  },

  // Hardware Security Module Providers
  hsmProviders: {
    aws_cloudhsm: {
      name: 'AWS CloudHSM',
      vendor: 'aws',
      type: 'cloud',
      enabled: false, // Set via environment variable
      fipsLevel: 'level3',
      capabilities: ['keygeneration', 'sign', 'verify', 'encrypt', 'decrypt'],
      pricing: {
        cluster: 1.45, // USD per hour
        hsm: 1.60, // USD per hour per HSM
        requests: 0.30 // USD per 10,000 requests
      },
      regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'],
      keyTypes: ['RSA-2048', 'RSA-3072', 'RSA-4096', 'ECC-P256', 'ECC-P384', 'ECC-P521']
    },
    
    azure_keyvault: {
      name: 'Azure Key Vault',
      vendor: 'azure',
      type: 'cloud',
      enabled: false,
      fipsLevel: 'level2', // Premium tier is level3
      capabilities: ['keygeneration', 'sign', 'verify', 'encrypt', 'decrypt'],
      pricing: {
        standard: 0.03, // USD per 10,000 requests
        premium: 1.00, // USD per key per month + requests
        hsm: 5.00 // USD per key per month
      },
      regions: ['eastus', 'westus2', 'westeurope', 'southeastasia'],
      keyTypes: ['RSA-2048', 'RSA-3072', 'RSA-4096', 'ECC-P256', 'ECC-P384', 'ECC-P521']
    },
    
    thales_network: {
      name: 'Thales Network HSM',
      vendor: 'thales',
      type: 'network',
      enabled: false,
      fipsLevel: 'level3',
      capabilities: ['keygeneration', 'sign', 'verify', 'encrypt', 'decrypt'],
      connectivity: ['network', 'usb', 'pcie'],
      keyTypes: ['RSA-1024', 'RSA-2048', 'RSA-3072', 'RSA-4096', 'ECC-P256', 'ECC-P384', 'ECC-P521']
    }
  },

  // Cryptographic Algorithms
  algorithms: {
    signing: {
      'RSA-PSS': {
        name: 'RSA-PSS',
        description: 'RSA Probabilistic Signature Scheme',
        keySizes: [2048, 3072, 4096],
        hashAlgorithms: ['SHA-256', 'SHA-384', 'SHA-512'],
        recommended: true,
        security: 'high',
        performance: 'medium'
      },
      'RSA-PKCS1': {
        name: 'RSA-PKCS1',
        description: 'RSA PKCS#1 v1.5',
        keySizes: [2048, 3072, 4096],
        hashAlgorithms: ['SHA-256', 'SHA-384', 'SHA-512'],
        recommended: false,
        security: 'medium',
        performance: 'medium',
        deprecated: true
      },
      'ECDSA': {
        name: 'ECDSA',
        description: 'Elliptic Curve Digital Signature Algorithm',
        curves: ['P-256', 'P-384', 'P-521'],
        hashAlgorithms: ['SHA-256', 'SHA-384', 'SHA-512'],
        recommended: true,
        security: 'high',
        performance: 'high'
      },
      'EdDSA': {
        name: 'EdDSA',
        description: 'Edwards-curve Digital Signature Algorithm',
        curves: ['Ed25519', 'Ed448'],
        recommended: true,
        security: 'high',
        performance: 'very_high',
        support: 'limited' // Not widely supported yet
      }
    },
    
    hashing: {
      'SHA-256': { strength: 256, recommended: true },
      'SHA-384': { strength: 384, recommended: true },
      'SHA-512': { strength: 512, recommended: true },
      'SHA-1': { strength: 160, deprecated: true },
      'MD5': { strength: 128, deprecated: true, insecure: true }
    }
  },

  // Certificate Types and Validation Levels
  certificateTypes: {
    domain_validation: {
      name: 'Domain Validation (DV)',
      description: 'Basic certificate with domain ownership verification',
      validationLevel: 'domain',
      issuanceTime: '5-30 minutes',
      warranty: '$10,000',
      browserTrust: '99.9%',
      useCase: 'Basic websites, blogs, testing'
    },
    
    organization_validation: {
      name: 'Organization Validation (OV)',
      description: 'Certificate with organization identity verification',
      validationLevel: 'organization',
      issuanceTime: '1-3 business days',
      warranty: '$100,000',
      browserTrust: '99.9%',
      useCase: 'Business websites, e-commerce'
    },
    
    extended_validation: {
      name: 'Extended Validation (EV)',
      description: 'Highest level certificate with extensive verification',
      validationLevel: 'extended',
      issuanceTime: '3-7 business days',
      warranty: '$1,000,000',
      browserTrust: '99.9%',
      useCase: 'Financial institutions, high-security applications',
      features: ['Green address bar', 'Company name display']
    },
    
    code_signing: {
      name: 'Code Signing',
      description: 'Certificate for signing software and code',
      validationLevel: 'organization',
      issuanceTime: '1-5 business days',
      warranty: '$100,000',
      useCase: 'Software distribution, driver signing',
      features: ['SmartScreen reputation', 'Timestamp support']
    },
    
    personal: {
      name: 'Personal/Client',
      description: 'Certificate for individual identity verification',
      validationLevel: 'individual',
      issuanceTime: '1-2 business days',
      warranty: '$10,000',
      useCase: 'Email signing, document signing, authentication'
    }
  },

  // Compliance Standards
  compliance: {
    eidas: {
      name: 'eIDAS (Electronic Identification, Authentication and Trust Services)',
      region: 'EU',
      levels: ['Simple', 'Advanced', 'Qualified'],
      requirements: {
        simple: 'Basic electronic signature',
        advanced: 'Advanced electronic signature with certificate',
        qualified: 'Qualified electronic signature with QSCD'
      }
    },
    
    fips140: {
      name: 'FIPS 140-2',
      region: 'US',
      levels: ['Level 1', 'Level 2', 'Level 3', 'Level 4'],
      requirements: {
        level1: 'Basic security requirements',
        level2: 'Physical tamper-evidence',
        level3: 'Tamper-resistant and identity-based authentication',
        level4: 'Complete envelope of protection'
      }
    },
    
    common_criteria: {
      name: 'Common Criteria',
      region: 'International',
      levels: ['EAL1', 'EAL2', 'EAL3', 'EAL4', 'EAL5', 'EAL6', 'EAL7'],
      description: 'International standard for computer security certification'
    }
  },

  // Security Policies
  security: {
    keyGeneration: {
      minimumKeySize: {
        'RSA': 2048,
        'ECDSA': 256
      },
      requiredEntropy: 256, // bits
      keyRotationPeriod: 365, // days
      backupRequired: true
    },
    
    certificateLifecycle: {
      renewalNotificationPeriod: 30, // days before expiration
      automaticRenewal: false, // Require manual approval
      maxValidityPeriod: 365, // days
      revocationCheckInterval: 24 // hours
    },
    
    accessControl: {
      multiFactorAuthRequired: true,
      roleBasedAccess: true,
      auditLogging: true,
      sessionTimeout: 30 // minutes
    }
  },

  // Environment Configuration
  environment: {
    development: {
      useTestCAs: true,
      allowSelfSigned: true,
      enableDebugLogging: true,
      skipCertificateValidation: false // Keep validation even in dev
    },
    
    staging: {
      useTestCAs: true,
      allowSelfSigned: false,
      enableDebugLogging: true,
      skipCertificateValidation: false
    },
    
    production: {
      useTestCAs: false,
      allowSelfSigned: false,
      enableDebugLogging: false,
      skipCertificateValidation: false,
      requireHSM: false, // Set to true if HSM is mandatory
      enforceCompliance: true
    }
  },

  // API Rate Limits and Quotas
  rateLimits: {
    sectigo: {
      requestsPerHour: 100,
      requestsPerDay: 1000,
      burstLimit: 10
    },
    
    digicert: {
      requestsPerHour: 200,
      requestsPerDay: 2000,
      burstLimit: 20
    },
    
    globalsign: {
      requestsPerHour: 150,
      requestsPerDay: 1500,
      burstLimit: 15
    }
  }
};

// Environment-specific configuration loader
export function loadPKIConfig() {
  const env = import.meta.env.VITE_ENVIRONMENT || 'development';
  const config = { ...PKIConfig };
  
  // Apply environment-specific settings
  if (config.environment[env]) {
    Object.assign(config, config.environment[env]);
  }
  
  // Enable/disable providers based on environment variables
  config.certificateAuthorities.sectigo.enabled = 
    import.meta.env.VITE_SECTIGO_ENABLED === 'true';
  config.certificateAuthorities.digicert.enabled = 
    import.meta.env.VITE_DIGICERT_ENABLED === 'true';
  config.certificateAuthorities.globalsign.enabled = 
    import.meta.env.VITE_GLOBALSIGN_ENABLED === 'true';
    
  config.hsmProviders.aws_cloudhsm.enabled = 
    import.meta.env.VITE_AWS_CLOUDHSM_ENABLED === 'true';
  config.hsmProviders.azure_keyvault.enabled = 
    import.meta.env.VITE_AZURE_KEYVAULT_ENABLED === 'true';
  config.hsmProviders.thales_network.enabled = 
    import.meta.env.VITE_THALES_HSM_ENABLED === 'true';
  
  return config;
}

// Validation functions
export function validateCAProvider(provider) {
  const config = loadPKIConfig();
  const caConfig = config.certificateAuthorities[provider];
  
  if (!caConfig) {
    throw new Error(`Unknown CA provider: ${provider}`);
  }
  
  if (!caConfig.enabled) {
    throw new Error(`CA provider ${provider} is disabled`);
  }
  
  return caConfig;
}

export function validateCertificateType(type, provider) {
  const caConfig = validateCAProvider(provider);
  
  if (!caConfig.supportedTypes.includes(type)) {
    throw new Error(`Certificate type ${type} not supported by ${provider}`);
  }
  
  return true;
}

export function getRecommendedAlgorithm() {
  const config = loadPKIConfig();
  const algorithms = config.algorithms.signing;
  
  // Return the first recommended algorithm
  for (const [name, algo] of Object.entries(algorithms)) {
    if (algo.recommended && !algo.deprecated) {
      return {
        name,
        keySize: algo.keySizes ? algo.keySizes[1] : null, // Middle option
        curve: algo.curves ? algo.curves[0] : null, // First curve
        hashAlgorithm: algo.hashAlgorithms[0] // First hash
      };
    }
  }
  
  // Fallback
  return {
    name: 'RSA-PSS',
    keySize: 2048,
    hashAlgorithm: 'SHA-256'
  };
}

export function getComplianceRequirements(standard, level) {
  const config = loadPKIConfig();
  const compliance = config.compliance[standard];
  
  if (!compliance) {
    throw new Error(`Unknown compliance standard: ${standard}`);
  }
  
  return compliance.requirements[level] || null;
}

export default PKIConfig;
