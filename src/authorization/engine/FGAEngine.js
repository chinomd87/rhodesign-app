// External Fine-Grained Authorization Engine
// Implements ReBAC, RBAC, and ABAC evaluation logic

import {
  Permissions,
  RolePermissions,
  RelationshipTypes,
  ConditionOperators,
  PolicyEffect,
  PolicyType,
  createAuthzResponse
} from '../models/index.js';

export class FGAEngine {
  constructor(policyStore, relationshipStore, attributeStore) {
    this.policyStore = policyStore;
    this.relationshipStore = relationshipStore;
    this.attributeStore = attributeStore;
    this.evaluationCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Main authorization evaluation entry point
  async authorize(request) {
    const startTime = Date.now();
    const evaluationId = this.generateEvaluationId();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cachedResult = this.evaluationCache.get(cacheKey);
      
      if (cachedResult && !this.isCacheExpired(cachedResult)) {
        return cachedResult.response;
      }

      // Get applicable policies
      const policies = await this.getApplicablePolicies(request);
      
      if (policies.length === 0) {
        return this.createDenyResponse('No applicable policies found', evaluationId, startTime);
      }

      // Evaluate policies in priority order
      const sortedPolicies = policies.sort((a, b) => (b.priority || 100) - (a.priority || 100));
      const appliedPolicies = [];
      let finalDecision = 'deny';
      let decisionReason = 'Default deny';

      for (const policy of sortedPolicies) {
        const result = await this.evaluatePolicy(policy, request);
        appliedPolicies.push({
          policyId: policy.id,
          policyName: policy.name,
          effect: result.effect,
          matched: result.matched,
          reason: result.reason
        });

        if (result.matched) {
          if (result.effect === PolicyEffect.DENY) {
            // Explicit deny takes precedence
            finalDecision = 'deny';
            decisionReason = `Denied by policy: ${policy.name}`;
            break;
          } else if (result.effect === PolicyEffect.ALLOW) {
            finalDecision = 'allow';
            decisionReason = `Allowed by policy: ${policy.name}`;
          }
        }
      }

      const response = createAuthzResponse({
        decision: finalDecision,
        reason: decisionReason,
        appliedPolicies,
        evaluationTime: Date.now() - startTime,
        evaluationId
      });

      // Cache the result
      this.cacheResult(cacheKey, response);

      return response;

    } catch (error) {
      console.error('Authorization evaluation error:', error);
      return this.createDenyResponse(`Evaluation error: ${error.message}`, evaluationId, startTime);
    }
  }

  // Evaluate a single policy against the request
  async evaluatePolicy(policy, request) {
    if (!policy.enabled) {
      return { matched: false, effect: null, reason: 'Policy disabled' };
    }

    try {
      switch (policy.type) {
        case PolicyType.RBAC:
          return await this.evaluateRBACPolicy(policy, request);
        case PolicyType.REBAC:
          return await this.evaluateReBACPolicy(policy, request);
        case PolicyType.ABAC:
          return await this.evaluateABACPolicy(policy, request);
        case PolicyType.HYBRID:
          return await this.evaluateHybridPolicy(policy, request);
        default:
          return { matched: false, effect: null, reason: 'Unknown policy type' };
      }
    } catch (error) {
      console.error(`Error evaluating policy ${policy.id}:`, error);
      return { matched: false, effect: null, reason: `Policy evaluation error: ${error.message}` };
    }
  }

  // RBAC Policy Evaluation
  async evaluateRBACPolicy(policy, request) {
    const userRoles = await this.getUserRoles(request.subject);
    
    // Check if user has any of the required roles
    const hasRequiredRole = policy.roles.some(role => userRoles.includes(role));
    if (!hasRequiredRole && policy.roles.length > 0) {
      return { matched: false, effect: null, reason: 'User lacks required roles' };
    }

    // Check if the action is permitted
    const userPermissions = this.getRolePermissions(userRoles);
    const hasPermission = policy.permissions.some(permission => 
      userPermissions.includes(permission) || userPermissions.includes(request.action)
    );

    if (!hasPermission && policy.permissions.length > 0) {
      return { matched: false, effect: null, reason: 'Action not permitted by user roles' };
    }

    return { 
      matched: true, 
      effect: policy.effect, 
      reason: `RBAC policy matched - roles: ${userRoles.join(', ')}` 
    };
  }

  // ReBAC Policy Evaluation
  async evaluateReBACPolicy(policy, request) {
    // Check if user has required relationships with the resource
    for (const relationshipType of policy.relationships) {
      const hasRelationship = await this.hasRelationship(
        request.subject,
        relationshipType,
        request.resource,
        request.resourceType
      );

      if (hasRelationship) {
        return { 
          matched: true, 
          effect: policy.effect, 
          reason: `ReBAC policy matched - relationship: ${relationshipType}` 
        };
      }
    }

    // Check for indirect relationships (e.g., through organization membership)
    const indirectRelationship = await this.checkIndirectRelationships(policy, request);
    if (indirectRelationship) {
      return { 
        matched: true, 
        effect: policy.effect, 
        reason: `ReBAC policy matched - indirect relationship: ${indirectRelationship}` 
      };
    }

    return { matched: false, effect: null, reason: 'No matching relationships found' };
  }

  // ABAC Policy Evaluation
  async evaluateABACPolicy(policy, request) {
    // Gather all attributes
    const userAttributes = await this.getUserAttributes(request.subject);
    const resourceAttributes = await this.getResourceAttributes(request.resource, request.resourceType);
    const environmentAttributes = this.getEnvironmentAttributes(request);

    const allAttributes = {
      ...userAttributes,
      ...resourceAttributes,
      ...environmentAttributes,
      ...request.userAttributes,
      ...request.resourceAttributes,
      ...request.environmentAttributes
    };

    // Evaluate all conditions
    const conditionResults = await Promise.all(
      policy.conditions.map(condition => this.evaluateCondition(condition, allAttributes))
    );

    // Group conditions and apply logical operators
    const groupedResults = this.groupConditionResults(policy.conditions, conditionResults);
    const finalResult = this.applyLogicalOperators(groupedResults);

    if (finalResult) {
      return { 
        matched: true, 
        effect: policy.effect, 
        reason: 'ABAC policy conditions satisfied' 
      };
    }

    return { matched: false, effect: null, reason: 'ABAC policy conditions not met' };
  }

  // Hybrid Policy Evaluation (combines RBAC, ReBAC, and ABAC)
  async evaluateHybridPolicy(policy, request) {
    const results = [];

    // Evaluate RBAC components
    if (policy.roles.length > 0 || policy.permissions.length > 0) {
      const rbacResult = await this.evaluateRBACPolicy(policy, request);
      results.push(rbacResult);
    }

    // Evaluate ReBAC components
    if (policy.relationships.length > 0) {
      const rebacResult = await this.evaluateReBACPolicy(policy, request);
      results.push(rebacResult);
    }

    // Evaluate ABAC components
    if (policy.conditions.length > 0) {
      const abacResult = await this.evaluateABACPolicy(policy, request);
      results.push(abacResult);
    }

    // Apply hybrid logic (all components must match for policy to apply)
    const allMatched = results.every(result => result.matched);
    
    if (allMatched) {
      return { 
        matched: true, 
        effect: policy.effect, 
        reason: 'Hybrid policy - all components matched' 
      };
    }

    const reasons = results.filter(r => !r.matched).map(r => r.reason).join('; ');
    return { matched: false, effect: null, reason: `Hybrid policy failed: ${reasons}` };
  }

  // Helper methods

  async getUserRoles(userId) {
    return await this.attributeStore.getUserRoles(userId);
  }

  getRolePermissions(roles) {
    const permissions = new Set();
    roles.forEach(role => {
      const rolePerms = RolePermissions[role] || [];
      rolePerms.forEach(perm => permissions.add(perm));
    });
    return Array.from(permissions);
  }

  async hasRelationship(subject, relation, object, objectType) {
    return await this.relationshipStore.hasRelationship(subject, relation, object, objectType);
  }

  async checkIndirectRelationships(policy, request) {
    // Check for organizational relationships
    const orgRelationships = await this.relationshipStore.getOrganizationRelationships(
      request.subject,
      request.resource
    );
    
    for (const relationship of policy.relationships) {
      if (orgRelationships.includes(relationship)) {
        return relationship;
      }
    }
    
    return null;
  }

  async getUserAttributes(userId) {
    return await this.attributeStore.getUserAttributes(userId);
  }

  async getResourceAttributes(resourceId, resourceType) {
    return await this.attributeStore.getResourceAttributes(resourceId, resourceType);
  }

  getEnvironmentAttributes(request) {
    const now = new Date();
    return {
      'env.time_of_day': now.getHours(),
      'env.day_of_week': now.getDay(),
      'env.timestamp': now.toISOString(),
      'env.ip_address': request.clientInfo?.ipAddress || 'unknown',
      'env.user_agent': request.clientInfo?.userAgent || 'unknown'
    };
  }

  async evaluateCondition(condition, attributes) {
    const attributeValue = attributes[condition.attribute];
    const conditionValue = condition.value;

    if (attributeValue === undefined) {
      return false;
    }

    switch (condition.operator) {
      case ConditionOperators.EQUALS:
        return attributeValue === conditionValue;
      case ConditionOperators.NOT_EQUALS:
        return attributeValue !== conditionValue;
      case ConditionOperators.GREATER_THAN:
        return attributeValue > conditionValue;
      case ConditionOperators.GREATER_THAN_OR_EQUAL:
        return attributeValue >= conditionValue;
      case ConditionOperators.LESS_THAN:
        return attributeValue < conditionValue;
      case ConditionOperators.LESS_THAN_OR_EQUAL:
        return attributeValue <= conditionValue;
      case ConditionOperators.IN:
        return Array.isArray(conditionValue) && conditionValue.includes(attributeValue);
      case ConditionOperators.NOT_IN:
        return Array.isArray(conditionValue) && !conditionValue.includes(attributeValue);
      case ConditionOperators.CONTAINS:
        return String(attributeValue).includes(String(conditionValue));
      case ConditionOperators.NOT_CONTAINS:
        return !String(attributeValue).includes(String(conditionValue));
      case ConditionOperators.STARTS_WITH:
        return String(attributeValue).startsWith(String(conditionValue));
      case ConditionOperators.ENDS_WITH:
        return String(attributeValue).endsWith(String(conditionValue));
      case ConditionOperators.MATCHES_REGEX:
        return new RegExp(conditionValue).test(String(attributeValue));
      default:
        return false;
    }
  }

  groupConditionResults(conditions, results) {
    const groups = {};
    
    conditions.forEach((condition, index) => {
      const groupId = condition.groupId || 'default';
      if (!groups[groupId]) {
        groups[groupId] = [];
      }
      groups[groupId].push({
        condition,
        result: results[index],
        logicalOperator: condition.logicalOperator || 'AND'
      });
    });
    
    return groups;
  }

  applyLogicalOperators(groupedResults) {
    const groupResults = [];
    
    Object.values(groupedResults).forEach(group => {
      let groupResult = group[0].result;
      
      for (let i = 1; i < group.length; i++) {
        const operator = group[i].logicalOperator;
        const currentResult = group[i].result;
        
        switch (operator) {
          case 'AND':
            groupResult = groupResult && currentResult;
            break;
          case 'OR':
            groupResult = groupResult || currentResult;
            break;
          case 'NOT':
            groupResult = groupResult && !currentResult;
            break;
        }
      }
      
      groupResults.push(groupResult);
    });
    
    // All groups must be true for final result to be true
    return groupResults.every(result => result);
  }

  async getApplicablePolicies(request) {
    return await this.policyStore.getApplicablePolicies(request);
  }

  generateEvaluationId() {
    return `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateCacheKey(request) {
    return `${request.subject}:${request.action}:${request.resource}:${request.resourceType}`;
  }

  isCacheExpired(cachedItem) {
    return Date.now() - cachedItem.timestamp > this.cacheTimeout;
  }

  cacheResult(key, response) {
    this.evaluationCache.set(key, {
      response,
      timestamp: Date.now()
    });

    // Clean up expired cache entries periodically
    if (this.evaluationCache.size > 1000) {
      this.cleanupCache();
    }
  }

  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.evaluationCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.evaluationCache.delete(key);
      }
    }
  }

  createDenyResponse(reason, evaluationId, startTime) {
    return createAuthzResponse({
      decision: 'deny',
      reason,
      appliedPolicies: [],
      evaluationTime: Date.now() - startTime,
      evaluationId
    });
  }

  // Batch authorization for performance
  async authorizeBatch(requests) {
    const results = await Promise.all(
      requests.map(request => this.authorize(request))
    );
    
    return results;
  }

  // Clear evaluation cache
  clearCache() {
    this.evaluationCache.clear();
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.evaluationCache.size,
      timeout: this.cacheTimeout,
      entries: Array.from(this.evaluationCache.keys())
    };
  }
}
