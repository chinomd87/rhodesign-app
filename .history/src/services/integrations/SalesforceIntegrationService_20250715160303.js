// Salesforce CRM Integration Service
// Lead automation, opportunity tracking, and contract management

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
 * Salesforce CRM Integration Service
 * 
 * Provides comprehensive Salesforce integration:
 * - OAuth2 authentication with Salesforce
 * - Lead and opportunity automation
 * - Contract lifecycle management
 * - Document synchronization
 * - Workflow triggers and actions
 * - Real-time data sync
 * - Custom field mapping
 */
class SalesforceIntegrationService {
  constructor() {
    this.integrationsCollection = collection(db, 'salesforceIntegrations');
    this.opportunitiesCollection = collection(db, 'opportunities');
    this.contractsCollection = collection(db, 'contracts');
    this.syncLogsCollection = collection(db, 'salesforceSyncLogs');

    // Salesforce API configuration
    this.salesforceConfig = {
      clientId: process.env.REACT_APP_SALESFORCE_CLIENT_ID,
      clientSecret: process.env.REACT_APP_SALESFORCE_CLIENT_SECRET,
      redirectUri: `${window.location.origin}/auth/salesforce/callback`,
      loginUrl: 'https://login.salesforce.com',
      apiVersion: 'v58.0',
      scopes: ['api', 'refresh_token', 'offline_access']
    };

    // Salesforce object mappings
    this.objectMappings = {
      opportunity: {
        salesforceObject: 'Opportunity',
        rhodesignFields: {
          'Id': 'salesforceId',
          'Name': 'name',
          'Amount': 'value',
          'StageName': 'stage',
          'CloseDate': 'closeDate',
          'AccountId': 'accountId',
          'OwnerId': 'ownerId',
          'Description': 'description',
          'Probability': 'probability'
        },
        customFields: {
          'RhodeSign_Document_Id__c': 'documentId',
          'RhodeSign_Signature_Status__c': 'signatureStatus',
          'RhodeSign_Contract_Sent__c': 'contractSent',
          'RhodeSign_Contract_Signed__c': 'contractSigned'
        }
      },
      account: {
        salesforceObject: 'Account',
        rhodesignFields: {
          'Id': 'salesforceId',
          'Name': 'name',
          'Type': 'type',
          'Industry': 'industry',
          'Phone': 'phone',
          'Website': 'website',
          'BillingAddress': 'billingAddress'
        }
      },
      contact: {
        salesforceObject: 'Contact',
        rhodesignFields: {
          'Id': 'salesforceId',
          'FirstName': 'firstName',
          'LastName': 'lastName',
          'Email': 'email',
          'Phone': 'phone',
          'Title': 'title',
          'AccountId': 'accountId'
        }
      },
      contract: {
        salesforceObject: 'Contract',
        rhodesignFields: {
          'Id': 'salesforceId',
          'ContractNumber': 'contractNumber',
          'AccountId': 'accountId',
          'Status': 'status',
          'StartDate': 'startDate',
          'EndDate': 'endDate',
          'ContractTerm': 'term'
        },
        customFields: {
          'RhodeSign_Document_Id__c': 'documentId',
          'RhodeSign_Signature_Status__c': 'signatureStatus',
          'RhodeSign_Signed_Date__c': 'signedDate'
        }
      }
    };

    this.initializeSalesforceIntegration();
  }

  /**
   * Authenticate with Salesforce
   */
  async authenticateWithSalesforce(userId, organizationId, instanceUrl = null) {
    try {
      const integrationId = `sf_${Date.now()}`;

      // Build Salesforce OAuth URL
      const authUrl = this.buildSalesforceAuthUrl(integrationId, instanceUrl);

      // Store pending authentication
      await addDoc(this.integrationsCollection, {
        integrationId,
        userId,
        organizationId,
        provider: 'salesforce',
        status: 'pending_auth',
        authUrl,
        instanceUrl,
        createdAt: serverTimestamp()
      });

      return {
        success: true,
        integrationId,
        authUrl,
        message: 'Please complete Salesforce authentication'
      };

    } catch (error) {
      console.error('Failed to initiate Salesforce authentication:', error);
      throw new Error(`Salesforce authentication failed: ${error.message}`);
    }
  }

  /**
   * Complete OAuth2 authentication
   */
  async completeAuthentication(integrationId, authCode, instanceUrl) {
    try {
      // Exchange auth code for access token
      const tokenResponse = await this.exchangeCodeForTokens(authCode, instanceUrl);

      // Get user information
      const userInfo = await this.getUserInfo(tokenResponse.access_token, tokenResponse.instance_url);

      // Get organization information
      const orgInfo = await this.getOrganizationInfo(tokenResponse.access_token, tokenResponse.instance_url);

      // Update integration record
      await updateDoc(doc(this.integrationsCollection, integrationId), {
        status: 'authenticated',
        accessToken: this.encryptToken(tokenResponse.access_token),
        refreshToken: this.encryptToken(tokenResponse.refresh_token),
        instanceUrl: tokenResponse.instance_url,
        signature: tokenResponse.signature,
        userInfo,
        orgInfo,
        authenticatedAt: serverTimestamp()
      });

      // Create custom fields if they don't exist
      await this.ensureCustomFields(tokenResponse.access_token, tokenResponse.instance_url);

      // Test connection
      const connectionTest = await this.testConnection(tokenResponse.access_token, tokenResponse.instance_url);

      return {
        success: true,
        integrationId,
        userInfo,
        orgInfo,
        connectionTest,
        status: 'authenticated'
      };

    } catch (error) {
      console.error('Failed to complete Salesforce authentication:', error);
      throw new Error(`Authentication completion failed: ${error.message}`);
    }
  }

  /**
   * Sync opportunity with document signing
   */
  async syncOpportunityWithSigning(syncRequest) {
    try {
      const {
        integrationId,
        opportunityId, // Salesforce Opportunity ID
        documentId,
        signatureWorkflowId,
        autoUpdateStage = true,
        stageMapping = {
          'document_sent': 'Proposal/Price Quote',
          'document_signed': 'Closed Won',
          'document_declined': 'Closed Lost'
        }
      } = syncRequest;

      const syncId = `oppty_sync_${Date.now()}`;

      // Get integration credentials
      const integration = await this.getIntegration(integrationId);
      const accessToken = await this.getValidAccessToken(integration);

      // Get opportunity details from Salesforce
      const opportunity = await this.getSalesforceRecord(
        accessToken,
        integration.instanceUrl,
        'Opportunity',
        opportunityId
      );

      // Create local opportunity record
      const opportunityRecord = {
        syncId,
        salesforceId: opportunity.Id,
        name: opportunity.Name,
        amount: opportunity.Amount,
        stage: opportunity.StageName,
        closeDate: opportunity.CloseDate,
        accountId: opportunity.AccountId,
        ownerId: opportunity.OwnerId,
        documentId,
        signatureWorkflowId,
        integrationId,
        autoUpdateStage,
        stageMapping,
        lastSynced: serverTimestamp(),
        createdAt: serverTimestamp()
      };

      await addDoc(this.opportunitiesCollection, opportunityRecord);

      // Update Salesforce opportunity with RhodeSign fields
      const updateData = {
        'RhodeSign_Document_Id__c': documentId,
        'RhodeSign_Signature_Status__c': 'Pending',
        'RhodeSign_Contract_Sent__c': new Date().toISOString()
      };

      await this.updateSalesforceRecord(
        accessToken,
        integration.instanceUrl,
        'Opportunity',
        opportunityId,
        updateData
      );

      // Setup webhook for signature status updates
      await this.setupSignatureStatusWebhook(syncId, integrationId, opportunityId);

      // Log sync event
      await this.logSyncEvent({
        integrationId,
        action: 'opportunity_sync',
        salesforceId: opportunityId,
        documentId,
        status: 'success'
      });

      return {
        success: true,
        syncId,
        opportunity: opportunityRecord,
        salesforceUpdated: true
      };

    } catch (error) {
      console.error('Failed to sync opportunity with signing:', error);
      throw new Error(`Opportunity sync failed: ${error.message}`);
    }
  }

  /**
   * Update opportunity stage based on signature status
   */
  async updateOpportunityStage(updateRequest) {
    try {
      const {
        syncId,
        signatureStatus, // 'completed', 'declined', 'expired'
        signedDate = null
      } = updateRequest;

      // Get sync record
      const syncQuery = query(
        this.opportunitiesCollection,
        where('syncId', '==', syncId)
      );
      const syncSnapshot = await getDocs(syncQuery);
      
      if (syncSnapshot.empty) {
        throw new Error('Sync record not found');
      }

      const syncDoc = syncSnapshot.docs[0];
      const syncData = syncDoc.data();

      // Get integration credentials
      const integration = await this.getIntegration(syncData.integrationId);
      const accessToken = await this.getValidAccessToken(integration);

      // Determine new stage based on signature status
      let newStage = null;
      let salesforceStatus = null;

      switch (signatureStatus) {
        case 'completed':
          newStage = syncData.stageMapping.document_signed || 'Closed Won';
          salesforceStatus = 'Signed';
          break;
        case 'declined':
          newStage = syncData.stageMapping.document_declined || 'Closed Lost';
          salesforceStatus = 'Declined';
          break;
        case 'expired':
          salesforceStatus = 'Expired';
          break;
      }

      // Update Salesforce opportunity
      const updateData = {
        'RhodeSign_Signature_Status__c': salesforceStatus
      };

      if (newStage && syncData.autoUpdateStage) {
        updateData.StageName = newStage;
      }

      if (signedDate) {
        updateData['RhodeSign_Contract_Signed__c'] = signedDate;
      }

      await this.updateSalesforceRecord(
        accessToken,
        integration.instanceUrl,
        'Opportunity',
        syncData.salesforceId,
        updateData
      );

      // Update local sync record
      await updateDoc(doc(this.opportunitiesCollection, syncDoc.id), {
        signatureStatus,
        signedDate,
        lastUpdated: serverTimestamp()
      });

      // Log update event
      await this.logSyncEvent({
        integrationId: syncData.integrationId,
        action: 'opportunity_stage_update',
        salesforceId: syncData.salesforceId,
        newStage,
        signatureStatus,
        status: 'success'
      });

      return {
        success: true,
        syncId,
        newStage,
        salesforceStatus,
        updated: true
      };

    } catch (error) {
      console.error('Failed to update opportunity stage:', error);
      throw new Error(`Opportunity stage update failed: ${error.message}`);
    }
  }

  /**
   * Create contract from opportunity
   */
  async createContractFromOpportunity(contractRequest) {
    try {
      const {
        integrationId,
        opportunityId,
        contractTerms = {},
        templateId = null,
        autoGenerate = false
      } = contractRequest;

      // Get integration credentials
      const integration = await this.getIntegration(integrationId);
      const accessToken = await this.getValidAccessToken(integration);

      // Get opportunity details
      const opportunity = await this.getSalesforceRecord(
        accessToken,
        integration.instanceUrl,
        'Opportunity',
        opportunityId
      );

      // Get account details
      const account = await this.getSalesforceRecord(
        accessToken,
        integration.instanceUrl,
        'Account',
        opportunity.AccountId
      );

      // Create contract in Salesforce
      const contractData = {
        AccountId: opportunity.AccountId,
        Opportunity__c: opportunityId, // Custom field
        Status: 'Draft',
        StartDate: contractTerms.startDate || new Date().toISOString().split('T')[0],
        ContractTerm: contractTerms.term || 12,
        ...contractTerms
      };

      const salesforceContract = await this.createSalesforceRecord(
        accessToken,
        integration.instanceUrl,
        'Contract',
        contractData
      );

      // Create local contract record
      const contractRecord = {
        salesforceId: salesforceContract.id,
        opportunityId,
        accountId: opportunity.AccountId,
        contractNumber: `CONTRACT-${Date.now()}`,
        status: 'draft',
        terms: contractTerms,
        account: {
          name: account.Name,
          industry: account.Industry,
          billingAddress: account.BillingAddress
        },
        opportunity: {
          name: opportunity.Name,
          amount: opportunity.Amount,
          closeDate: opportunity.CloseDate
        },
        integrationId,
        templateId,
        createdAt: serverTimestamp()
      };

      const contractDoc = await addDoc(this.contractsCollection, contractRecord);

      // Auto-generate document if requested
      let documentId = null;
      if (autoGenerate && templateId) {
        documentId = await this.generateContractDocument(contractDoc.id, templateId);
      }

      return {
        success: true,
        contractId: contractDoc.id,
        salesforceContractId: salesforceContract.id,
        contractNumber: contractRecord.contractNumber,
        documentId,
        status: 'draft'
      };

    } catch (error) {
      console.error('Failed to create contract from opportunity:', error);
      throw new Error(`Contract creation failed: ${error.message}`);
    }
  }

  /**
   * Sync all opportunities with filters
   */
  async syncOpportunities(syncRequest) {
    try {
      const {
        integrationId,
        filters = {},
        lastSyncDate = null,
        batchSize = 100
      } = syncRequest;

      const syncId = `bulk_sync_${Date.now()}`;

      // Get integration credentials
      const integration = await this.getIntegration(integrationId);
      const accessToken = await this.getValidAccessToken(integration);

      // Build SOQL query
      let soqlQuery = `SELECT Id, Name, Amount, StageName, CloseDate, AccountId, OwnerId, 
                      LastModifiedDate, RhodeSign_Document_Id__c, RhodeSign_Signature_Status__c 
                      FROM Opportunity`;

      const conditions = [];

      if (lastSyncDate) {
        conditions.push(`LastModifiedDate >= ${lastSyncDate}`);
      }

      if (filters.stage) {
        conditions.push(`StageName = '${filters.stage}'`);
      }

      if (filters.ownerId) {
        conditions.push(`OwnerId = '${filters.ownerId}'`);
      }

      if (conditions.length > 0) {
        soqlQuery += ` WHERE ${conditions.join(' AND ')}`;
      }

      soqlQuery += ` ORDER BY LastModifiedDate DESC LIMIT ${batchSize}`;

      // Execute query
      const opportunities = await this.executeSoqlQuery(
        accessToken,
        integration.instanceUrl,
        soqlQuery
      );

      const syncResults = {
        syncId,
        totalRecords: opportunities.length,
        created: 0,
        updated: 0,
        errors: []
      };

      // Process each opportunity
      for (const opportunity of opportunities) {
        try {
          await this.upsertLocalOpportunity(opportunity, integrationId);
          syncResults.updated++;
        } catch (error) {
          syncResults.errors.push({
            opportunityId: opportunity.Id,
            error: error.message
          });
        }
      }

      // Log sync results
      await this.logSyncEvent({
        integrationId,
        action: 'bulk_opportunity_sync',
        results: syncResults,
        status: 'success'
      });

      return {
        success: true,
        syncId,
        results: syncResults
      };

    } catch (error) {
      console.error('Failed to sync opportunities:', error);
      throw new Error(`Opportunity sync failed: ${error.message}`);
    }
  }

  // Helper methods

  buildSalesforceAuthUrl(integrationId, instanceUrl) {
    const baseUrl = instanceUrl || this.salesforceConfig.loginUrl;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.salesforceConfig.clientId,
      redirect_uri: this.salesforceConfig.redirectUri,
      scope: this.salesforceConfig.scopes.join(' '),
      state: integrationId
    });

    return `${baseUrl}/services/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(authCode, instanceUrl) {
    const tokenUrl = `${instanceUrl || this.salesforceConfig.loginUrl}/services/oauth2/token`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.salesforceConfig.clientId,
        client_secret: this.salesforceConfig.clientSecret,
        redirect_uri: this.salesforceConfig.redirectUri,
        code: authCode
      })
    });

    if (!response.ok) {
      throw new Error('Failed to exchange authorization code');
    }

    return await response.json();
  }

  async getSalesforceRecord(accessToken, instanceUrl, objectType, recordId) {
    const response = await fetch(
      `${instanceUrl}/services/data/${this.salesforceConfig.apiVersion}/sobjects/${objectType}/${recordId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get ${objectType} record`);
    }

    return await response.json();
  }

  async updateSalesforceRecord(accessToken, instanceUrl, objectType, recordId, data) {
    const response = await fetch(
      `${instanceUrl}/services/data/${this.salesforceConfig.apiVersion}/sobjects/${objectType}/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update ${objectType} record`);
    }

    return response.status === 204;
  }

  async createSalesforceRecord(accessToken, instanceUrl, objectType, data) {
    const response = await fetch(
      `${instanceUrl}/services/data/${this.salesforceConfig.apiVersion}/sobjects/${objectType}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create ${objectType} record`);
    }

    return await response.json();
  }

  async executeSoqlQuery(accessToken, instanceUrl, query) {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `${instanceUrl}/services/data/${this.salesforceConfig.apiVersion}/query?q=${encodedQuery}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to execute SOQL query');
    }

    const result = await response.json();
    return result.records;
  }

  async getValidAccessToken(integration) {
    // Token refresh logic would be implemented here
    return this.decryptToken(integration.accessToken);
  }

  async getIntegration(integrationId) {
    const integrationDoc = await getDoc(doc(this.integrationsCollection, integrationId));
    if (!integrationDoc.exists()) {
      throw new Error('Integration not found');
    }
    return { integrationId, ...integrationDoc.data() };
  }

  async logSyncEvent(eventData) {
    await addDoc(this.syncLogsCollection, {
      ...eventData,
      timestamp: serverTimestamp()
    });
  }

  // Mock implementations for demo
  encryptToken(token) {
    return `encrypted_${btoa(token)}`;
  }

  decryptToken(encryptedToken) {
    return atob(encryptedToken.replace('encrypted_', ''));
  }

  async initializeSalesforceIntegration() {
    console.log('Salesforce Integration Service initialized');
  }

  // Additional helper methods would be implemented here...
  async getUserInfo(accessToken, instanceUrl) { return {}; }
  async getOrganizationInfo(accessToken, instanceUrl) { return {}; }
  async ensureCustomFields(accessToken, instanceUrl) { }
  async testConnection(accessToken, instanceUrl) { return { success: true }; }
  async setupSignatureStatusWebhook(syncId, integrationId, opportunityId) { }
  async upsertLocalOpportunity(opportunity, integrationId) { }
  async generateContractDocument(contractId, templateId) { return `doc_${Date.now()}`; }
}

export default new SalesforceIntegrationService();
