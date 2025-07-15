# Fine-Grained Authorization (FGA) Implementation Guide

## Overview

This document outlines the implementation of an externalized Fine-Grained Authorization (FGA) system for RhodeSign that combines:

- **RBAC (Role-Based Access Control)** - Traditional role and permission management
- **ReBAC (Relationship-Based Access Control)** - Access based on relationships between users and resources
- **ABAC (Attribute-Based Access Control)** - Context-aware access decisions based on attributes

## Architecture

### Core Components

1. **FGA Engine** (`/src/authorization/engine/FGAEngine.js`)
   - Policy evaluation logic
   - Caching for performance
   - Batch authorization support

2. **Data Stores** (`/src/authorization/stores/FirebaseStores.js`)
   - Policy Store: Manages authorization policies
   - Relationship Store: Manages user-resource relationships
   - Attribute Store: Manages user and resource attributes

3. **FGA Service** (`/src/authorization/FGAService.js`)
   - Main interface for authorization
   - Integration with existing services
   - Policy and relationship management

4. **React Hooks** (`/src/authorization/hooks/useFGA.js`)
   - Component-level authorization
   - Permission gates
   - Role management

## Data Models

### RBAC Models
- **Roles**: `super_admin`, `org_admin`, `manager`, `user`, `viewer`, `external_signer`
- **Permissions**: Document operations (`document:read`, `document:create`, etc.)

### ReBAC Models
- **Relationships**: `document:owner`, `document:signer`, `org:member`, etc.

### ABAC Models
- **Attributes**: User attributes (`user.department`), Resource attributes (`document.sensitivity`), Environment attributes (`env.time_of_day`)

### Policy Structure
```javascript
{
  id: "policy-id",
  name: "Policy Name",
  type: "hybrid", // rbac, rebac, abac, hybrid
  effect: "allow", // allow, deny
  roles: ["user", "manager"],
  permissions: ["document:read"],
  relationships: ["document:owner"],
  conditions: [
    {
      attribute: "user.department",
      operator: "eq",
      value: "legal"
    }
  ],
  priority: 100,
  enabled: true
}
```

## Usage Examples

### Basic Authorization Check
```javascript
import fgaService from './authorization/FGAService.js';

const result = await fgaService.authorize(
  userId, 
  'document:read', 
  documentId, 
  'document'
);

if (result.decision === 'allow') {
  // User can access document
}
```

### React Component Integration
```jsx
import { useDocumentPermissions, PermissionGate } from './authorization/hooks/useFGA.js';

function DocumentCard({ document }) {
  const { canEdit, canDelete } = useDocumentPermissions(document.id);
  
  return (
    <div>
      <h3>{document.title}</h3>
      
      <PermissionGate permission="document:update" resourceId={document.id}>
        <button onClick={handleEdit}>Edit</button>
      </PermissionGate>
      
      <PermissionGate permission="document:delete" resourceId={document.id}>
        <button onClick={handleDelete}>Delete</button>
      </PermissionGate>
    </div>
  );
}
```

### Service Integration
```javascript
// In DocumentService
import fgaService from '../authorization/FGAService.js';

static async createDocument(documentData, userId) {
  // Check permission
  const authResult = await fgaService.authorize(
    userId, 
    'document:create', 
    null, 
    'document'
  );
  
  if (authResult.decision !== 'allow') {
    throw new Error(`Access denied: ${authResult.reason}`);
  }
  
  // Create document...
  const documentId = await this.createDocumentInFirestore(documentData);
  
  // Set up relationships
  await fgaService.addDocumentOwner(userId, documentId);
  
  return documentId;
}
```

## Default Policies

The system includes several default policies:

1. **Admin Full Access**: Super admins and org admins have full access
2. **Document Owner Access**: Document owners can manage their documents
3. **Document Signer Access**: Signers can read and sign documents
4. **Sensitive Document Access**: ABAC policy restricting sensitive documents
5. **Organization Document Access**: Hybrid policy for org members during business hours

## Firebase Collections

### fga_policies
Stores authorization policies with fields:
- `name`, `description`, `type`, `effect`
- `roles`, `permissions`, `relationships`, `conditions`
- `priority`, `enabled`, `createdAt`, `updatedAt`

### fga_relationships
Stores user-resource relationships:
- `subject` (user ID), `relation`, `object` (resource ID), `objectType`
- `createdAt`, `createdBy`, `expiresAt`, `attributes`

### fga_user_attributes
Stores user attributes for ABAC:
- `userId`, `roles`, `department`, `clearance_level`, etc.

### fga_resource_attributes
Stores resource attributes for ABAC:
- `resourceId`, `resourceType`, `sensitivity`, `classification`, etc.

## Security Considerations

1. **Default Deny**: All access is denied unless explicitly allowed
2. **Explicit Deny Override**: Deny policies take precedence over allow policies
3. **Policy Priority**: Higher priority policies are evaluated first
4. **Audit Trail**: All authorization decisions are logged
5. **Cache Security**: Cache is cleared on policy changes

## Performance Optimization

1. **Evaluation Cache**: Results cached for 5 minutes
2. **Batch Authorization**: Multiple requests processed together
3. **Policy Indexing**: Firestore queries optimized with indexes
4. **Lazy Loading**: Attributes loaded only when needed

## Administration

Use the FGA Admin Dashboard (`/src/components/admin/FGAAdminDashboard.jsx`) to:
- View and manage policies
- Monitor cache performance
- Debug authorization issues
- View system statistics

## Integration Steps

1. **Initialize FGA Service**: Service auto-initializes on import
2. **Update Existing Services**: Add authorization checks to document operations
3. **Update Components**: Use permission gates and hooks
4. **Set Up Relationships**: Add relationships when documents are created
5. **Configure Attributes**: Set user and resource attributes for ABAC

## Testing

Test authorization scenarios:

```javascript
// Test RBAC
await fgaService.setUserRole(userId, 'manager');
const result = await fgaService.authorize(userId, 'document:create');

// Test ReBAC
await fgaService.addDocumentOwner(userId, documentId);
const result = await fgaService.authorize(userId, 'document:update', documentId);

// Test ABAC
await fgaService.setDocumentAttributes(documentId, { sensitivity: 'high' });
await fgaService.setUserAttributes(userId, { clearance_level: 2 });
const result = await fgaService.authorize(userId, 'document:read', documentId);
```

## Monitoring and Debugging

1. **Cache Statistics**: Monitor cache hit rates and performance
2. **Policy Evaluation Logs**: Track which policies are being applied
3. **Authorization Metrics**: Monitor authorization success/failure rates
4. **Performance Metrics**: Track authorization evaluation times

## Migration from Existing System

1. **Identify Current Permissions**: Map existing permission checks
2. **Create Policies**: Define policies for current authorization logic
3. **Set Up Relationships**: Create relationships for existing data
4. **Gradual Migration**: Replace permission checks incrementally
5. **Testing**: Verify authorization behavior matches existing system

This FGA system provides comprehensive, flexible authorization that scales with your application's needs while maintaining security and performance.
