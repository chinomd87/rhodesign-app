// cSpell:ignore Firestore
import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Bell,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { NotificationService } from "../services/notificationService";

export function NotificationDashboard({ documentId }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadNotifications = async () => {
      if (!documentId) return;

      try {
        setLoading(true);
        const notificationHistory =
          await NotificationService.getDocumentNotifications(documentId);
        setNotifications(notificationHistory);
      } catch (err) {
        setError("Failed to load notification history");
        console.error("Error loading notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [documentId]);

  const getStatusIcon = (status) => {
    switch (status) {
      case "sent":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <RotateCcw className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      signature_request: "Signature Request",
      document_signed: "Document Signed",
      document_completed: "Document Completed",
      reminder: "Reminder",
      document_declined: "Document Declined",
      document_expired: "Document Expired",
    };
    return labels[type] || type;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "Unknown";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    } catch {
      return "Invalid date";
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Bell className="w-5 h-5 text-indigo-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">
            Email Notifications
          </h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2 text-gray-600">Loading notifications...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Bell className="w-5 h-5 text-indigo-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">
            Email Notifications
          </h3>
        </div>
        <div className="text-center py-8">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center mb-4">
        <Bell className="w-5 h-5 text-indigo-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">
          Email Notifications
        </h3>
        <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
          {notifications.length} sent
        </span>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-8">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No email notifications sent yet</p>
          <p className="text-sm text-gray-400">
            Notifications will appear here when emails are sent
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="flex items-start p-3 bg-gray-50 rounded-lg border border-gray-100"
            >
              <div className="flex-shrink-0 mr-3 mt-1">
                {getStatusIcon(notification.status)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900">
                    {getTypeLabel(notification.type)}
                  </h4>
                  <span className="text-xs text-gray-500">
                    {formatDate(notification.createdAt)}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mt-1">
                  To: {notification.recipientEmail}
                  {notification.recipientName &&
                    notification.recipientName !==
                      notification.recipientEmail && (
                      <span className="text-gray-500">
                        {" "}
                        ({notification.recipientName})
                      </span>
                    )}
                </p>

                {notification.status === "failed" && notification.error && (
                  <p className="text-sm text-red-600 mt-1">
                    Error: {notification.error}
                  </p>
                )}

                {notification.sentAt && (
                  <p className="text-xs text-gray-500 mt-1">
                    Sent: {formatDate(notification.sentAt)}
                  </p>
                )}
              </div>

              <div className="flex-shrink-0 ml-2">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    notification.status === "sent"
                      ? "bg-green-100 text-green-800"
                      : notification.status === "failed"
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {notification.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

NotificationDashboard.propTypes = {
  documentId: PropTypes.string.isRequired,
};

export default NotificationDashboard;
