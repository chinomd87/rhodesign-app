import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import NotificationSettings from "./NotificationSettings";
import {
  User,
  Mail,
  Calendar,
  Settings,
  Save,
  Loader,
  Camera,
} from "lucide-react";

export function UserProfile() {
  const { user, userProfile, updateUserProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    displayName: userProfile?.displayName || "",
    settings: {
      emailNotifications: userProfile?.settings?.emailNotifications ?? true,
      documentReminders: userProfile?.settings?.documentReminders ?? true,
      theme: userProfile?.settings?.theme || "light",
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateUserProfile(formData);
      setEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.startsWith("settings.")) {
      const settingName = name.replace("settings.", "");
      setFormData((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          [settingName]: type === "checkbox" ? checked : value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString();
    }
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-8">
          <div className="flex items-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-white" />
                )}
              </div>
              <button className="absolute bottom-0 right-0 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-shadow">
                <Camera className="w-3 h-3 text-gray-600" />
              </button>
            </div>
            <div className="ml-6">
              <h1 className="text-2xl font-bold text-white">
                {userProfile?.displayName || "User"}
              </h1>
              <p className="text-indigo-100">{user?.email}</p>
              <div className="mt-2 flex items-center text-indigo-100 text-sm">
                <Calendar className="w-4 h-4 mr-1" />
                Member since {formatDate(userProfile?.createdAt)}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {editing ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="displayName"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Display Name
                </label>
                <input
                  type="text"
                  id="displayName"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Preferences
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label
                        htmlFor="emailNotifications"
                        className="text-sm font-medium text-gray-700"
                      >
                        Email Notifications
                      </label>
                      <p className="text-sm text-gray-500">
                        Receive email updates about your documents
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      id="emailNotifications"
                      name="settings.emailNotifications"
                      checked={formData.settings.emailNotifications}
                      onChange={handleChange}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label
                        htmlFor="documentReminders"
                        className="text-sm font-medium text-gray-700"
                      >
                        Document Reminders
                      </label>
                      <p className="text-sm text-gray-500">
                        Get reminded about pending signatures
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      id="documentReminders"
                      name="settings.documentReminders"
                      checked={formData.settings.documentReminders}
                      onChange={handleChange}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="theme"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Theme
                    </label>
                    <select
                      id="theme"
                      name="settings.theme"
                      value={formData.settings.theme}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-medium hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Account Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <Mail className="w-5 h-5 text-gray-500 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Email</p>
                      <p className="text-sm text-gray-900">{user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <User className="w-5 h-5 text-gray-500 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Plan</p>
                      <p className="text-sm text-gray-900 capitalize">
                        {userProfile?.plan || "Free"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Current Preferences
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">
                      Email Notifications
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        userProfile?.settings?.emailNotifications
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {userProfile?.settings?.emailNotifications
                        ? "Enabled"
                        : "Disabled"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">
                      Document Reminders
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        userProfile?.settings?.documentReminders
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {userProfile?.settings?.documentReminders
                        ? "Enabled"
                        : "Disabled"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">
                      Theme
                    </span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium capitalize">
                      {userProfile?.settings?.theme || "Light"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setEditing(true)}
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700"
              >
                Edit Profile
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notification Settings */}
      <div className="mt-6">
        <NotificationSettings />
      </div>
    </div>
  );
}

export default UserProfile;
