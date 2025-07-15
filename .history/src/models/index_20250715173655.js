// Enhanced Document and Signature Models with Phase 4 Integration
// Global Expansion & Advanced Analytics Platform

// Legacy Constants (maintained for backward compatibility)
export const DocumentStatus = {
  DRAFT: 'draft',
  OUT_FOR_SIGNATURE: 'out_for_signature',
  COMPLETED: 'completed',
  VOIDED: 'voided'
};

export const SignerStatus = {
  PENDING: 'pending',
  VIEWED: 'viewed',
  SIGNED: 'signed'
};

export const FieldType = {
  SIGNATURE: 'signature',
  INITIAL: 'initial',
  DATE: 'date',
  TEXT: 'text'
};

// Phase 4 Enhanced Models

// Core Document Model with Phase 4 Features
export class Document {
  constructor(data = {}) {
    this.id = data.id || null;
    this.title = data.title || '';
    this.content = data.content || '';
    this.originalFileName = data.originalFileName || '';
    this.fileUrl = data.fileUrl || '';
    this.status = data.status || 'draft';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.createdBy = data.createdBy || null;
    this.signers = data.signers || [];
    this.fields = data.fields || [];
    this.message = data.message || '';
    this.auditTrail = data.auditTrail || [];
    this.metadata = data.metadata || {};
    
    // Phase 4 Enhancements
    this.globalCompliance = data.globalCompliance || {};
    this.workflowId = data.workflowId || null;
    this.analyticsData = data.analyticsData || {};
    this.partnerAttribution = data.partnerAttribution || null;
    this.predictiveInsights = data.predictiveInsights || {};
    this.whiteLabelConfig = data.whiteLabelConfig || null;
  }

  validate() {
    const errors = [];
    
    if (!this.title || this.title.trim().length === 0) {
      errors.push('Title is required');
    }
    
    if (!Array.isArray(this.signers) || this.signers.length === 0) {
      errors.push('At least one signer is required');
    }

    // Phase 4: Global compliance validation
    if (this.globalCompliance.region) {
      const complianceErrors = this.validateGlobalCompliance();
      errors.push(...complianceErrors);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateGlobalCompliance() {
    const errors = [];
    const { region, requirements } = this.globalCompliance;

    if (region === 'EU' && requirements?.eidas) {
      if (!requirements.qualifiedSignature) {
        errors.push('Qualified signature required for EU eIDAS compliance');
      }
    }

    if (region === 'US' && requirements?.esign) {
      if (!requirements.intentToSign) {
        errors.push('Intent to sign required for US ESIGN compliance');
      }
    }

    return errors;
  }

  getPredictiveInsights() {
    return {
      estimatedCompletionTime: this.predictiveInsights.completionTime || null,
      completionProbability: this.predictiveInsights.probability || null,
      riskFactors: this.predictiveInsights.risks || [],
      optimizationRecommendations: this.predictiveInsights.recommendations || []
    };
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      content: this.content,
      originalFileName: this.originalFileName,
      fileUrl: this.fileUrl,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy,
      signers: this.signers,
      fields: this.fields,
      message: this.message,
      auditTrail: this.auditTrail,
      metadata: this.metadata,
      globalCompliance: this.globalCompliance,
      workflowId: this.workflowId,
      analyticsData: this.analyticsData,
      partnerAttribution: this.partnerAttribution,
      predictiveInsights: this.predictiveInsights,
      whiteLabelConfig: this.whiteLabelConfig
    };
  }
}

// Enhanced Signer Model with Phase 4 Features
export class Signer {
  constructor(data = {}) {
    this.id = data.id || null;
    this.email = data.email || '';
    this.name = data.name || '';
    this.role = data.role || 'signer';
    this.status = data.status || 'pending';
    this.signedAt = data.signedAt || null;
    this.ipAddress = data.ipAddress || null;
    this.userAgent = data.userAgent || null;
    this.order = data.order || 0;
    this.position = data.position || { x: 0, y: 0 };
    this.size = data.size || { width: 200, height: 100 };
    this.required = data.required !== false;
    
    // Phase 4 Enhancements
    this.globalIdentity = data.globalIdentity || {};
    this.complianceLevel = data.complianceLevel || 'standard';
    this.behaviorAnalytics = data.behaviorAnalytics || {};
    this.partnerSource = data.partnerSource || null;
    this.predictedEngagement = data.predictedEngagement || null;
  }

  validate() {
    const errors = [];
    
    if (!this.email || !this.isValidEmail(this.email)) {
      errors.push('Valid email is required');
    }
    
    if (!this.name || this.name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (this.globalIdentity.verificationType) {
      const identityErrors = this.validateGlobalIdentity();
      errors.push(...identityErrors);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateGlobalIdentity() {
    const errors = [];
    const { verificationType, documentType, issuer } = this.globalIdentity;

    if (verificationType === 'government_id' && !documentType) {
      errors.push('Document type required for government ID verification');
    }

    if (verificationType === 'eidas_qualified' && !issuer) {
      errors.push('Qualified issuer required for eIDAS verification');
    }

    return errors;
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  getEngagementPrediction() {
    return {
      likelihood: this.predictedEngagement?.likelihood || null,
      timeToAction: this.predictedEngagement?.timeToAction || null,
      preferredChannel: this.predictedEngagement?.preferredChannel || 'email',
      riskFactors: this.predictedEngagement?.risks || []
    };
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      role: this.role,
      status: this.status,
      signedAt: this.signedAt,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      order: this.order,
      position: this.position,
      size: this.size,
      required: this.required,
      globalIdentity: this.globalIdentity,
      complianceLevel: this.complianceLevel,
      behaviorAnalytics: this.behaviorAnalytics,
      partnerSource: this.partnerSource,
      predictedEngagement: this.predictedEngagement
    };
  }
}

// Phase 4: Advanced Workflow Model
export class AdvancedWorkflow {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.description = data.description || '';
    this.type = data.type || 'sequential';
    this.status = data.status || 'draft';
    this.nodes = data.nodes || [];
    this.connections = data.connections || [];
    this.variables = data.variables || {};
    this.rules = data.rules || {};
    this.mlOptimization = data.mlOptimization || false;
    this.globalCompliance = data.globalCompliance || false;
    this.partnerIntegration = data.partnerIntegration || null;
    this.analytics = data.analytics || {};
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  validate() {
    const errors = [];
    
    if (!this.name || this.name.trim().length === 0) {
      errors.push('Workflow name is required');
    }

    if (!Array.isArray(this.nodes) || this.nodes.length === 0) {
      errors.push('At least one node is required');
    }

    const startNodes = this.nodes.filter(n => n.type === 'start_node');
    if (startNodes.length !== 1) {
      errors.push('Exactly one start node is required');
    }

    const endNodes = this.nodes.filter(n => n.type === 'end_node');
    if (endNodes.length === 0) {
      errors.push('At least one end node is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      type: this.type,
      status: this.status,
      nodes: this.nodes,
      connections: this.connections,
      variables: this.variables,
      rules: this.rules,
      mlOptimization: this.mlOptimization,
      globalCompliance: this.globalCompliance,
      partnerIntegration: this.partnerIntegration,
      analytics: this.analytics,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

// Legacy Factory Functions (maintained for backward compatibility)
export const createDocumentModel = (data) => new Document(data);
export const createSignerModel = (data) => new Signer(data);

export const createFieldModel = (data) => ({
  id: data.id || null,
  type: data.type || FieldType.SIGNATURE,
  x: data.x || 0,
  y: data.y || 0,
  width: data.width || 200,
  height: data.height || 50,
  page: data.page || 1,
  signerId: data.signerId || null,
  required: data.required !== false,
  value: data.value || null
});

export const createAuditTrailEntry = (action, details = {}) => ({
  id: Date.now().toString(),
  action,
  timestamp: new Date(),
  ipAddress: details.ipAddress || null,
  userAgent: details.userAgent || null,
  details
});

// Phase 4 Export Functions
export const createDocument = (data) => new Document(data);
export const createSigner = (data) => new Signer(data);
export const createAdvancedWorkflow = (data) => new AdvancedWorkflow(data);

console.log('✅ Phase 4 Models: Enhanced with Global Expansion & Advanced Analytics');
