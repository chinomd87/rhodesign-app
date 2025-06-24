// Firestore data models for Phase 1

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

// Document data model
export const createDocumentModel = (data) => ({
  id: data.id || null,
  title: data.title || '',
  originalFileName: data.originalFileName || '',
  fileUrl: data.fileUrl || '',
  status: data.status || DocumentStatus.DRAFT,
  createdBy: data.createdBy || null,
  createdAt: data.createdAt || new Date(),
  updatedAt: data.updatedAt || new Date(),
  signers: data.signers || [],
  fields: data.fields || [],
  message: data.message || '',
  auditTrail: data.auditTrail || []
});

// Signer data model
export const createSignerModel = (data) => ({
  id: data.id || null,
  name: data.name || '',
  email: data.email || '',
  status: data.status || SignerStatus.PENDING,
  signedAt: data.signedAt || null,
  ipAddress: data.ipAddress || null,
  userAgent: data.userAgent || null,
  order: data.order || 0
});

// Field data model
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

// Audit trail entry model
export const createAuditTrailEntry = (action, details = {}) => ({
  id: Date.now().toString(),
  action,
  timestamp: new Date(),
  ipAddress: details.ipAddress || null,
  userAgent: details.userAgent || null,
  details
});
