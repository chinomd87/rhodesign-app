// FGA Integration Hook for React Components
// Provides authorization checks within React components

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import fgaService from './FGAService.js';
import { Permissions } from './models/index.js';

// Main authorization hook
export function useAuthorization() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const checkPermission = useCallback(async (permission, resourceId, resourceType = 'document', context = {}) => {
    if (!user?.uid) {
      return { allowed: false, reason: 'Not authenticated' };
    }

    setLoading(true);
    try {
      const result = await fgaService.authorize(
        user.uid,
        permission,
        resourceId,
        resourceType,
        context
      );

      const authResult = {
        allowed: result.decision === 'allow',
        reason: result.reason,
        result,
        timestamp: new Date()
      };

      setLastResult(authResult);
      return authResult;
    } catch (error) {
      console.error('Authorization check failed:', error);
      const errorResult = {
        allowed: false,
        reason: `Authorization error: ${error.message}`,
        error,
        timestamp: new Date()
      };
      setLastResult(errorResult);
      return errorResult;
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  const batchCheckPermissions = useCallback(async (requests) => {
    if (!user?.uid) {
      return requests.map(() => ({ allowed: false, reason: 'Not authenticated' }));
    }

    setLoading(true);
    try {
      const authzRequests = requests.map(req => ({
        subject: user.uid,
        action: req.permission,
        resource: req.resourceId,
        resourceType: req.resourceType || 'document',
        ...req.context
      }));

      const results = await fgaService.authorizeBatch(authzRequests);
      
      return results.map(result => ({
        allowed: result.decision === 'allow',
        reason: result.reason,
        result
      }));
    } catch (error) {
      console.error('Batch authorization check failed:', error);
      return requests.map(() => ({
        allowed: false,
        reason: `Authorization error: ${error.message}`,
        error
      }));
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  return {
    checkPermission,
    batchCheckPermissions,
    loading,
    lastResult,
    user
  };
}

// Specific permission hooks for common actions
export function useDocumentPermissions(documentId) {
  const { checkPermission } = useAuthorization();

  const canRead = useCallback(() => 
    checkPermission(Permissions.DOCUMENT_READ, documentId), [checkPermission, documentId]);

  const canEdit = useCallback(() => 
    checkPermission(Permissions.DOCUMENT_UPDATE, documentId), [checkPermission, documentId]);

  const canDelete = useCallback(() => 
    checkPermission(Permissions.DOCUMENT_DELETE, documentId), [checkPermission, documentId]);

  const canSend = useCallback(() => 
    checkPermission(Permissions.DOCUMENT_SEND, documentId), [checkPermission, documentId]);

  const canSign = useCallback(() => 
    checkPermission(Permissions.DOCUMENT_SIGN, documentId), [checkPermission, documentId]);

  const canVoid = useCallback(() => 
    checkPermission(Permissions.DOCUMENT_VOID, documentId), [checkPermission, documentId]);

  const canAudit = useCallback(() => 
    checkPermission(Permissions.DOCUMENT_AUDIT, documentId), [checkPermission, documentId]);

  return {
    canRead,
    canEdit,
    canDelete,
    canSend,
    canSign,
    canVoid,
    canAudit
  };
}

// Permission-based component wrapper
export function withPermission(WrappedComponent, requiredPermission, resourceType = 'document') {
  return function PermissionWrappedComponent(props) {
    const { checkPermission } = useAuthorization();
    const [authorized, setAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const resourceId = props.resourceId || props.documentId || props.id;

    useEffect(() => {
      if (!resourceId) {
        setError('Resource ID is required for permission check');
        setLoading(false);
        return;
      }

      checkPermission(requiredPermission, resourceId, resourceType)
        .then(result => {
          setAuthorized(result.allowed);
          if (!result.allowed) {
            setError(result.reason);
          }
        })
        .catch(err => {
          setError(err.message);
          setAuthorized(false);
        })
        .finally(() => {
          setLoading(false);
        });
    }, [checkPermission, resourceId]);

    if (loading) {
      return <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600">Checking permissions...</span>
      </div>;
    }

    if (error || !authorized) {
      return <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Access Denied</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>;
    }

    return <WrappedComponent {...props} />;
  };
}

// Conditional rendering based on permissions
export function PermissionGate({ children, permission, resourceId, resourceType = 'document', fallback = null }) {
  const { checkPermission } = useAuthorization();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!resourceId) {
      setLoading(false);
      return;
    }

    checkPermission(permission, resourceId, resourceType)
      .then(result => {
        setAuthorized(result.allowed);
      })
      .catch(() => {
        setAuthorized(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [checkPermission, permission, resourceId, resourceType]);

  if (loading) {
    return <div className="inline-block animate-pulse bg-gray-200 rounded h-4 w-16"></div>;
  }

  if (!authorized) {
    return fallback;
  }

  return children;
}

// Hook for role-based UI rendering
export function useRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setRoles([]);
      setLoading(false);
      return;
    }

    fgaService.getUserAttributes(user.uid)
      .then(attributes => {
        setRoles(attributes.roles || ['user']);
      })
      .catch(error => {
        console.error('Failed to get user roles:', error);
        setRoles(['user']);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user?.uid]);

  const hasRole = useCallback((role) => {
    return roles.includes(role);
  }, [roles]);

  const hasAnyRole = useCallback((roleList) => {
    return roleList.some(role => roles.includes(role));
  }, [roles]);

  const hasAllRoles = useCallback((roleList) => {
    return roleList.every(role => roles.includes(role));
  }, [roles]);

  return {
    roles,
    loading,
    hasRole,
    hasAnyRole,
    hasAllRoles
  };
}

// Hook for managing user relationships
export function useRelationships() {
  const { user } = useAuth();

  const addDocumentOwner = useCallback(async (documentId) => {
    if (!user?.uid) throw new Error('Not authenticated');
    return await fgaService.addDocumentOwner(user.uid, documentId);
  }, [user?.uid]);

  const addDocumentSigner = useCallback(async (signerId, documentId) => {
    return await fgaService.addDocumentSigner(signerId, documentId);
  }, []);

  const addDocumentViewer = useCallback(async (userId, documentId) => {
    return await fgaService.addDocumentViewer(userId, documentId);
  }, []);

  const addOrgMember = useCallback(async (userId, orgId) => {
    return await fgaService.addOrganizationMember(userId, orgId);
  }, []);

  const addOrgAdmin = useCallback(async (userId, orgId) => {
    return await fgaService.addOrganizationAdmin(userId, orgId);
  }, []);

  return {
    addDocumentOwner,
    addDocumentSigner,
    addDocumentViewer,
    addOrgMember,
    addOrgAdmin
  };
}

// Debug hook for authorization
export function useFGADebug() {
  const getCacheStats = useCallback(() => {
    return fgaService.getCacheStats();
  }, []);

  const clearCache = useCallback(() => {
    fgaService.clearCache();
  }, []);

  const getAllPolicies = useCallback(async () => {
    return await fgaService.getAllPolicies();
  }, []);

  return {
    getCacheStats,
    clearCache,
    getAllPolicies
  };
}
