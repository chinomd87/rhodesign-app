// External Fine-Grained Authorization (FGA) Models
// Combining ReBAC (Relationship-Based), RBAC (Role-Based), and ABAC (Attribute-Based) Access Control

// === RBAC Models ===
export const Roles = {
  SUPER_ADMIN: 'super_admin',
  ORG_ADMIN: 'org_admin',
  MANAGER: 'manager',
  USER: 'user',
  VIEWER: 'viewer',
  EXTERNAL_SIGNER: 'external_signer'
};

export const Permissions = {
  // Document permissions
  DOCUMENT_CREATE: 'document:create',
  DOCUMENT_READ: 'document:read',
  DOCUMENT_UPDATE: 'document:update',
  DOCUMENT_DELETE: 'document:delete',
  DOCUMENT_SEND: 'document:send',
  DOCUMENT_SIGN: 'document:sign',
  DOCUMENT_VOID: 'document:void',
  DOCUMENT_AUDIT: 'document:audit',
  
  // Organization permissions
  ORG_CREATE: 'org:create',
  ORG_READ: 'org:read',
  ORG_UPDATE: 'org:update',
  ORG_DELETE: 'org:delete',
  ORG_MANAGE_USERS: 'org:manage_users',
  ORG_MANAGE_ROLES: 'org:manage_roles',
  
  // User permissions
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_IMPERSONATE: 'user:impersonate',
  
  // Template permissions
  TEMPLATE_CREATE: 'template:create',
  TEMPLATE_READ: 'template:read',
  TEMPLATE_UPDATE: 'template:update',
  TEMPLATE_DELETE: 'template:delete',
  TEMPLATE_SHARE: 'template:share',
  
  // System permissions
  SYSTEM_ADMIN: 'system:admin',
  SYSTEM_AUDIT: 'system:audit',
  SYSTEM_CONFIGURE: 'system:configure'
};

// Role-Permission mappings
export const RolePermissions = {
  [Roles.SUPER_ADMIN]: Object.values(Permissions),
  
  [Roles.ORG_ADMIN]: [
    Permissions.DOCUMENT_CREATE,
    Permissions.DOCUMENT_READ,
    Permissions.DOCUMENT_UPDATE,
    Permissions.DOCUMENT_DELETE,
    Permissions.DOCUMENT_SEND,
    Permissions.DOCUMENT_VOID,
    Permissions.DOCUMENT_AUDIT,
    Permissions.ORG_READ,
    Permissions.ORG_UPDATE,
    Permissions.ORG_MANAGE_USERS,
    Permissions.ORG_MANAGE_ROLES,
    Permissions.USER_CREATE,
    Permissions.USER_READ,
    Permissions.USER_UPDATE,
    Permissions.USER_DELETE,
    Permissions.TEMPLATE_CREATE,
    Permissions.TEMPLATE_READ,
    Permissions.TEMPLATE_UPDATE,
    Permissions.TEMPLATE_DELETE,
    Permissions.TEMPLATE_SHARE
  ],
  
  [Roles.MANAGER]: [
    Permissions.DOCUMENT_CREATE,
    Permissions.DOCUMENT_READ,
    Permissions.DOCUMENT_UPDATE,
    Permissions.DOCUMENT_SEND,
    Permissions.DOCUMENT_AUDIT,
    Permissions.USER_READ,
    Permissions.TEMPLATE_CREATE,
    Permissions.TEMPLATE_READ,
    Permissions.TEMPLATE_UPDATE,
    Permissions.TEMPLATE_SHARE
  ],
  
  [Roles.USER]: [
    Permissions.DOCUMENT_CREATE,
    Permissions.DOCUMENT_READ,
    Permissions.DOCUMENT_UPDATE,
    Permissions.DOCUMENT_SEND,
    Permissions.DOCUMENT_SIGN,
    Permissions.TEMPLATE_CREATE,
    Permissions.TEMPLATE_READ,
    Permissions.TEMPLATE_UPDATE
  ],
  
  [Roles.VIEWER]: [
    Permissions.DOCUMENT_READ,
    Permissions.TEMPLATE_READ
  ],
  
  [Roles.EXTERNAL_SIGNER]: [
    Permissions.DOCUMENT_READ,
    Permissions.DOCUMENT_SIGN
  ]
};

// === ReBAC Models ===
export const RelationshipTypes = {
  // Document relationships
  DOCUMENT_OWNER: 'document:owner',
  DOCUMENT_CREATOR: 'document:creator',
  DOCUMENT_SIGNER: 'document:signer',
  DOCUMENT_VIEWER: 'document:viewer',
  DOCUMENT_COLLABORATOR: 'document:collaborator',
  
  // Organization relationships
  ORG_MEMBER: 'org:member',
  ORG_ADMIN: 'org:admin',
  ORG_OWNER: 'org:owner',
  
  // Team relationships
  TEAM_MEMBER: 'team:member',
  TEAM_LEAD: 'team:lead',
  TEAM_ADMIN: 'team:admin',
  
  // Template relationships
  TEMPLATE_OWNER: 'template:owner',
  TEMPLATE_SHARED_WITH: 'template:shared_with',
  TEMPLATE_EDITOR: 'template:editor'
};

// === ABAC Models ===
export const AttributeTypes = {
  // User attributes
  USER_DEPARTMENT: 'user.department',
  USER_LOCATION: 'user.location',
  USER_CLEARANCE_LEVEL: 'user.clearance_level',
  USER_IP_ADDRESS: 'user.ip_address',
  USER_DEVICE_TYPE: 'user.device_type',
  
  // Document attributes
  DOCUMENT_CLASSIFICATION: 'document.classification',
  DOCUMENT_STATUS: 'document.status',
  DOCUMENT_TYPE: 'document.type',
  DOCUMENT_SENSITIVITY: 'document.sensitivity',
  DOCUMENT_CREATED_DATE: 'document.created_date',
  DOCUMENT_SIZE: 'document.size',
  
  // Organization attributes
  ORG_TYPE: 'org.type',
  ORG_SIZE: 'org.size',
  ORG_INDUSTRY: 'org.industry',
  
  // Environment attributes
  ENV_TIME_OF_DAY: 'env.time_of_day',
  ENV_DAY_OF_WEEK: 'env.day_of_week',
  ENV_IP_RANGE: 'env.ip_range',
  ENV_LOCATION: 'env.location'
};

export const ConditionOperators = {
  EQUALS: 'eq',
  NOT_EQUALS: 'ne',
  GREATER_THAN: 'gt',
  GREATER_THAN_OR_EQUAL: 'gte',
  LESS_THAN: 'lt',
  LESS_THAN_OR_EQUAL: 'lte',
  IN: 'in',
  NOT_IN: 'not_in',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'not_contains',
  STARTS_WITH: 'starts_with',
  ENDS_WITH: 'ends_with',
  MATCHES_REGEX: 'regex'
};

// === Policy Models ===
export const PolicyEffect = {
  ALLOW: 'allow',
  DENY: 'deny'
};

export const PolicyType = {
  RBAC: 'rbac',
  REBAC: 'rebac',
  ABAC: 'abac',
  HYBRID: 'hybrid'
};

// Policy structure for external FGA
export const createPolicy = (data) => ({
  id: data.id || null,
  name: data.name || '',
  description: data.description || '',
  type: data.type || PolicyType.HYBRID,
  effect: data.effect || PolicyEffect.ALLOW,
  
  // RBAC components
  roles: data.roles || [],
  permissions: data.permissions || [],
  
  // ReBAC components
  relationships: data.relationships || [],
  
  // ABAC components
  conditions: data.conditions || [],
  
  // Policy metadata
  priority: data.priority || 100,
  enabled: data.enabled !== false,
  version: data.version || '1.0',
  createdAt: data.createdAt || new Date(),
  updatedAt: data.updatedAt || new Date(),
  createdBy: data.createdBy || null,
  
  // Audit fields
  lastEvaluated: data.lastEvaluated || null,
  evaluationCount: data.evaluationCount || 0
});

// Relationship structure for ReBAC
export const createRelationship = (data) => ({
  id: data.id || null,
  subject: data.subject || '', // user ID
  relation: data.relation || '', // relationship type
  object: data.object || '', // resource ID
  objectType: data.objectType || '', // resource type
  
  // Metadata
  createdAt: data.createdAt || new Date(),
  createdBy: data.createdBy || null,
  expiresAt: data.expiresAt || null,
  
  // Additional attributes for context
  attributes: data.attributes || {}
});

// Condition structure for ABAC
export const createCondition = (data) => ({
  id: data.id || null,
  attribute: data.attribute || '',
  operator: data.operator || ConditionOperators.EQUALS,
  value: data.value || null,
  
  // Logical operators for complex conditions
  logicalOperator: data.logicalOperator || 'AND', // AND, OR, NOT
  groupId: data.groupId || null // for grouping conditions
});

// Authorization request structure
export const createAuthzRequest = (data) => ({
  // Core request components
  subject: data.subject || '', // user ID
  action: data.action || '', // permission/action
  resource: data.resource || '', // resource ID
  resourceType: data.resourceType || '', // resource type
  
  // Context attributes for ABAC
  userAttributes: data.userAttributes || {},
  resourceAttributes: data.resourceAttributes || {},
  environmentAttributes: data.environmentAttributes || {},
  
  // Request metadata
  requestId: data.requestId || null,
  timestamp: data.timestamp || new Date(),
  clientInfo: data.clientInfo || {}
});

// Authorization response structure
export const createAuthzResponse = (data) => ({
  decision: data.decision || 'deny', // allow, deny, indeterminate
  reason: data.reason || '',
  appliedPolicies: data.appliedPolicies || [],
  evaluationTime: data.evaluationTime || 0,
  
  // Additional context
  obligations: data.obligations || [], // actions that must be performed
  advice: data.advice || [], // recommended actions
  
  // Audit information
  evaluationId: data.evaluationId || null,
  evaluatedAt: data.evaluatedAt || new Date()
});
