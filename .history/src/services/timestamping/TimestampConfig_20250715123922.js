// Timestamp Configuration
// Configuration for trusted timestamping services and compliance

export const TimestampConfig = {
  // Default Settings
  defaults: {
    provider: 'digicert',
    hashAlgorithm: 'SHA-256',
    includeQualifiedTimestamp: true,
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000 // 1 second
  },

  // Qualified Trust Service Providers (QTSP)
  providers: {
    digicert: {
      name: 'DigiCert Timestamp Authority',
      url: 'http://timestamp.digicert.com',
      type: 'rfc3161',
      qualified: true,
      region: 'global',
      compliance: ['eIDAS', 'ETSI_TS_119_424', 'WebTrust'],
      algorithm: 'SHA-256',
      reliability: 'high',
      cost: 'low',
      maxRequestsPerSecond: 10,
      description: 'Global timestamp authority with high reliability'
    },

    globalsign: {
      name: 'GlobalSign Timestamp Service',
      url: 'http://timestamp.globalsign.com/scripts/timstamp.dll',
      type: 'rfc3161',
      qualified: true,
      region: 'global',
      compliance: ['eIDAS', 'ETSI_TS_119_424', 'WebTrust'],
      algorithm: 'SHA-256',
      reliability: 'high',
      cost: 'medium',
      maxRequestsPerSecond: 8,
      description: 'Trusted timestamp authority with global presence'
    },

    sectigo: {
      name: 'Sectigo Timestamp Authority',
      url: 'http://timestamp.sectigo.com',
      type: 'rfc3161',
      qualified: true,
      region: 'global',
      compliance: ['eIDAS', 'ETSI_TS_119_424'],
      algorithm: 'SHA-256',
      reliability: 'high',
      cost: 'low',
      maxRequestsPerSecond: 12,
      description: 'Cost-effective timestamp authority'
    },

    eu_qtsp: {
      name: 'EU Qualified Timestamp Service',
      url: 'http://qtsa.eu-qtsp.com/tsa',
      type: 'rfc3161',
      qualified: true,
      region: 'eu',
      compliance: ['eIDAS', 'ETSI_TS_119_424', 'ETSI_EN_319_422'],
      algorithm: 'SHA-256',
      reliability: 'very_high',
      cost: 'high',
      maxRequestsPerSecond: 5,
      description: 'EU-specific qualified timestamp service for highest compliance',
      requiresRegistration: true
    }
  },

  // Legal Compliance Levels
  compliance: {
    eidas: {
      name: 'eIDAS Regulation',
      region: 'EU',
      levels: {
        simple: {
          name: 'Simple Electronic Signature',
          requirements: ['basic_timestamp'],
          legalValue: 'basic'
        },
        advanced: {
          name: 'Advanced Electronic Signature (AdES)',
          requirements: ['qualified_timestamp', 'certificate_validation'],
          legalValue: 'advanced'
        },
        qualified: {
          name: 'Qualified Electronic Signature (QES)',
          requirements: ['qualified_timestamp', 'qualified_certificate', 'qtsp_verification'],
          legalValue: 'qualified'
        }
      }
    },

    esign: {
      name: 'ESIGN Act',
      region: 'US',
      requirements: ['timestamp', 'intent_demonstration', 'audit_trail'],
      legalValue: 'legally_binding'
    },

    ueta: {
      name: 'Uniform Electronic Transactions Act',
      region: 'US',
      requirements: ['timestamp', 'electronic_record', 'attribution_method'],
      legalValue: 'legally_binding'
    }
  },

  // Hash Algorithms
  algorithms: {
    'SHA-256': {
      strength: 256,
      recommended: true,
      performance: 'high',
      compliance: ['eIDAS', 'NIST', 'FIPS']
    },
    'SHA-384': {
      strength: 384,
      recommended: true,
      performance: 'medium',
      compliance: ['eIDAS', 'NIST', 'FIPS']
    },
    'SHA-512': {
      strength: 512,
      recommended: true,
      performance: 'medium',
      compliance: ['eIDAS', 'NIST', 'FIPS']
    },
    'SHA-1': {
      strength: 160,
      recommended: false,
      deprecated: true,
      reason: 'Cryptographically weak'
    }
  },

  // Quality of Service
  qos: {
    response_time: {
      excellent: '< 1s',
      good: '< 5s',
      acceptable: '< 15s',
      poor: '> 15s'
    },
    availability: {
      tier1: '99.99%',
      tier2: '99.9%',
      tier3: '99.5%'
    },
    accuracy: {
      required: '±1s',
      recommended: '±100ms'
    }
  },

  // Timestamp Verification
  verification: {
    checks: [
      'signature_validation',
      'certificate_chain_validation',
      'timestamp_authority_validation',
      'temporal_consistency',
      'hash_integrity',
      'nonce_verification'
    ],
    cache: {
      enabled: true,
      ttl: 3600, // 1 hour
      maxSize: 1000
    }
  },

  // Long-term Validation (LTV)
  longTermValidation: {
    intervals: {
      initial: '1_month',
      regular: '1_year',
      critical: '5_years'
    },
    actions: {
      certificate_check: true,
      algorithm_validation: true,
      re_timestamp_check: true,
      archival_recommendation: true
    },
    archival: {
      formats: ['PAdES-LTV', 'XAdES-LTV', 'CAdES-LTV'],
      retention: '10_years',
      migration_schedule: '5_years'
    }
  },

  // Error Handling
  errors: {
    network: {
      timeout: 'TIMESTAMP_TIMEOUT',
      unreachable: 'TIMESTAMP_UNREACHABLE',
      rate_limit: 'TIMESTAMP_RATE_LIMIT'
    },
    validation: {
      invalid_response: 'INVALID_TIMESTAMP_RESPONSE',
      signature_failed: 'TIMESTAMP_SIGNATURE_INVALID',
      certificate_invalid: 'TIMESTAMP_CERT_INVALID'
    },
    system: {
      provider_unavailable: 'TIMESTAMP_PROVIDER_UNAVAILABLE',
      configuration_error: 'TIMESTAMP_CONFIG_ERROR'
    }
  },

  // Performance Optimization
  optimization: {
    batch_processing: {
      enabled: true,
      max_batch_size: 50,
      timeout: 60000 // 1 minute
    },
    connection_pooling: {
      enabled: true,
      max_connections: 10,
      keep_alive: 30000
    },
    caching: {
      provider_certificates: {
        enabled: true,
        ttl: 86400 // 24 hours
      },
      validation_results: {
        enabled: true,
        ttl: 3600 // 1 hour
      }
    }
  },

  // Monitoring and Alerting
  monitoring: {
    health_checks: {
      interval: 300000, // 5 minutes
      timeout: 10000, // 10 seconds
      failure_threshold: 3
    },
    metrics: [
      'response_time',
      'success_rate',
      'error_rate',
      'availability',
      'throughput'
    ],
    alerts: {
      provider_down: {
        severity: 'high',
        notification: ['email', 'sms']
      },
      high_error_rate: {
        severity: 'medium',
        threshold: 0.05 // 5%
      },
      slow_response: {
        severity: 'low',
        threshold: 10000 // 10 seconds
      }
    }
  },

  // Security
  security: {
    request_signing: {
      enabled: false, // Not typically required for TSA requests
      algorithm: 'RSA-PSS'
    },
    nonce_generation: {
      enabled: true,
      entropy_bits: 128
    },
    certificate_validation: {
      check_revocation: true,
      methods: ['OCSP', 'CRL'],
      cache_ttl: 3600
    }
  }
};

// Environment-specific configuration
export function loadTimestampConfig() {
  const env = import.meta.env.VITE_ENVIRONMENT || 'development';
  const config = { ...TimestampConfig };

  // Environment-specific overrides
  switch (env) {
    case 'development':
      config.defaults.timeout = 60000; // Longer timeout for dev
      config.optimization.caching.validation_results.enabled = false;
      break;
      
    case 'staging':
      config.providers.digicert.url = 'http://timestamp-staging.digicert.com';
      break;
      
    case 'production':
      config.monitoring.health_checks.interval = 60000; // More frequent in prod
      config.security.certificate_validation.check_revocation = true;
      break;
  }

  return config;
}

// Provider selection logic
export function selectOptimalProvider(requirements = {}) {
  const config = loadTimestampConfig();
  const {
    region = 'global',
    qualified = true,
    cost_preference = 'low',
    performance_priority = true
  } = requirements;

  const providers = Object.entries(config.providers)
    .filter(([_, provider]) => {
      if (qualified && !provider.qualified) return false;
      if (region !== 'global' && provider.region !== region && provider.region !== 'global') return false;
      return true;
    })
    .map(([key, provider]) => ({
      key,
      ...provider,
      score: calculateProviderScore(provider, requirements)
    }))
    .sort((a, b) => b.score - a.score);

  return providers.length > 0 ? providers[0] : null;
}

function calculateProviderScore(provider, requirements) {
  let score = 0;

  // Reliability score
  const reliabilityScores = { very_high: 5, high: 4, medium: 3, low: 2 };
  score += reliabilityScores[provider.reliability] || 0;

  // Cost score (inverse - lower cost = higher score)
  const costScores = { low: 3, medium: 2, high: 1 };
  score += costScores[provider.cost] || 0;

  // Performance score
  score += provider.maxRequestsPerSecond / 2;

  // Compliance bonus
  score += provider.compliance.length;

  // Regional preference
  if (requirements.region === provider.region) {
    score += 2;
  }

  return score;
}

// Validation helpers
export function validateTimestampRequest(request) {
  const errors = [];

  if (!request.data || request.data.byteLength === 0) {
    errors.push('Data is required for timestamping');
  }

  if (request.provider && !TimestampConfig.providers[request.provider]) {
    errors.push(`Unknown timestamp provider: ${request.provider}`);
  }

  if (request.hashAlgorithm && !TimestampConfig.algorithms[request.hashAlgorithm]) {
    errors.push(`Unsupported hash algorithm: ${request.hashAlgorithm}`);
  }

  if (request.hashAlgorithm && TimestampConfig.algorithms[request.hashAlgorithm].deprecated) {
    errors.push(`Hash algorithm ${request.hashAlgorithm} is deprecated`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default TimestampConfig;
