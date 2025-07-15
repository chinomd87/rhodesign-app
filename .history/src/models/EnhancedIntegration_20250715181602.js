// Enhanced Integration Model for Tier 2 marketplace integration support
// Comprehensive data models for advanced integration management

/**
 * Enhanced Integration Model
 * 
 * Supports both Tier 1 (essential) and Tier 2 (marketplace) integrations
 * with advanced features including:
 * - Marketplace integration management
 * - Custom integration definitions
 * - Workflow automation configurations
 * - Performance analytics and monitoring
 * - Compliance and security frameworks
 * - Cross-platform data synchronization
 */

export const IntegrationTier = {
  TIER_1: 'tier_1',
  TIER_2: 'tier_2',
  CUSTOM: 'custom',
  ENTERPRISE: 'enterprise'
};

export const IntegrationCategory = {
  // Tier 1 Categories
  STORAGE: 'storage',
  CRM: 'crm',
  COMMUNICATION: 'communication',
  PAYMENTS: 'payments',
  IDENTITY: 'identity',
  
  // Tier 2 Categories
  PROJECT_MANAGEMENT: 'project_management',
  ANALYTICS: 'analytics',
  MARKETING: 'marketing',
  ECOMMERCE: 'ecommerce',
  DEVELOPMENT: 'development',
  LEGAL: 'legal',
  HEALTHCARE: 'healthcare',
  REAL_ESTATE: 'real_estate',
  FINANCIAL_SERVICES: 'financial_services',
  ACCOUNTING: 'accounting',
  COLLABORATION: 'collaboration',
  DATABASE: 'database',
  DOCUMENTATION: 'documentation',
  ERP: 'erp',
  COMMUNITY: 'community',
  MESSAGING: 'messaging',
  
  // Custom Categories
  CUSTOM_WORKFLOW: 'custom_workflow',
  INDUSTRY_SPECIFIC: 'industry_specific',
  PROPRIETARY: 'proprietary'
};

export const IntegrationType = {
  // Basic Types
  API_INTEGRATION: 'api_integration',
  WEBHOOK: 'webhook',
  FILE_SYNC: 'file_sync',
  
  // Advanced Types
  WORKFLOW_AUTOMATION: 'workflow_automation',
  DATA_VISUALIZATION: 'data_visualization',
  BUSINESS_INTELLIGENCE: 'business_intelligence',
  PRACTICE_MANAGEMENT: 'practice_management',
  EHR_INTEGRATION: 'ehr_integration',
  PROPERTY_MANAGEMENT: 'property_management',
  BROKERAGE_PLATFORM: 'brokerage_platform',
  FINANCIAL_MANAGEMENT: 'financial_management',
  CLOUD_ACCOUNTING: 'cloud_accounting',
  ENTERPRISE_SYSTEM: 'enterprise_system',
  KNOWLEDGE_BASE: 'knowledge_base',
  ISSUE_TRACKING: 'issue_tracking',
  DEVOPS_PLATFORM: 'devops_platform',
  REPOSITORY_MANAGEMENT: 'repository_management',
  EMAIL_AUTOMATION: 'email_automation',
  COMMERCE_PLATFORM: 'commerce_platform',
  WORDPRESS_COMMERCE: 'wordpress_commerce',
  CUSTOMER_DATA_PLATFORM: 'customer_data_platform',
  MODERN_BI: 'modern_bi',
  PRODUCT_ANALYTICS: 'product_analytics',
  COMMUNITY_PLATFORM: 'community_platform',
  BUSINESS_MESSAGING: 'business_messaging',
  MESSAGING_API: 'messaging_api',
  TASK_AUTOMATION: 'task_automation',
  WORKSPACE_INTEGRATION: 'workspace_integration',
  
  // Custom Types
  CUSTOM_WORKFLOW: 'custom_workflow',
  HYBRID_INTEGRATION: 'hybrid_integration'
};

export const AuthenticationType = {
  API_KEY: 'api_key',
  OAUTH2: 'oauth2',
  OAUTH2_FHIR: 'oauth2_fhir',
  BOT_TOKEN: 'bot_token',
  JWT: 'jwt',
  SAML: 'saml',
  BASIC_AUTH: 'basic_auth',
  CUSTOM: 'custom'
};

export const IntegrationStatus = {
  PENDING: 'pending',
  CONFIGURING: 'configuring',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ERROR: 'error',
  SUSPENDED: 'suspended',
  DEPRECATED: 'deprecated'
};

export const IntegrationComplexity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  VERY_HIGH: 'very_high'
};

export const PricingModel = {
  FREE: 'free',
  FREEMIUM: 'freemium',
  SUBSCRIPTION: 'subscription',
  USAGE_BASED: 'usage_based',
  ENTERPRISE: 'enterprise',
  ONE_TIME: 'one_time'
};

export const ComplianceFramework = {
  SOC2: 'SOC2',
  GDPR: 'GDPR',
  HIPAA: 'HIPAA',
  HIPAA_AVAILABLE: 'HIPAA_available',
  CCPA: 'CCPA',
  PCI_DSS: 'PCI_DSS',
  ISO_27001: 'ISO_27001',
  FEDRAMP: 'FedRAMP',
  SEC: 'SEC',
  FINRA: 'FINRA',
  HL7_FHIR: 'HL7_FHIR',
  CAN_SPAM: 'CAN_SPAM',
  ATTORNEY_CLIENT_PRIVILEGE: 'attorney_client_privilege',
  FACEBOOK_POLICIES: 'facebook_policies'
};

export const DataSyncDirection = {
  ONE_WAY: 'one-way',
  BI_DIRECTIONAL: 'bi-directional',
  READ_ONLY: 'read-only',
  WRITE_ONLY: 'write-only'
};

/**
 * Enhanced Integration Model
 */
export class EnhancedIntegration {
  constructor(data = {}) {
    // Basic Integration Properties
    this.id = data.id || null;
    this.name = data.name || '';
    this.description = data.description || '';
    this.category = data.category || IntegrationCategory.CUSTOM;
    this.type = data.type || IntegrationType.API_INTEGRATION;
    this.tier = data.tier || IntegrationTier.TIER_2;
    this.status = data.status || IntegrationStatus.PENDING;
    
    // Marketplace Properties
    this.marketplaceId = data.marketplaceId || null;
    this.version = data.version || '1.0.0';
    this.vendor = data.vendor || '';
    this.iconUrl = data.iconUrl || '';
    this.websiteUrl = data.websiteUrl || '';
    this.documentationUrl = data.documentationUrl || '';
    this.supportUrl = data.supportUrl || '';
    
    // Technical Configuration
    this.configuration = new IntegrationConfiguration(data.configuration);
    this.authentication = new AuthenticationConfig(data.authentication);
    this.endpoints = data.endpoints || {};
    this.webhooks = data.webhooks || {};
    this.dataMapping = data.dataMapping || {};
    this.syncSettings = new SyncSettings(data.syncSettings);
    
    // Advanced Features
    this.features = data.features || [];
    this.capabilities = data.capabilities || [];
    this.limitations = data.limitations || [];
    this.requirements = data.requirements || [];
    
    // Pricing and Commercial
    this.pricing = new PricingConfig(data.pricing);
    this.license = data.license || 'proprietary';
    this.trialAvailable = data.trialAvailable || false;
    this.trialDuration = data.trialDuration || null;
    
    // Compliance and Security
    this.compliance = data.compliance || [];
    this.securityFeatures = data.securityFeatures || [];
    this.dataRetention = data.dataRetention || null;
    this.encryptionSupport = data.encryptionSupport || false;
    
    // Performance and Reliability
    this.performance = new PerformanceMetrics(data.performance);
    this.reliability = new ReliabilityMetrics(data.reliability);
    this.sla = data.sla || null;
    this.uptime = data.uptime || null;
    
    // Integration Complexity and Support
    this.complexity = data.complexity || IntegrationComplexity.MEDIUM;
    this.estimatedSetupTime = data.estimatedSetupTime || '30-60 minutes';
    this.supportLevel = data.supportLevel || 'community';
    this.expertiseRequired = data.expertiseRequired || [];
    
    // Usage and Analytics
    this.popularity = data.popularity || 0;
    this.rating = data.rating || 0;
    this.reviewCount = data.reviewCount || 0;
    this.installCount = data.installCount || 0;
    this.activeUsers = data.activeUsers || 0;
    
    // Workflow and Automation
    this.workflowCapabilities = new WorkflowCapabilities(data.workflowCapabilities);
    this.automationRules = data.automationRules || [];
    this.triggerEvents = data.triggerEvents || [];
    this.actions = data.actions || [];
    
    // Custom Integration Properties
    this.isCustom = data.isCustom || false;
    this.customSpec = data.customSpec || null;
    this.customWorkflows = data.customWorkflows || [];
    
    // Organization and User Context
    this.organizationId = data.organizationId || null;
    this.userId = data.userId || null;
    this.installationId = data.installationId || null;
    this.installDate = data.installDate || null;
    this.lastUsed = data.lastUsed || null;
    this.usageCount = data.usageCount || 0;
    
    // Monitoring and Health
    this.health = new IntegrationHealth(data.health);
    this.monitoring = new MonitoringConfig(data.monitoring);
    this.alerts = data.alerts || [];
    
    // Metadata
    this.tags = data.tags || [];
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Utility Methods
  isActive() {
    return this.status === IntegrationStatus.ACTIVE;
  }

  isTier2() {
    return this.tier === IntegrationTier.TIER_2;
  }

  isCustomIntegration() {
    return this.isCustom || this.tier === IntegrationTier.CUSTOM;
  }

  hasCompliance(framework) {
    return this.compliance.includes(framework);
  }

  supportsDataSync(direction) {
    return this.syncSettings.directions.includes(direction);
  }

  getHealthScore() {
    return this.health.score || 0;
  }

  isHighComplexity() {
    return [IntegrationComplexity.HIGH, IntegrationComplexity.VERY_HIGH].includes(this.complexity);
  }

  // Serialization
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      category: this.category,
      type: this.type,
      tier: this.tier,
      status: this.status,
      configuration: this.configuration.toJSON(),
      authentication: this.authentication.toJSON(),
      performance: this.performance.toJSON(),
      health: this.health.toJSON(),
      isActive: this.isActive(),
      healthScore: this.getHealthScore(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Integration Configuration
 */
export class IntegrationConfiguration {
  constructor(data = {}) {
    this.baseUrl = data.baseUrl || '';
    this.apiVersion = data.apiVersion || 'v1';
    this.timeout = data.timeout || 30000;
    this.retryAttempts = data.retryAttempts || 3;
    this.rateLimiting = data.rateLimiting || {};
    this.customHeaders = data.customHeaders || {};
    this.customParams = data.customParams || {};
    this.sslVerification = data.sslVerification !== false;
    this.connectionPooling = data.connectionPooling || false;
    this.caching = new CachingConfig(data.caching);
  }

  toJSON() {
    return {
      baseUrl: this.baseUrl,
      apiVersion: this.apiVersion,
      timeout: this.timeout,
      retryAttempts: this.retryAttempts,
      sslVerification: this.sslVerification,
      caching: this.caching.toJSON()
    };
  }
}

/**
 * Authentication Configuration
 */
export class AuthenticationConfig {
  constructor(data = {}) {
    this.type = data.type || AuthenticationType.API_KEY;
    this.credentials = data.credentials || {};
    this.tokenRefreshUrl = data.tokenRefreshUrl || null;
    this.tokenExpiryTime = data.tokenExpiryTime || null;
    this.scopes = data.scopes || [];
    this.refreshThreshold = data.refreshThreshold || 300; // 5 minutes
    this.autoRefresh = data.autoRefresh !== false;
  }

  toJSON() {
    return {
      type: this.type,
      scopes: this.scopes,
      autoRefresh: this.autoRefresh,
      refreshThreshold: this.refreshThreshold
    };
  }
}

/**
 * Sync Settings
 */
export class SyncSettings {
  constructor(data = {}) {
    this.frequency = data.frequency || 'manual';
    this.directions = data.directions || [DataSyncDirection.BI_DIRECTIONAL];
    this.batchSize = data.batchSize || 100;
    this.conflictResolution = data.conflictResolution || 'manual';
    this.deltaSync = data.deltaSync !== false;
    this.realTimeSync = data.realTimeSync || false;
    this.syncFilters = data.syncFilters || {};
  }

  toJSON() {
    return {
      frequency: this.frequency,
      directions: this.directions,
      batchSize: this.batchSize,
      realTimeSync: this.realTimeSync
    };
  }
}

/**
 * Pricing Configuration
 */
export class PricingConfig {
  constructor(data = {}) {
    this.model = data.model || PricingModel.FREEMIUM;
    this.cost = data.cost || 0;
    this.currency = data.currency || 'USD';
    this.billingCycle = data.billingCycle || 'monthly';
    this.usageTiers = data.usageTiers || [];
    this.freeLimit = data.freeLimit || null;
    this.enterpriseDiscounts = data.enterpriseDiscounts || false;
  }

  toJSON() {
    return {
      model: this.model,
      cost: this.cost,
      currency: this.currency,
      billingCycle: this.billingCycle
    };
  }
}

/**
 * Performance Metrics
 */
export class PerformanceMetrics {
  constructor(data = {}) {
    this.averageResponseTime = data.averageResponseTime || 0;
    this.throughput = data.throughput || 0;
    this.errorRate = data.errorRate || 0;
    this.successRate = data.successRate || 100;
    this.p95ResponseTime = data.p95ResponseTime || 0;
    this.p99ResponseTime = data.p99ResponseTime || 0;
    this.lastMeasured = data.lastMeasured || new Date();
  }

  toJSON() {
    return {
      averageResponseTime: this.averageResponseTime,
      throughput: this.throughput,
      errorRate: this.errorRate,
      successRate: this.successRate,
      lastMeasured: this.lastMeasured
    };
  }
}

/**
 * Reliability Metrics
 */
export class ReliabilityMetrics {
  constructor(data = {}) {
    this.uptime = data.uptime || 100;
    this.availability = data.availability || 100;
    this.mttr = data.mttr || 0; // Mean Time To Recovery
    this.mtbf = data.mtbf || 0; // Mean Time Between Failures
    this.failureCount = data.failureCount || 0;
    this.lastFailure = data.lastFailure || null;
  }

  toJSON() {
    return {
      uptime: this.uptime,
      availability: this.availability,
      mttr: this.mttr,
      failureCount: this.failureCount
    };
  }
}

/**
 * Integration Health
 */
export class IntegrationHealth {
  constructor(data = {}) {
    this.status = data.status || 'healthy';
    this.score = data.score || 100;
    this.lastCheck = data.lastCheck || new Date();
    this.issues = data.issues || [];
    this.connectionStatus = data.connectionStatus || 'connected';
    this.authenticationStatus = data.authenticationStatus || 'valid';
    this.dataConsistency = data.dataConsistency || 'consistent';
    this.performanceStatus = data.performanceStatus || 'optimal';
  }

  toJSON() {
    return {
      status: this.status,
      score: this.score,
      lastCheck: this.lastCheck,
      connectionStatus: this.connectionStatus,
      issues: this.issues
    };
  }
}

/**
 * Monitoring Configuration
 */
export class MonitoringConfig {
  constructor(data = {}) {
    this.enabled = data.enabled !== false;
    this.healthCheckInterval = data.healthCheckInterval || 300000; // 5 minutes
    this.metricsCollection = data.metricsCollection !== false;
    this.alerting = data.alerting !== false;
    this.logLevel = data.logLevel || 'info';
    this.customMetrics = data.customMetrics || [];
  }

  toJSON() {
    return {
      enabled: this.enabled,
      healthCheckInterval: this.healthCheckInterval,
      metricsCollection: this.metricsCollection,
      alerting: this.alerting,
      logLevel: this.logLevel
    };
  }
}

/**
 * Workflow Capabilities
 */
export class WorkflowCapabilities {
  constructor(data = {}) {
    this.supportsWorkflows = data.supportsWorkflows || false;
    this.maxWorkflows = data.maxWorkflows || 0;
    this.conditionalLogic = data.conditionalLogic || false;
    this.parallelExecution = data.parallelExecution || false;
    this.errorHandling = data.errorHandling || false;
    this.retryLogic = data.retryLogic || false;
    this.scheduledExecution = data.scheduledExecution || false;
  }

  toJSON() {
    return {
      supportsWorkflows: this.supportsWorkflows,
      maxWorkflows: this.maxWorkflows,
      conditionalLogic: this.conditionalLogic,
      parallelExecution: this.parallelExecution
    };
  }
}

/**
 * Caching Configuration
 */
export class CachingConfig {
  constructor(data = {}) {
    this.enabled = data.enabled || false;
    this.ttl = data.ttl || 3600; // 1 hour
    this.strategy = data.strategy || 'LRU';
    this.maxSize = data.maxSize || 1000;
    this.keyPattern = data.keyPattern || '';
  }

  toJSON() {
    return {
      enabled: this.enabled,
      ttl: this.ttl,
      strategy: this.strategy,
      maxSize: this.maxSize
    };
  }
}

/**
 * Integration Factory
 */
export class IntegrationFactory {
  static createTier2Integration(integrationKey, config = {}) {
    const baseConfig = {
      tier: IntegrationTier.TIER_2,
      status: IntegrationStatus.PENDING,
      marketplaceId: integrationKey,
      ...config
    };

    return new EnhancedIntegration(baseConfig);
  }

  static createCustomIntegration(name, targetService, spec = {}) {
    const customConfig = {
      name,
      tier: IntegrationTier.CUSTOM,
      type: IntegrationType.CUSTOM_WORKFLOW,
      isCustom: true,
      customSpec: spec,
      status: IntegrationStatus.CONFIGURING
    };

    return new EnhancedIntegration(customConfig);
  }

  static fromMarketplaceApp(app, organizationId, userId) {
    return new EnhancedIntegration({
      name: app.name,
      description: app.description,
      category: app.category,
      type: app.type,
      tier: IntegrationTier.TIER_2,
      marketplaceId: app.id,
      vendor: app.vendor,
      iconUrl: app.iconUrl,
      pricing: new PricingConfig(app.pricing),
      features: app.features,
      compliance: app.compliance,
      organizationId,
      userId
    });
  }
}

/**
 * Integration Validation
 */
export class IntegrationValidator {
  static validateConfiguration(integration) {
    const errors = [];

    if (!integration.name) {
      errors.push('Integration name is required');
    }

    if (!integration.category) {
      errors.push('Integration category is required');
    }

    if (!integration.configuration.baseUrl && !integration.isCustom) {
      errors.push('Base URL is required for API integrations');
    }

    if (integration.authentication.type === AuthenticationType.OAUTH2 && !integration.authentication.credentials.clientId) {
      errors.push('OAuth2 requires client ID');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateTier2Requirements(integration) {
    const warnings = [];

    if (integration.tier === IntegrationTier.TIER_2) {
      if (!integration.monitoring.enabled) {
        warnings.push('Monitoring should be enabled for Tier 2 integrations');
      }

      if (!integration.compliance.length) {
        warnings.push('Compliance frameworks should be specified');
      }

      if (integration.complexity === IntegrationComplexity.VERY_HIGH && !integration.supportLevel.includes('enterprise')) {
        warnings.push('Very high complexity integrations should have enterprise support');
      }
    }

    return {
      warnings
    };
  }
}

export default {
  EnhancedIntegration,
  IntegrationFactory,
  IntegrationValidator,
  IntegrationTier,
  IntegrationCategory,
  IntegrationType,
  AuthenticationType,
  IntegrationStatus,
  IntegrationComplexity,
  PricingModel,
  ComplianceFramework,
  DataSyncDirection
};

console.log('✅ Enhanced Integration Model: Comprehensive Tier 2 marketplace integration support');
console.log('🏗️ Model Features: Enhanced configurations, compliance tracking, performance metrics');
console.log('🔧 Factory Methods: Tier 2 integration creation, custom integration builder');
console.log('✅ Validation: Configuration validation, Tier 2 requirements checking');
console.log('📊 Comprehensive: Authentication, monitoring, workflows, pricing, health tracking');
