// FGA-aware Document Component with authorization checks
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FileText, Edit, Trash2, Send, Eye, Shield } from 'lucide-react';
import { useDocumentPermissions, PermissionGate } from '../../authorization/hooks/useFGA.js';
import { Permissions } from '../../authorization/models/index.js';

function SecureDocumentCard({ document, onEdit, onDelete, onSend, onView }) {
  const {
    canRead,
    canEdit,
    canDelete,
    canSend,
    canAudit
  } = useDocumentPermissions(document.id);

  const [permissions, setPermissions] = useState({
    read: false,
    edit: false,
    delete: false,
    send: false,
    audit: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const [readResult, editResult, deleteResult, sendResult, auditResult] = await Promise.all([
          canRead(),
          canEdit(),
          canDelete(),
          canSend(),
          canAudit()
        ]);

        setPermissions({
          read: readResult.allowed,
          edit: editResult.allowed,
          delete: deleteResult.allowed,
          send: sendResult.allowed,
          audit: auditResult.allowed
        });
      } catch (error) {
        console.error('Failed to check permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    checkPermissions();
  }, [canRead, canEdit, canDelete, canSend, canAudit]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
      </div>
    );
  }

  if (!permissions.read) {
    return (
      <div className="bg-gray-100 rounded-lg shadow-md p-6 border-2 border-dashed border-gray-300">
        <div className="flex items-center justify-center text-gray-500">
          <Shield className="w-8 h-8 mr-2" />
          <span>Access Restricted</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {document.title}
          </h3>
          <p className="text-sm text-gray-600 mb-2">
            Status: <span className="capitalize">{document.status}</span>
          </p>
          <p className="text-sm text-gray-500">
            Created: {new Date(document.createdAt?.toDate?.() || document.createdAt).toLocaleDateString()}
          </p>
          {document.signers && (
            <p className="text-sm text-gray-500">
              Signers: {document.signers.length}
            </p>
          )}
        </div>
        
        <div className="flex space-x-2">
          {/* View Button - Always shown if user can read */}
          <button
            onClick={() => onView(document.id)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="View Document"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Edit Button - Only shown if user can edit */}
          <PermissionGate 
            permission={Permissions.DOCUMENT_UPDATE} 
            resourceId={document.id}
          >
            <button
              onClick={() => onEdit(document.id)}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Edit Document"
            >
              <Edit className="w-4 h-4" />
            </button>
          </PermissionGate>

          {/* Send Button - Only shown if user can send and document is draft */}
          <PermissionGate 
            permission={Permissions.DOCUMENT_SEND} 
            resourceId={document.id}
          >
            {document.status === 'draft' && (
              <button
                onClick={() => onSend(document.id)}
                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Send for Signature"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </PermissionGate>

          {/* Delete Button - Only shown if user can delete */}
          <PermissionGate 
            permission={Permissions.DOCUMENT_DELETE} 
            resourceId={document.id}
          >
            <button
              onClick={() => onDelete(document.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete Document"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Permission indicators for debugging (remove in production) */}
      {import.meta.env.DEV && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(permissions).map(([perm, allowed]) => (
              <span
                key={perm}
                className={`px-2 py-1 rounded ${
                  allowed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {perm}: {allowed ? '✓' : '✗'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

SecureDocumentCard.propTypes = {
  document: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    createdAt: PropTypes.oneOfType([
      PropTypes.instanceOf(Date),
      PropTypes.object
    ]).isRequired,
    signers: PropTypes.array
  }).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onSend: PropTypes.func.isRequired,
  onView: PropTypes.func.isRequired
};

export default SecureDocumentCard;
