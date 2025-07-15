// cSpell:ignore Firestore
import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  FilePlus2,
  FileText,
  LayoutTemplate,
  Settings,
  User,
  ArrowRight,
  UploadCloud,
  LogOut,
} from "lucide-react";
import { useAuth } from "./contexts/AuthContext";
import UploadFlowModal from "./components/UploadFlowModal";
import DocumentsDashboard from "./components/DocumentsDashboard";
import FirebaseConnectionTest from "./components/FirebaseConnectionTest";
import UserProfile from "./components/UserProfile";
import WelcomeModal from "./components/WelcomeModal";

// --- Main App Component ---
export default function App() {
  const [view, setView] = useState("dashboard");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const { user, userProfile, loading } = useAuth();

  // Show welcome modal for new users
  useEffect(() => {
    if (user && userProfile && !userProfile.onboardingCompleted) {
      setShowWelcomeModal(true);
    }
  }, [user, userProfile]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (view) {
      case "documents":
        return <DocumentsDashboard userId={user?.uid} />;
      case "templates":
        return <TemplatesView setView={setView} />;
      case "settings":
        return <UserProfile />;
      case "dashboard":
      default:
        return (
          <Dashboard
            setView={setView}
            openUploadModal={() => setIsUploadModalOpen(true)}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar view={view} setView={setView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header openUploadModal={() => setIsUploadModalOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
          <div className="container mx-auto px-6 py-8">{renderView()}</div>
        </main>
      </div>
      {isUploadModalOpen && (
        <UploadFlowModal onClose={() => setIsUploadModalOpen(false)} />
      )}
      {showWelcomeModal && (
        <WelcomeModal
          isOpen={showWelcomeModal}
          onClose={() => setShowWelcomeModal(false)}
        />
      )}
    </div>
  );
}

// --- Layout Components ---

function Sidebar({ view, setView }) {
  const { user, userProfile, logout } = useAuth();

  const navItems = [
    { id: "dashboard", icon: FilePlus2, label: "Start Signing" },
    { id: "documents", icon: FileText, label: "Documents" },
    { id: "templates", icon: LayoutTemplate, label: "Templates" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="h-16 flex items-center justify-center border-b border-gray-200">
        <h1 className="text-2xl font-bold text-indigo-600">RhodeSign</h1>
      </div>
      <nav className="flex-1 px-4 py-4">
        <ul>
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setView(item.id)}
                className={`w-full flex items-center px-4 py-2 text-gray-700 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors duration-200 ${
                  view === item.id
                    ? "bg-indigo-50 text-indigo-600 font-semibold"
                    : ""
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="ml-3">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="px-4 py-4 border-t border-gray-200">
        <div className="flex items-center mb-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <User className="w-6 h-6 text-indigo-600" />
            )}
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-semibold text-gray-800">
              {userProfile?.displayName || user?.displayName || "User"}
            </p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

function Header({ openUploadModal }) {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-end px-6">
      <button
        onClick={openUploadModal}
        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-colors duration-200 flex items-center"
      >
        New Request
        <ArrowRight className="w-4 h-4 ml-2" />
      </button>
    </header>
  );
}

// --- View Components ---

function Dashboard({ setView, openUploadModal }) {
  const { user, userProfile } = useAuth();
  const displayName =
    userProfile?.displayName ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "there";

  return (
    <div>
      <h2 className="text-3xl font-semibold text-gray-800">
        Welcome back, {displayName}
      </h2>
      <p className="text-gray-500 mt-1">
        Ready to get a document signed? Start a new signature request.
      </p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* New Signature Request Card */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">
              New Signature Request
            </h3>
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FilePlus2 className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Upload a document and add signers to start the process.
          </p>
          <button
            onClick={openUploadModal}
            className="mt-4 w-full bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-colors duration-200 flex items-center justify-center"
          >
            <UploadCloud className="w-4 h-4 mr-2" />
            Upload & Send
          </button>
        </div>

        {/* Use a Template Card */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Use a Template</h3>
            <div className="p-2 bg-teal-100 rounded-lg">
              <LayoutTemplate className="w-6 h-6 text-teal-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Save time by using one of your pre-configured templates.
          </p>
          <button
            onClick={() => setView("templates")}
            className="mt-4 w-full bg-teal-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-teal-700 transition-colors duration-200 flex items-center justify-center"
          >
            Browse Templates
          </button>
        </div>
      </div>

      <div className="mt-10">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">
          Firebase Connection Status
        </h3>
        <FirebaseConnectionTest />
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">
          Recent Activity
        </h3>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-center text-gray-500 py-8">
            No recent activity to display.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Placeholder View Components ---

function TemplatesView() {
  return (
    <div>
      <h2 className="text-3xl font-semibold text-gray-800">Templates</h2>
      <p className="text-gray-500 mt-1">
        Create and manage reusable document templates.
      </p>
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <p className="text-center text-gray-500 py-16">
          Your templates will appear here.
        </p>
      </div>
    </div>
  );
}
function SettingsView() {
  return (
    <div>
      <h2 className="text-3xl font-semibold text-gray-800">Settings</h2>
      <p className="text-gray-500 mt-1">
        Manage your account and platform settings.
      </p>
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <p className="text-center text-gray-500 py-16">
          Account settings will appear here.
        </p>
      </div>
    </div>
  );
}

// PropTypes
Sidebar.propTypes = {
  view: PropTypes.string.isRequired,
  setView: PropTypes.func.isRequired,
};

Header.propTypes = {
  openUploadModal: PropTypes.func.isRequired,
};

Dashboard.propTypes = {
  setView: PropTypes.func.isRequired,
  openUploadModal: PropTypes.func.isRequired,
};
