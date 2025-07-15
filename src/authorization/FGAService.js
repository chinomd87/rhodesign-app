// FGA Service - Main interface for authorization in RhodeSign
// Integrates with existing Firebase services and provides authorization middleware

import { FGAEngine } from './engine/FGAEngine.js';
import { FirebasePolicyStore, FirebaseRelationshipStore, FirebaseAttributeStore } from './stores/FirebaseStores.js';
import { 
  Permissions, 
  Roles, 
  RelationshipTypes, 
  createAuthzRequest,
  createRelationship,
  createPolicy,
  PolicyType,
  PolicyEffect
} from './models/index.js';

class FGAService {
  constructor() {
    this.policyStore = new FirebasePolicyStore();
    this.relationshipStore = new FirebaseRelationshipStore();
    this.attributeStore = new FirebaseAttributeStore();
    this.engine = new FGAEngine(this.policyStore, this.relationshipStore, this.attributeStore);
    
    this.initialized = false;
  }

  // Initialize FGA with default policies and roles
  async initialize() {
    if (this.initialized) return;

    try {
      await this.createDefaultPolicies();
      await this.createDefaultRoles();
      this.initialized = true;
      console.log('FGA Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize FGA Service:', error);
      throw error;
    }
  }

  // === Authorization Methods ===

  // Check if user can perform action on resource
  async authorize(userId, action, resourceId, resourceType = 'document', context = {}) {
    const request = createAuthzRequest({
      subject: userId,
      action,
      resource: resourceId,
      resourceType,
      userAttributes: context.userAttributes || {},
      resourceAttributes: context.resourceAttributes || {},
      environmentAttributes: context.environmentAttributes || {},
      clientInfo: context.clientInfo || {}
    });

    return await this.engine.authorize(request);
  }

  // Batch authorization for multiple requests
  async authorizeBatch(requests) {
    const authzRequests = requests.map(req => createAuthzRequest(req));
    return await this.engine.authorizeBatch(authzRequests);
  }

  // === Document-specific Authorization ===

  // Check document permissions
  async canAccessDocument(userId, documentId, action = Permissions.DOCUMENT_READ) {
    return await this.authorize(userId, action, documentId, 'document');
  }

  async canEditDocument(userId, documentId) {
    return await this.authorize(userId, Permissions.DOCUMENT_UPDATE, documentId, 'document');
  }

  async canDeleteDocument(userId, documentId) {
    return await this.authorize(userId, Permissions.DOCUMENT_DELETE, documentId, 'document');
  }

  async canSignDocument(userId, documentId) {
    return await this.authorize(userId, Permissions.DOCUMENT_SIGN, documentId, 'document');
  }

  async canVoidDocument(userId, documentId) {
    return await this.authorize(userId, Permissions.DOCUMENT_VOID, documentId, 'document');
  }

  // === Relationship Management ===

  // Document relationships
  async addDocumentOwner(userId, documentId) {
    const relationship = createRelationship({
      subject: userId,
      relation: RelationshipTypes.DOCUMENT_OWNER,
      object: documentId,
      objectType: 'document'
    });
    
    return await this.relationshipStore.createRelationship(relationship);
  }

  async addDocumentSigner(signerId, documentId) {
    const relationship = createRelationship({
      subject: signerId,
      relation: RelationshipTypes.DOCUMENT_SIGNER,
      object: documentId,
      objectType: 'document'
    });
    
    return await this.relationshipStore.createRelationship(relationship);
  }

  async addDocumentViewer(userId, documentId) {
    const relationship = createRelationship({
      subject: userId,
      relation: RelationshipTypes.DOCUMENT_VIEWER,
      object: documentId,
      objectType: 'document'
    });
    
    return await this.relationshipStore.createRelationship(relationship);
  }

  // Organization relationships
  async addOrganizationMember(userId, orgId) {
    const relationship = createRelationship({
      subject: userId,
      relation: RelationshipTypes.ORG_MEMBER,
      object: orgId,
      objectType: 'organization'
    });
    
    return await this.relationshipStore.createRelationship(relationship);
  }

  async addOrganizationAdmin(userId, orgId) {
    const relationship = createRelationship({
      subject: userId,
      relation: RelationshipTypes.ORG_ADMIN,
      object: orgId,
      objectType: 'organization'
    });
    
    return await this.relationshipStore.createRelationship(relationship);
  }

  // === User and Resource Attributes ===

  // User role management
  async setUserRole(userId, role) {
    const attributes = await this.attributeStore.getUserAttributes(userId);
    const currentRoles = attributes.roles || [];
    
    if (!currentRoles.includes(role)) {
      currentRoles.push(role);
      await this.attributeStore.setUserAttributes(userId, {
        ...attributes,
        roles: currentRoles
      });
    }
  }

  async removeUserRole(userId, role) {
    const attributes = await this.attributeStore.getUserAttributes(userId);
    const currentRoles = attributes.roles || [];
    
    const updatedRoles = currentRoles.filter(r => r !== role);
    await this.attributeStore.setUserAttributes(userId, {
      ...attributes,
      roles: updatedRoles
    });
  }

  async setUserAttributes(userId, attributes) {
    return await this.attributeStore.setUserAttributes(userId, attributes);
  }

  async getUserAttributes(userId) {
    return await this.attributeStore.getUserAttributes(userId);
  }

  // Document attributes
  async setDocumentAttributes(documentId, attributes) {
    return await this.attributeStore.setResourceAttributes(documentId, 'document', attributes);
  }

  async getDocumentAttributes(documentId) {
    return await this.attributeStore.getResourceAttributes(documentId, 'document');
  }

  // === Policy Management ===

  async createPolicy(policyData) {
    const policy = createPolicy(policyData);
    return await this.policyStore.createPolicy(policy);
  }

  async updatePolicy(policyId, updates) {
    return await this.policyStore.updatePolicy(policyId, updates);
  }

  async deletePolicy(policyId) {
    return await this.policyStore.deletePolicy(policyId);
  }

  async getAllPolicies() {
    return await this.policyStore.getAllPolicies();
  }

  // === Middleware Functions ===

  // Express-style middleware for authorization
  requirePermission(permission, resourceType = 'document') {
    return async (req, res, next) => {
      try {
        const userId = req.user?.uid || req.userId;
        const resourceId = req.params.id || req.params.documentId;
        
        if (!userId) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const result = await this.authorize(userId, permission, resourceId, resourceType, {
          clientInfo: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        });

        if (result.decision === 'allow') {
          req.authzResult = result;
          next();
        } else {
          res.status(403).json({ 
            error: 'Access denied', 
            reason: result.reason 
          });
        }
      } catch (error) {
        console.error('Authorization middleware error:', error);
        res.status(500).json({ error: 'Authorization check failed' });
      }
    };
  }

  // React hook-style authorization checker
  useAuthorization(userId, permission, resourceId, resourceType = 'document') {
    return {
      checkPermission: async () => {
        if (!userId) return { allowed: false, reason: 'Not authenticated' };
        
        const result = await this.authorize(userId, permission, resourceId, resourceType);
        return {
          allowed: result.decision === 'allow',
          reason: result.reason,
          result
        };
      }
    };
  }

  // === Default Setup Methods ===

  async createDefaultPolicies() {
    const defaultPolicies = [
      // RBAC Policy: Admins can do everything
      {
        name: 'Admin Full Access',
        description: 'Super admins and org admins have full access',
        type: PolicyType.RBAC,
        effect: PolicyEffect.ALLOW,
        roles: [Roles.SUPER_ADMIN, Roles.ORG_ADMIN],
        permissions: Object.values(Permissions),
        priority: 1000,
        enabled: true
      },

      // ReBAC Policy: Document owners can manage their documents
      {
        name: 'Document Owner Access',
        description: 'Document owners can read, update, delete, and send their documents',
        type: PolicyType.REBAC,
        effect: PolicyEffect.ALLOW,
        relationships: [RelationshipTypes.DOCUMENT_OWNER],
        permissions: [
          Permissions.DOCUMENT_READ,
          Permissions.DOCUMENT_UPDATE,
          Permissions.DOCUMENT_DELETE,
          Permissions.DOCUMENT_SEND,
          Permissions.DOCUMENT_VOID
        ],
        priority: 900,
        enabled: true
      },

      // ReBAC Policy: Document signers can read and sign
      {
        name: 'Document Signer Access',
        description: 'Document signers can read and sign documents',
        type: PolicyType.REBAC,
        effect: PolicyEffect.ALLOW,
        relationships: [RelationshipTypes.DOCUMENT_SIGNER],
        permissions: [
          Permissions.DOCUMENT_READ,
          Permissions.DOCUMENT_SIGN
        ],
        priority: 800,
        enabled: true
      },

      // ABAC Policy: Restrict access to sensitive documents
      {
        name: 'Sensitive Document Access',
        description: 'Only users with high clearance can access sensitive documents',
        type: PolicyType.ABAC,
        effect: PolicyEffect.DENY,
        conditions: [
          {
            attribute: 'document.sensitivity',
            operator: 'eq',
            value: 'high'
          },
          {
            attribute: 'user.clearance_level',
            operator: 'lt',
            value: 3,
            logicalOperator: 'AND'
          }
        ],
        priority: 950,
        enabled: true
      },

      // Hybrid Policy: Organization members can access org documents during business hours
      {
        name: 'Organization Document Access',
        description: 'Organization members can access documents during business hours',
        type: PolicyType.HYBRID,
        effect: PolicyEffect.ALLOW,
        relationships: [RelationshipTypes.ORG_MEMBER],
        conditions: [
          {
            attribute: 'env.time_of_day',
            operator: 'gte',
            value: 9
          },
          {
            attribute: 'env.time_of_day',
            operator: 'lte',
            value: 17,
            logicalOperator: 'AND'
          }
        ],
        permissions: [Permissions.DOCUMENT_READ],
        priority: 700,
        enabled: true
      }
    ];

    for (const policyData of defaultPolicies) {
      try {
        const existingPolicies = await this.policyStore.getAllPolicies();
        const exists = existingPolicies.some(p => p.name === policyData.name);
        
        if (!exists) {
          await this.createPolicy(policyData);
          console.log(`Created default policy: ${policyData.name}`);
        }
      } catch (error) {
        console.error(`Failed to create default policy ${policyData.name}:`, error);
      }
    }
  }

  async createDefaultRoles() {
    // Default roles are defined in the models, no need to store them
    console.log('Default roles defined in models');
  }

  // === Utility Methods ===

  // Clear authorization cache
  clearCache() {
    this.engine.clearCache();
  }

  // Get cache statistics
  getCacheStats() {
    return this.engine.getCacheStats();
  }

  // Validate policy
  validatePolicy(policy) {
    if (!policy.name || !policy.type || !policy.effect) {
      throw new Error('Policy must have name, type, and effect');
    }
    
    if (policy.type === PolicyType.RBAC && (!policy.roles || !policy.permissions)) {
      throw new Error('RBAC policy must have roles and permissions');
    }
    
    if (policy.type === PolicyType.REBAC && !policy.relationships) {
      throw new Error('ReBAC policy must have relationships');
    }
    
    if (policy.type === PolicyType.ABAC && !policy.conditions) {
      throw new Error('ABAC policy must have conditions');
    }
    
    return true;
  }
}

// Singleton instance
const fgaService = new FGAService();

// Initialize on first import
fgaService.initialize().catch(console.error);

export default fgaService;
