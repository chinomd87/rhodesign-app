// API Gateway and Management Service
// Advanced API management, rate limiting, analytics, and developer tools

import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc,
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
 * API Gateway and Management Service
 * 
 * Provides comprehensive API management and developer experience:
 * - API gateway with intelligent routing and load balancing
 * - Advanced rate limiting and throttling
 * - API analytics and monitoring
 * - Developer portal and documentation
 * - API versioning and lifecycle management
 * - Security policies and authentication
 * - API marketplace and monetization
 * - Webhook management and delivery
 * - SDK generation and maintenance
 * - Integration testing and validation
 */
class APIGatewayService {
  constructor() {
    this.gatewayConfigCollection = collection(db, 'apiGatewayConfig');
    this.apiKeysCollection = collection(db, 'apiKeys');
    this.rateLimitsCollection = collection(db, 'rateLimits');
    this.apiAnalyticsCollection = collection(db, 'apiAnalytics');
    this.developerPortalCollection = collection(db, 'developerPortal');
    this.webhooksCollection = collection(db, 'webhooks');
    this.apiVersionsCollection = collection(db, 'apiVersions');
    this.integrationTestsCollection = collection(db, 'integrationTests');

    // API Gateway configuration
    this.gatewayConfig = {
      baseUrl: 'https://api.rhodesign.com',
      version: 'v1',
      protocols: ['https'],
      formats: ['json', 'xml'],
      authentication: ['api_key', 'oauth2', 'jwt'],
      rateLimit: {
        default: {
          requests: 1000,
          window: '1h',
          burst: 100
        },
        premium: {
          requests: 10000,
          window: '1h',
          burst: 500
        },
        enterprise: {
          requests: 100000,
          window: '1h',
          burst: 2000
        }
      },
      monitoring: {
        enabled: true,
        metrics: ['latency', 'throughput', 'errors', 'availability'],
        alerting: true,
        logging: 'detailed'
      }
    };

    // API endpoints and their configurations
    this.apiEndpoints = {
      // Document Management
      '/documents': {
        methods: ['GET', 'POST'],
        authentication: 'required',
        rateLimit: 'default',
        description: 'Document management operations',
        parameters: {
          'GET': ['limit', 'offset', 'status', 'type'],
          'POST': ['document', 'metadata', 'options']
        },
        responses: {
          '200': 'Success',
          '400': 'Bad Request',
          '401': 'Unauthorized',
          '429': 'Rate Limited',
          '500': 'Internal Error'
        }
      },
      '/documents/{id}': {
        methods: ['GET', 'PUT', 'DELETE'],
        authentication: 'required',
        rateLimit: 'default',
        description: 'Individual document operations',
        parameters: {
          'GET': ['include_content'],
          'PUT': ['document', 'metadata'],
          'DELETE': ['force']
        }
      },
      '/signatures': {
        methods: ['GET', 'POST'],
        authentication: 'required',
        rateLimit: 'premium',
        description: 'Signature operations',
        parameters: {
          'GET': ['document_id', 'status', 'type'],
          'POST': ['document_id', 'signer', 'type', 'options']
        }
      },
      '/signatures/{id}': {
        methods: ['GET', 'PUT'],
        authentication: 'required',
        rateLimit: 'premium',
        description: 'Individual signature operations'
      },
      '/eidas/qualified-signatures': {
        methods: ['POST', 'GET'],
        authentication: 'required',
        rateLimit: 'enterprise',
        description: 'eIDAS qualified signature operations',
        compliance: ['eIDAS', 'GDPR'],
        security: 'enhanced'
      },
      '/analytics': {
        methods: ['GET'],
        authentication: 'required',
        rateLimit: 'default',
        description: 'Analytics and reporting',
        parameters: {
          'GET': ['timeframe', 'metrics', 'filters']
        }
      },
      '/webhooks': {
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        authentication: 'required',
        rateLimit: 'default',
        description: 'Webhook management'
      }
    };

    // Rate limiting policies
    this.rateLimitPolicies = {
      by_api_key: {
        identifier: 'api_key',
        limits: {
          requests_per_minute: 100,
          requests_per_hour: 1000,
          requests_per_day: 10000
        },
        burst_protection: true,
        sliding_window: true
      },
      by_ip: {
        identifier: 'ip_address',
        limits: {
          requests_per_minute: 20,
          requests_per_hour: 100
        },
        burst_protection: true
      },
      by_user: {
        identifier: 'user_id',
        limits: {
          requests_per_minute: 200,
          requests_per_hour: 2000,
          requests_per_day: 20000
        },
        burst_protection: false
      },
      by_endpoint: {
        identifier: 'endpoint',
        custom_limits: {
          '/eidas/qualified-signatures': {
            requests_per_minute: 10,
            requests_per_hour: 100
          },
          '/analytics': {
            requests_per_minute: 50,
            requests_per_hour: 500
          }
        }
      }
    };

    // API tiers and access levels
    this.apiTiers = {
      free: {
        name: 'Free Tier',
        description: 'Basic API access for development and testing',
        limits: {
          requests_per_month: 10000,
          rate_limit: 'default',
          features: ['documents', 'basic_signatures'],
          support: 'community'
        },
        cost: 0
      },
      developer: {
        name: 'Developer Tier',
        description: 'Enhanced API access for small applications',
        limits: {
          requests_per_month: 100000,
          rate_limit: 'premium',
          features: ['documents', 'signatures', 'webhooks', 'analytics'],
          support: 'email'
        },
        cost: 49
      },
      business: {
        name: 'Business Tier',
        description: 'Professional API access for production applications',
        limits: {
          requests_per_month: 1000000,
          rate_limit: 'premium',
          features: ['all_endpoints', 'priority_support', 'sla'],
          support: 'priority'
        },
        cost: 199
      },
      enterprise: {
        name: 'Enterprise Tier',
        description: 'Unlimited API access with dedicated support',
        limits: {
          requests_per_month: 'unlimited',
          rate_limit: 'enterprise',
          features: ['all_endpoints', 'custom_endpoints', 'dedicated_support', 'sla'],
          support: 'dedicated'
        },
        cost: 'custom'
      }
    };

    this.initializeAPIGateway();
  }

  /**
   * Create API key and configure access
   */
  async createAPIKey(keyRequest) {
    try {
      const {
        userId,
        organizationId,
        tier = 'free',
        name,
        description = '',
        scopes = [],
        environment = 'production', // 'development', 'staging', 'production'
        expirationDate = null,
        ipWhitelist = [],
        rateLimitOverrides = {}
      } = keyRequest;

      const apiKeyId = `ak_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Validate tier and permissions
      await this.validateAPIKeyRequest(keyRequest);

      // Generate secure API key
      const apiKey = await this.generateSecureAPIKey(apiKeyId);

      // Configure rate limits based on tier
      const rateLimits = await this.configureAPIKeyRateLimits(tier, rateLimitOverrides);

      // Setup monitoring and analytics
      const monitoringConfig = await this.setupAPIKeyMonitoring(apiKeyId, tier);

      // Create API key configuration
      const apiKeyConfig = {
        apiKeyId,
        userId,
        organizationId,
        tier,
        name,
        description,
        environment,
        apiKey: apiKey.hash, // Store hash, not actual key
        keyPrefix: apiKey.prefix,
        scopes,
        rateLimits,
        ipWhitelist,
        monitoring: monitoringConfig,
        status: 'active',
        usage: {
          requestsThisMonth: 0,
          lastUsed: null,
          totalRequests: 0
        },
        security: {
          lastRotated: new Date(),
          failedAttempts: 0,
          lockoutUntil: null
        },
        expirationDate,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store API key configuration
      await addDoc(this.apiKeysCollection, {
        ...apiKeyConfig,
        createdAt: serverTimestamp()
      });

      // Setup usage tracking
      await this.setupAPIKeyUsageTracking(apiKeyId);

      // Initialize analytics
      await this.initializeAPIKeyAnalytics(apiKeyId, tier);

      return {
        success: true,
        apiKeyId,
        apiKey: apiKey.key, // Return actual key only on creation
        keyPrefix: apiKey.prefix,
        configuration: {
          tier,
          scopes,
          rateLimits,
          environment
        },
        documentation: `https://docs.rhodesign.com/api/keys/${apiKeyId}`,
        monitoring: `https://dashboard.rhodesign.com/api/keys/${apiKeyId}`
      };

    } catch (error) {
      console.error('Failed to create API key:', error);
      throw new Error(`API key creation failed: ${error.message}`);
    }
  }

  /**
   * Process API request with rate limiting and analytics
   */
  async processAPIRequest(requestData) {
    try {
      const {
        apiKey,
        endpoint,
        method,
        parameters = {},
        headers = {},
        body = null,
        clientIP,
        userAgent
      } = requestData;

      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const startTime = Date.now();

      // Validate and authenticate API key
      const keyValidation = await this.validateAPIKey(apiKey);
      if (!keyValidation.valid) {
        throw new Error(`Invalid API key: ${keyValidation.reason}`);
      }

      const apiKeyConfig = keyValidation.config;

      // Check rate limits
      const rateLimitCheck = await this.checkRateLimits(apiKeyConfig, endpoint, clientIP);
      if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit exceeded: ${rateLimitCheck.reason}`);
      }

      // Validate endpoint and method
      const endpointValidation = await this.validateEndpoint(endpoint, method, apiKeyConfig.scopes);
      if (!endpointValidation.valid) {
        throw new Error(`Endpoint not accessible: ${endpointValidation.reason}`);
      }

      // Check IP whitelist if configured
      if (apiKeyConfig.ipWhitelist.length > 0) {
        const ipCheck = await this.checkIPWhitelist(clientIP, apiKeyConfig.ipWhitelist);
        if (!ipCheck.allowed) {
          throw new Error('IP address not whitelisted');
        }
      }

      // Process the actual API request
      const apiResponse = await this.executeAPIRequest({
        apiKeyConfig,
        endpoint,
        method,
        parameters,
        headers,
        body,
        requestId
      });

      const processingTime = Date.now() - startTime;

      // Update rate limit counters
      await this.updateRateLimitCounters(apiKeyConfig, endpoint);

      // Update usage statistics
      await this.updateUsageStatistics(apiKeyConfig.apiKeyId, {
        endpoint,
        method,
        processingTime,
        responseStatus: apiResponse.status,
        requestId
      });

      // Log request for analytics
      await this.logAPIRequest({
        requestId,
        apiKeyId: apiKeyConfig.apiKeyId,
        endpoint,
        method,
        processingTime,
        responseStatus: apiResponse.status,
        responseSize: apiResponse.size,
        clientIP,
        userAgent,
        timestamp: new Date()
      });

      return {
        success: true,
        requestId,
        response: apiResponse.data,
        metadata: {
          processingTime,
          rateLimitRemaining: rateLimitCheck.remaining,
          apiVersion: this.gatewayConfig.version,
          requestId
        }
      };

    } catch (error) {
      console.error('API request processing failed:', error);
      
      // Log error for analytics
      await this.logAPIError({
        requestId: requestData.requestId || 'unknown',
        error: error.message,
        endpoint: requestData.endpoint,
        method: requestData.method,
        timestamp: new Date()
      });

      return {
        success: false,
        error: error.message,
        requestId: requestData.requestId || 'unknown'
      };
    }
  }

  /**
   * Generate comprehensive API analytics
   */
  async generateAPIAnalytics(analyticsRequest) {
    try {
      const {
        timeframe = 'last_30_days',
        apiKeyId = null,
        organizationId = null,
        endpoints = [],
        metrics = ['requests', 'latency', 'errors', 'rate_limits'],
        granularity = 'daily' // 'hourly', 'daily', 'weekly', 'monthly'
      } = analyticsRequest;

      const analyticsId = `analytics_${Date.now()}`;

      // Calculate time range
      const timeRange = this.calculateTimeRange(timeframe);

      // Collect request metrics
      let requestMetrics = null;
      if (metrics.includes('requests')) {
        requestMetrics = await this.collectRequestMetrics(
          timeRange,
          apiKeyId,
          organizationId,
          endpoints,
          granularity
        );
      }

      // Collect latency metrics
      let latencyMetrics = null;
      if (metrics.includes('latency')) {
        latencyMetrics = await this.collectLatencyMetrics(
          timeRange,
          apiKeyId,
          organizationId,
          endpoints,
          granularity
        );
      }

      // Collect error metrics
      let errorMetrics = null;
      if (metrics.includes('errors')) {
        errorMetrics = await this.collectErrorMetrics(
          timeRange,
          apiKeyId,
          organizationId,
          endpoints,
          granularity
        );
      }

      // Collect rate limit metrics
      let rateLimitMetrics = null;
      if (metrics.includes('rate_limits')) {
        rateLimitMetrics = await this.collectRateLimitMetrics(
          timeRange,
          apiKeyId,
          organizationId,
          granularity
        );
      }

      // Generate endpoint analysis
      const endpointAnalysis = await this.analyzeEndpointUsage(
        timeRange,
        apiKeyId,
        organizationId,
        endpoints
      );

      // Calculate performance insights
      const performanceInsights = await this.generatePerformanceInsights(
        requestMetrics,
        latencyMetrics,
        errorMetrics,
        endpointAnalysis
      );

      // Generate recommendations
      const recommendations = await this.generateAPIRecommendations(
        requestMetrics,
        latencyMetrics,
        errorMetrics,
        rateLimitMetrics,
        endpointAnalysis
      );

      const analytics = {
        analyticsId,
        timeframe,
        timeRange,
        granularity,
        filters: {
          apiKeyId,
          organizationId,
          endpoints
        },
        metrics: {
          requests: requestMetrics,
          latency: latencyMetrics,
          errors: errorMetrics,
          rateLimits: rateLimitMetrics
        },
        analysis: {
          endpoints: endpointAnalysis,
          performance: performanceInsights,
          recommendations
        },
        summary: await this.generateAnalyticsSummary(
          requestMetrics,
          latencyMetrics,
          errorMetrics,
          endpointAnalysis
        ),
        generatedAt: new Date()
      };

      // Store analytics result
      await addDoc(this.apiAnalyticsCollection, {
        ...analytics,
        createdAt: serverTimestamp()
      });

      return {
        success: true,
        analyticsId,
        analytics
      };

    } catch (error) {
      console.error('Failed to generate API analytics:', error);
      throw new Error(`API analytics generation failed: ${error.message}`);
    }
  }

  /**
   * Setup webhook configuration and delivery
   */
  async setupWebhook(webhookRequest) {
    try {
      const {
        apiKeyId,
        url,
        events = [],
        secret = null,
        headers = {},
        retryPolicy = 'exponential',
        maxRetries = 3,
        timeout = 30000,
        active = true,
        description = ''
      } = webhookRequest;

      const webhookId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

      // Validate webhook configuration
      await this.validateWebhookConfig(webhookRequest);

      // Validate API key access
      const apiKeyConfig = await this.validateAPIKey(apiKeyRequest.apiKey);
      if (!apiKeyConfig.valid) {
        throw new Error('Invalid API key for webhook setup');
      }

      // Generate webhook secret if not provided
      const webhookSecret = secret || await this.generateWebhookSecret();

      // Validate webhook URL
      const urlValidation = await this.validateWebhookURL(url);
      if (!urlValidation.valid) {
        throw new Error(`Invalid webhook URL: ${urlValidation.reason}`);
      }

      // Configure delivery settings
      const deliveryConfig = {
        retryPolicy,
        maxRetries,
        timeout,
        backoffMultiplier: 2,
        maxBackoff: 300000 // 5 minutes
      };

      // Setup monitoring
      const monitoringConfig = await this.setupWebhookMonitoring(webhookId);

      const webhook = {
        webhookId,
        apiKeyId,
        url,
        events,
        secret: await this.hashWebhookSecret(webhookSecret),
        headers,
        delivery: deliveryConfig,
        active,
        description,
        monitoring: monitoringConfig,
        statistics: {
          totalDeliveries: 0,
          successfulDeliveries: 0,
          failedDeliveries: 0,
          lastDelivery: null,
          lastSuccess: null,
          lastFailure: null
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store webhook configuration
      await addDoc(this.webhooksCollection, {
        ...webhook,
        createdAt: serverTimestamp()
      });

      // Test webhook delivery
      const testResult = await this.testWebhookDelivery(webhookId, url, webhookSecret);

      return {
        success: true,
        webhookId,
        url,
        events,
        secret: webhookSecret, // Return secret only on creation
        testResult,
        monitoringUrl: `https://dashboard.rhodesign.com/webhooks/${webhookId}`
      };

    } catch (error) {
      console.error('Failed to setup webhook:', error);
      throw new Error(`Webhook setup failed: ${error.message}`);
    }
  }

  // Helper methods for API Gateway operations

  async validateAPIKeyRequest(request) {
    const tierConfig = this.apiTiers[request.tier];
    if (!tierConfig) {
      throw new Error(`Invalid API tier: ${request.tier}`);
    }

    if (!request.name || request.name.length < 3) {
      throw new Error('API key name must be at least 3 characters');
    }

    if (request.scopes.length === 0) {
      throw new Error('At least one scope must be specified');
    }
  }

  async generateSecureAPIKey(keyId) {
    const keyBytes = Math.random().toString(36).substr(2, 32);
    const prefix = keyId.substr(0, 8);
    const key = `${prefix}_${keyBytes}`;
    const hash = await this.hashAPIKey(key);

    return { key, prefix, hash };
  }

  async hashAPIKey(key) {
    // Implementation would use secure hashing
    return `hashed_${key}`;
  }

  async configureAPIKeyRateLimits(tier, overrides) {
    const tierLimits = this.gatewayConfig.rateLimit[tier] || this.gatewayConfig.rateLimit.default;
    
    return {
      ...tierLimits,
      ...overrides,
      tier
    };
  }

  async validateAPIKey(apiKey) {
    // Mock validation - would check against database
    return {
      valid: true,
      config: {
        apiKeyId: 'mock_key_id',
        tier: 'developer',
        scopes: ['documents', 'signatures'],
        rateLimits: this.gatewayConfig.rateLimit.default,
        ipWhitelist: []
      }
    };
  }

  async checkRateLimits(apiKeyConfig, endpoint, clientIP) {
    // Mock rate limit check - would implement actual rate limiting
    return {
      allowed: true,
      remaining: 995,
      resetTime: new Date(Date.now() + 3600000)
    };
  }

  async validateEndpoint(endpoint, method, scopes) {
    const endpointConfig = this.apiEndpoints[endpoint];
    if (!endpointConfig) {
      return { valid: false, reason: 'Endpoint not found' };
    }

    if (!endpointConfig.methods.includes(method)) {
      return { valid: false, reason: 'Method not allowed' };
    }

    // Check scope requirements
    // Implementation would validate scopes

    return { valid: true };
  }

  calculateTimeRange(timeframe) {
    const now = new Date();
    const ranges = {
      'last_24_hours': { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now },
      'last_7_days': { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now },
      'last_30_days': { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now },
      'last_90_days': { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), end: now }
    };

    return ranges[timeframe] || ranges['last_7_days'];
  }

  async initializeAPIGateway() {
    console.log('API Gateway Service initialized');
    
    // Initialize gateway configuration
    await this.initializeGatewayConfig();
    
    // Setup monitoring and alerting
    this.setupGatewayMonitoring();
  }

  async initializeGatewayConfig() {
    const configDoc = await getDoc(doc(this.gatewayConfigCollection, 'main'));
    if (!configDoc.exists()) {
      await setDoc(doc(this.gatewayConfigCollection, 'main'), {
        ...this.gatewayConfig,
        createdAt: serverTimestamp()
      });
    }
  }

  setupGatewayMonitoring() {
    // Implementation would setup comprehensive monitoring
    console.log('API Gateway monitoring configured');
  }

  // Additional helper methods would be implemented here...
  async setupAPIKeyMonitoring(keyId, tier) { return {}; }
  async setupAPIKeyUsageTracking(keyId) { }
  async initializeAPIKeyAnalytics(keyId, tier) { }
  async checkIPWhitelist(ip, whitelist) { return { allowed: true }; }
  async executeAPIRequest(params) { return { status: 200, data: {}, size: 1024 }; }
  async updateRateLimitCounters(config, endpoint) { }
  async updateUsageStatistics(keyId, stats) { }
  async logAPIRequest(data) { }
  async logAPIError(data) { }
  async collectRequestMetrics(timeRange, keyId, orgId, endpoints, granularity) { return {}; }
  async collectLatencyMetrics(timeRange, keyId, orgId, endpoints, granularity) { return {}; }
  async collectErrorMetrics(timeRange, keyId, orgId, endpoints, granularity) { return {}; }
  async collectRateLimitMetrics(timeRange, keyId, orgId, granularity) { return {}; }
  async analyzeEndpointUsage(timeRange, keyId, orgId, endpoints) { return {}; }
  async generatePerformanceInsights(requests, latency, errors, endpoints) { return {}; }
  async generateAPIRecommendations(requests, latency, errors, rateLimit, endpoints) { return []; }
  async generateAnalyticsSummary(requests, latency, errors, endpoints) { return {}; }
  async validateWebhookConfig(config) { }
  async generateWebhookSecret() { return Math.random().toString(36).substr(2, 32); }
  async validateWebhookURL(url) { return { valid: true }; }
  async hashWebhookSecret(secret) { return `hashed_${secret}`; }
  async setupWebhookMonitoring(webhookId) { return {}; }
  async testWebhookDelivery(webhookId, url, secret) { return { success: true }; }
}

export default new APIGatewayService();
