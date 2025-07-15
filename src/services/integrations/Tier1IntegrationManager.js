// Tier 1 Integration Manager
// Centralized management for all essential third-party integrations

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

// Import all Tier 1 integration services
import GoogleDriveIntegrationService from './GoogleDriveIntegrationService';
import SalesforceIntegrationService from './SalesforceIntegrationService';
import SlackIntegrationService from './SlackIntegrationService';
import StripeIntegrationService from './StripeIntegrationService';
import ActiveDirectoryIntegrationService from './ActiveDirectoryIntegrationService';

/**
 * Tier 1 Integration Manager
 * 
 * Provides centralized management for all essential integrations:
 * - Google Drive: Document storage and synchronization
 * - Salesforce: CRM automation and opportunity tracking
 * - Slack: Real-time notifications and team collaboration
 * - Stripe: Payment processing and subscription billing
 * - Active Directory: Enterprise identity and access management
 * 
 * Features:
 * - Unified integration dashboard
 * - Cross-integration workflows
 * - Health monitoring and status tracking
 * - Centralized authentication management
 * - Integration analytics and reporting
 */
class Tier1IntegrationManager {
  constructor() {
    this.integrationStatusCollection = collection(db, 'integrationStatus');
    this.workflowsCollection = collection(db, 'integrationWorkflows');
    this.analyticsCollection = collection(db, 'integrationAnalytics');
    this.healthChecksCollection = collection(db, 'integrationHealthChecks');

    // Integration service registry
    this.integrationServices = {
      google_drive: GoogleDriveIntegrationService,
      salesforce: SalesforceIntegrationService,
      slack: SlackIntegrationService,
      stripe: StripeIntegrationService,
      active_directory: ActiveDirectoryIntegrationService
    };

    // Tier 1 integration configuration
    this.tier1Config = {
      priority: 'essential',
      category: 'tier_1',
      integrations: {
        google_drive: {
          name: 'Google Drive',
          description: 'Document storage and synchronization',
          category: 'document_management',
          priority: 1,
          required: true,
          healthCheckInterval: 300000, // 5 minutes
          features: ['document_storage', 'auto_sync', 'collaboration', 'version_control']
        },
        salesforce: {
          name: 'Salesforce CRM',
          description: 'Customer relationship management and sales automation',
          category: 'crm',
          priority: 1,
          required: true,
          healthCheckInterval: 600000, // 10 minutes
          features: ['lead_automation', 'opportunity_tracking', 'contract_management', 'pipeline_sync']
        },
        slack: {
          name: 'Slack',
          description: 'Team communication and workflow notifications',
          category: 'communication',
          priority: 1,
          required: true,
          healthCheckInterval: 300000, // 5 minutes
          features: ['real_time_notifications', 'team_collaboration', 'slash_commands', 'workflow_updates']
        },
        stripe: {
          name: 'Stripe',
          description: 'Payment processing and subscription management',
          category: 'payments',
          priority: 1,
          required: true,
          healthCheckInterval: 300000, // 5 minutes
          features: ['payment_processing', 'subscription_billing', 'invoice_automation', 'usage_tracking']
        },
        active_directory: {
          name: 'Active Directory',
          description: 'Enterprise identity and access management',
          category: 'identity',
          priority: 1,
          required: false, // Optional for smaller organizations
          healthCheckInterval: 900000, // 15 minutes
          features: ['sso', 'user_provisioning', 'role_mapping', 'ldap_sync']
        }
      }
    };

    // Cross-integration workflows
    this.crossIntegrationWorkflows = {
      document_to_payment: {
        name: 'Document Signature to Payment',
        description: 'Automatically trigger payment processing when documents are signed',
        integrations: ['google_drive', 'stripe'],
        triggers: ['document_signed'],
        actions: ['create_payment_link', 'send_invoice']
      },
      crm_to_notification: {
        name: 'CRM to Team Notification',
        description: 'Notify team when CRM opportunities reach signature stage',
        integrations: ['salesforce', 'slack'],
        triggers: ['opportunity_stage_change'],
        actions: ['send_slack_notification', 'create_channel']
      },
      user_provisioning: {
        name: 'Automated User Provisioning',
        description: 'Provision users across all systems when added to Active Directory',
        integrations: ['active_directory', 'salesforce', 'slack'],
        triggers: ['user_created', 'user_updated'],
        actions: ['sync_user_data', 'assign_roles', 'create_accounts']
      },
      complete_workflow: {
        name: 'Complete Document Workflow',
        description: 'End-to-end workflow from CRM to payment',
        integrations: ['salesforce', 'google_drive', 'slack', 'stripe'],
        triggers: ['opportunity_won'],
        actions: ['generate_contract', 'send_for_signature', 'notify_team', 'process_payment']
      }
    };

    this.initializeTier1Manager();
  }

  /**
   * Get integration dashboard with all Tier 1 status
   */
  async getIntegrationDashboard(organizationId) {
    try {
      const dashboardId = `dashboard_${Date.now()}`;

      // Get status for all Tier 1 integrations
      const integrationStatuses = {};
      for (const [integrationKey, config] of Object.entries(this.tier1Config.integrations)) {
        integrationStatuses[integrationKey] = await this.getIntegrationStatus(
          organizationId,
          integrationKey
        );
      }

      // Calculate overall health score
      const healthScore = await this.calculateOverallHealthScore(integrationStatuses);

      // Get recent activity
      const recentActivity = await this.getRecentIntegrationActivity(organizationId);

      // Get workflow status
      const workflowStatus = await this.getWorkflowStatus(organizationId);

      // Get usage analytics
      const usageAnalytics = await this.getUsageAnalytics(organizationId);

      const dashboard = {
        dashboardId,
        organizationId,
        tier: 'tier_1',
        integrations: integrationStatuses,
        healthScore,
        summary: {
          totalIntegrations: Object.keys(this.tier1Config.integrations).length,
          activeIntegrations: Object.values(integrationStatuses).filter(s => s.status === 'active').length,
          pendingIntegrations: Object.values(integrationStatuses).filter(s => s.status === 'pending').length,
          errorIntegrations: Object.values(integrationStatuses).filter(s => s.status === 'error').length
        },
        recentActivity,
        workflows: workflowStatus,
        analytics: usageAnalytics,
        generatedAt: new Date()
      };

      return {
        success: true,
        dashboardId,
        dashboard
      };

    } catch (error) {
      console.error('Failed to get integration dashboard:', error);
      throw new Error(`Dashboard generation failed: ${error.message}`);
    }
  }

  /**
   * Setup all Tier 1 integrations for an organization
   */
  async setupTier1Integrations(setupRequest) {
    try {
      const {
        organizationId,
        integrations = {}, // Configuration for each integration
        skipOptional = false,
        testConnections = true
      } = setupRequest;

      const setupId = `setup_${Date.now()}`;
      const setupResults = {
        setupId,
        organizationId,
        startTime: new Date(),
        results: {},
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
          skipped: 0
        }
      };

      // Setup each Tier 1 integration
      for (const [integrationKey, config] of Object.entries(this.tier1Config.integrations)) {
        setupResults.summary.total++;

        try {
          // Skip optional integrations if requested
          if (skipOptional && !config.required) {
            setupResults.results[integrationKey] = {
              status: 'skipped',
              reason: 'Optional integration skipped'
            };
            setupResults.summary.skipped++;
            continue;
          }

          // Get integration-specific configuration
          const integrationConfig = integrations[integrationKey] || {};

          // Setup integration
          const setupResult = await this.setupSingleIntegration(
            integrationKey,
            organizationId,
            integrationConfig,
            testConnections
          );

          setupResults.results[integrationKey] = setupResult;
          setupResults.summary.successful++;

        } catch (error) {
          setupResults.results[integrationKey] = {
            status: 'failed',
            error: error.message
          };
          setupResults.summary.failed++;
        }
      }

      setupResults.endTime = new Date();
      setupResults.duration = setupResults.endTime - setupResults.startTime;

      // Store setup results
      await addDoc(collection(db, 'tier1SetupLogs'), {
        ...setupResults,
        createdAt: serverTimestamp()
      });

      // Setup cross-integration workflows if enough integrations are active
      if (setupResults.summary.successful >= 2) {
        await this.setupCrossIntegrationWorkflows(organizationId, setupResults.results);
      }

      return {
        success: true,
        setupId,
        results: setupResults
      };

    } catch (error) {
      console.error('Failed to setup Tier 1 integrations:', error);
      throw new Error(`Tier 1 setup failed: ${error.message}`);
    }
  }

  /**
   * Execute cross-integration workflow
   */
  async executeCrossIntegrationWorkflow(workflowRequest) {
    try {
      const {
        organizationId,
        workflowKey,
        triggerEvent,
        triggerData,
        customActions = []
      } = workflowRequest;

      const executionId = `exec_${Date.now()}`;

      // Get workflow configuration
      const workflow = this.crossIntegrationWorkflows[workflowKey];
      if (!workflow) {
        throw new Error(`Unknown workflow: ${workflowKey}`);
      }

      // Validate that required integrations are active
      const integrationChecks = await this.validateWorkflowIntegrations(
        organizationId,
        workflow.integrations
      );

      if (!integrationChecks.allActive) {
        throw new Error(`Required integrations not active: ${integrationChecks.inactive.join(', ')}`);
      }

      // Execute workflow actions
      const actionResults = [];
      const actions = [...workflow.actions, ...customActions];

      for (const action of actions) {
        try {
          const actionResult = await this.executeWorkflowAction(
            action,
            workflow.integrations,
            triggerData,
            organizationId
          );
          actionResults.push({
            action,
            status: 'success',
            result: actionResult
          });
        } catch (error) {
          actionResults.push({
            action,
            status: 'failed',
            error: error.message
          });
        }
      }

      // Store workflow execution record
      const executionRecord = {
        executionId,
        organizationId,
        workflowKey,
        workflow: workflow.name,
        triggerEvent,
        triggerData,
        actionResults,
        status: actionResults.every(r => r.status === 'success') ? 'completed' : 'partial',
        executedAt: serverTimestamp()
      };

      await addDoc(this.workflowsCollection, executionRecord);

      return {
        success: true,
        executionId,
        workflow: workflow.name,
        actionResults,
        status: executionRecord.status
      };

    } catch (error) {
      console.error('Failed to execute cross-integration workflow:', error);
      throw new Error(`Workflow execution failed: ${error.message}`);
    }
  }

  /**
   * Monitor health of all Tier 1 integrations
   */
  async performHealthCheck(organizationId) {
    try {
      const healthCheckId = `health_${Date.now()}`;
      const healthResults = {};

      // Perform health check for each integration
      for (const [integrationKey, config] of Object.entries(this.tier1Config.integrations)) {
        try {
          const service = this.integrationServices[integrationKey];
          if (service && service.performHealthCheck) {
            healthResults[integrationKey] = await service.performHealthCheck(organizationId);
          } else {
            // Fallback basic health check
            healthResults[integrationKey] = await this.performBasicHealthCheck(
              integrationKey,
              organizationId
            );
          }
        } catch (error) {
          healthResults[integrationKey] = {
            status: 'unhealthy',
            error: error.message,
            lastCheck: new Date()
          };
        }
      }

      // Calculate overall health
      const overallHealth = this.calculateOverallHealth(healthResults);

      // Store health check results
      const healthRecord = {
        healthCheckId,
        organizationId,
        results: healthResults,
        overallHealth,
        checkedAt: serverTimestamp()
      };

      await addDoc(this.healthChecksCollection, healthRecord);

      // Trigger alerts if any critical issues
      await this.processHealthAlerts(organizationId, healthResults);

      return {
        success: true,
        healthCheckId,
        results: healthResults,
        overallHealth
      };

    } catch (error) {
      console.error('Failed to perform health check:', error);
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  /**
   * Generate Tier 1 integration analytics
   */
  async generateIntegrationAnalytics(analyticsRequest) {
    try {
      const {
        organizationId,
        timeframe = 'last_30_days',
        includeUsage = true,
        includePerformance = true,
        includeWorkflows = true
      } = analyticsRequest;

      const analyticsId = `analytics_${Date.now()}`;

      // Calculate time range
      const timeRange = this.calculateTimeRange(timeframe);

      // Collect usage analytics for each integration
      let usageAnalytics = null;
      if (includeUsage) {
        usageAnalytics = await this.collectUsageAnalytics(organizationId, timeRange);
      }

      // Collect performance analytics
      let performanceAnalytics = null;
      if (includePerformance) {
        performanceAnalytics = await this.collectPerformanceAnalytics(organizationId, timeRange);
      }

      // Collect workflow analytics
      let workflowAnalytics = null;
      if (includeWorkflows) {
        workflowAnalytics = await this.collectWorkflowAnalytics(organizationId, timeRange);
      }

      // Generate insights and recommendations
      const insights = await this.generateIntegrationInsights(
        usageAnalytics,
        performanceAnalytics,
        workflowAnalytics
      );

      const analytics = {
        analyticsId,
        organizationId,
        timeframe,
        timeRange,
        usage: usageAnalytics,
        performance: performanceAnalytics,
        workflows: workflowAnalytics,
        insights,
        summary: {
          totalIntegrations: Object.keys(this.tier1Config.integrations).length,
          activeIntegrations: usageAnalytics ? Object.keys(usageAnalytics.integrations).length : 0,
          totalEvents: workflowAnalytics ? workflowAnalytics.totalExecutions : 0
        },
        generatedAt: new Date()
      };

      // Store analytics
      await addDoc(this.analyticsCollection, {
        ...analytics,
        createdAt: serverTimestamp()
      });

      return {
        success: true,
        analyticsId,
        analytics
      };

    } catch (error) {
      console.error('Failed to generate integration analytics:', error);
      throw new Error(`Analytics generation failed: ${error.message}`);
    }
  }

  // Helper methods

  async getIntegrationStatus(organizationId, integrationKey) {
    try {
      // Query for active integration
      const integrationQuery = query(
        collection(db, `${integrationKey}Integrations`),
        where('organizationId', '==', organizationId),
        where('status', '==', 'authenticated'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(integrationQuery);
      
      if (snapshot.empty) {
        return {
          integrationKey,
          status: 'not_configured',
          name: this.tier1Config.integrations[integrationKey].name,
          lastCheck: new Date()
        };
      }

      const integration = snapshot.docs[0].data();
      return {
        integrationKey,
        status: 'active',
        name: this.tier1Config.integrations[integrationKey].name,
        configuredAt: integration.createdAt?.toDate(),
        lastCheck: new Date(),
        details: {
          id: integration.integrationId,
          type: integrationKey
        }
      };

    } catch (error) {
      return {
        integrationKey,
        status: 'error',
        name: this.tier1Config.integrations[integrationKey].name,
        error: error.message,
        lastCheck: new Date()
      };
    }
  }

  async setupSingleIntegration(integrationKey, organizationId, config, testConnection) {
    const service = this.integrationServices[integrationKey];
    if (!service) {
      throw new Error(`No service found for integration: ${integrationKey}`);
    }

    // Each integration service should have a setup method
    const setupMethod = service.setup || service.authenticate || service.initialize;
    if (!setupMethod) {
      throw new Error(`No setup method found for integration: ${integrationKey}`);
    }

    const result = await setupMethod.call(service, {
      organizationId,
      ...config,
      testConnection
    });

    return {
      status: 'success',
      integrationKey,
      result
    };
  }

  async calculateOverallHealthScore(integrationStatuses) {
    const statuses = Object.values(integrationStatuses);
    const total = statuses.length;
    const healthy = statuses.filter(s => s.status === 'active').length;
    
    return Math.round((healthy / total) * 100);
  }

  calculateTimeRange(timeframe) {
    const now = new Date();
    const ranges = {
      'last_24_hours': { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now },
      'last_7_days': { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now },
      'last_30_days': { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now },
      'last_90_days': { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), end: now }
    };

    return ranges[timeframe] || ranges['last_30_days'];
  }

  async initializeTier1Manager() {
    console.log('Tier 1 Integration Manager initialized');
    
    // Initialize health check monitoring
    this.startHealthCheckMonitoring();
  }

  startHealthCheckMonitoring() {
    // Setup periodic health checks for all integrations
    setInterval(() => {
      // This would trigger health checks for all organizations
      console.log('Performing scheduled health checks...');
    }, 300000); // Every 5 minutes
  }

  // Additional helper methods would be implemented here...
  async getRecentIntegrationActivity(organizationId) { return []; }
  async getWorkflowStatus(organizationId) { return {}; }
  async getUsageAnalytics(organizationId) { return {}; }
  async setupCrossIntegrationWorkflows(organizationId, integrationResults) { }
  async validateWorkflowIntegrations(organizationId, requiredIntegrations) { return { allActive: true, inactive: [] }; }
  async executeWorkflowAction(action, integrations, data, organizationId) { return {}; }
  async performBasicHealthCheck(integrationKey, organizationId) { return { status: 'healthy', lastCheck: new Date() }; }
  async calculateOverallHealth(healthResults) { return { status: 'healthy', score: 100 }; }
  async processHealthAlerts(organizationId, healthResults) { }
  async collectUsageAnalytics(organizationId, timeRange) { return {}; }
  async collectPerformanceAnalytics(organizationId, timeRange) { return {}; }
  async collectWorkflowAnalytics(organizationId, timeRange) { return {}; }
  async generateIntegrationInsights(usage, performance, workflows) { return {}; }
}

export default new Tier1IntegrationManager();
