// cSpell:ignore Firestore
import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Mail, Bell, Clock, Check } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export function NotificationSettings() {
  const { userProfile, updateUserProfile } = useAuth();
  const [settings, setSettings] = useState({
    emailNotifications: true,
    documentReminders: true,
    statusUpdates: true,
    reminderFrequency: "daily", // daily, weekly, never
    completionNotifications: true,
    signatureRequests: true,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (userProfile?.settings?.notifications) {
      setSettings((prevSettings) => ({
        ...prevSettings,
        ...userProfile.settings.notifications,
      }));
    }
  }, [userProfile]);

  const handleToggle = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleFrequencyChange = (frequency) => {
    setSettings((prev) => ({
      ...prev,
      reminderFrequency: frequency,
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setSuccess(false);

    try {
      const updatedSettings = {
        settings: {
          ...userProfile?.settings,
          notifications: settings,
        },
      };

      await updateUserProfile(updatedSettings);
      setSuccess(true);

      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving notification settings:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center mb-6">
        <Bell className="w-6 h-6 text-indigo-600 mr-3" />
        <h3 className="text-lg font-semibold text-gray-900">
          Email Notifications
        </h3>
      </div>

      <div className="space-y-6">
        {/* Master Email Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Mail className="w-5 h-5 text-gray-400 mr-3" />
            <div>
              <label
                htmlFor="email-notifications"
                className="text-sm font-medium text-gray-900"
              >
                Email Notifications
              </label>
              <p className="text-sm text-gray-500">
                Receive email notifications for RhodeSign activities
              </p>
            </div>
          </div>
          <button
            id="email-notifications"
            onClick={() => handleToggle("emailNotifications")}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.emailNotifications ? "bg-indigo-600" : "bg-gray-200"
            }`}
            aria-label="Toggle email notifications"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.emailNotifications ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {settings.emailNotifications && (
          <div className="ml-8 space-y-4 border-l-2 border-gray-100 pl-4">
            {/* Signature Requests */}
            <div className="flex items-center justify-between">
              <div>
                <label
                  htmlFor="signature-requests"
                  className="text-sm font-medium text-gray-700"
                >
                  Signature Requests
                </label>
                <p className="text-sm text-gray-500">
                  When someone requests your signature
                </p>
              </div>
              <button
                id="signature-requests"
                onClick={() => handleToggle("signatureRequests")}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  settings.signatureRequests ? "bg-indigo-600" : "bg-gray-200"
                }`}
                aria-label="Toggle signature request notifications"
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    settings.signatureRequests
                      ? "translate-x-5"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Status Updates */}
            <div className="flex items-center justify-between">
              <div>
                <label
                  htmlFor="status-updates"
                  className="text-sm font-medium text-gray-700"
                >
                  Status Updates
                </label>
                <p className="text-sm text-gray-500">
                  When documents are signed or completed
                </p>
              </div>
              <button
                id="status-updates"
                onClick={() => handleToggle("statusUpdates")}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  settings.statusUpdates ? "bg-indigo-600" : "bg-gray-200"
                }`}
                aria-label="Toggle status update notifications"
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    settings.statusUpdates ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Completion Notifications */}
            <div className="flex items-center justify-between">
              <div>
                <label
                  htmlFor="completion-notifications"
                  className="text-sm font-medium text-gray-700"
                >
                  Completion Notifications
                </label>
                <p className="text-sm text-gray-500">
                  When all parties have signed a document
                </p>
              </div>
              <button
                id="completion-notifications"
                onClick={() => handleToggle("completionNotifications")}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  settings.completionNotifications
                    ? "bg-indigo-600"
                    : "bg-gray-200"
                }`}
                aria-label="Toggle completion notifications"
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    settings.completionNotifications
                      ? "translate-x-5"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Document Reminders */}
            <div className="flex items-center justify-between">
              <div>
                <label
                  htmlFor="document-reminders"
                  className="text-sm font-medium text-gray-700"
                >
                  Document Reminders
                </label>
                <p className="text-sm text-gray-500">
                  Reminder emails for pending signatures
                </p>
              </div>
              <button
                id="document-reminders"
                onClick={() => handleToggle("documentReminders")}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  settings.documentReminders ? "bg-indigo-600" : "bg-gray-200"
                }`}
                aria-label="Toggle document reminder notifications"
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    settings.documentReminders
                      ? "translate-x-5"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Reminder Frequency */}
            {settings.documentReminders && (
              <div className="ml-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center mb-2">
                  <Clock className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm font-medium text-gray-700">
                    Reminder Frequency
                  </span>
                </div>
                <div className="space-y-2">
                  {[
                    { value: "daily", label: "Daily reminders" },
                    { value: "weekly", label: "Weekly reminders" },
                    { value: "never", label: "No automatic reminders" },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center">
                      <input
                        type="radio"
                        name="reminderFrequency"
                        value={option.value}
                        checked={settings.reminderFrequency === option.value}
                        onChange={() => handleFrequencyChange(option.value)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-600">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save Button */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center">
            {success && (
              <div className="flex items-center text-green-600 text-sm">
                <Check className="w-4 h-4 mr-1" />
                Settings saved successfully
              </div>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmailPreview({ type = "signature_request" }) {
  const [templateData] = useState({
    signature_request: {
      signerName: "John Doe",
      requesterName: "Jane Smith",
      documentTitle: "Service Agreement Contract",
      signingUrl: "#preview",
      expirationDate: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
    },
    document_signed: {
      recipientName: "Jane Smith",
      signerName: "John Doe",
      documentTitle: "Service Agreement Contract",
      signedAt: new Date().toLocaleDateString(),
      remainingSigners: 1,
      isComplete: false,
    },
    document_completed: {
      recipientName: "Jane Smith",
      documentTitle: "Service Agreement Contract",
      completedAt: new Date().toLocaleDateString(),
      downloadUrl: "#preview",
    },
    reminder: {
      signerName: "John Doe",
      requesterName: "Jane Smith",
      documentTitle: "Service Agreement Contract",
      signingUrl: "#preview",
      daysOverdue: 3,
    },
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Email Preview</h3>
        <select
          value={type}
          className="text-sm border border-gray-300 rounded px-2 py-1"
          disabled
        >
          <option value="signature_request">Signature Request</option>
          <option value="document_signed">Document Signed</option>
          <option value="document_completed">Document Completed</option>
          <option value="reminder">Reminder</option>
        </select>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 text-center">
          <h1 className="text-xl font-bold">RhodeSign</h1>
        </div>
        <div className="p-6 bg-gray-50">
          <div className="bg-white p-4 rounded shadow-sm">
            {type === "signature_request" && (
              <div>
                <h2 className="text-lg font-semibold mb-2">
                  Hello {templateData.signature_request.signerName},
                </h2>
                <p className="mb-4">
                  You have been requested to review and sign a document.
                </p>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-4">
                  <p>
                    <strong>Document:</strong>{" "}
                    {templateData.signature_request.documentTitle}
                  </p>
                  <p>
                    <strong>Requested by:</strong>{" "}
                    {templateData.signature_request.requesterName}
                  </p>
                </div>
                <button className="bg-indigo-600 text-white px-4 py-2 rounded font-medium">
                  Review & Sign Document
                </button>
              </div>
            )}
            {/* Add other template previews as needed */}
          </div>
        </div>
      </div>
    </div>
  );
}

NotificationSettings.propTypes = {};
EmailPreview.propTypes = {
  type: PropTypes.oneOf([
    "signature_request",
    "document_signed",
    "document_completed",
    "reminder",
  ]),
};

export default NotificationSettings;
