import React, { useState } from "react";
import PropTypes from "prop-types";
import { X } from "lucide-react";
import { LoginForm, RegisterForm, ForgotPasswordForm } from "./AuthForms";

export function AuthModal({ isOpen, onClose, defaultMode = "login" }) {
  const [mode, setMode] = useState(defaultMode);

  if (!isOpen) return null;

  const handleModeChange = (newMode) => {
    if (typeof newMode === "string") {
      setMode(newMode);
    } else {
      // Toggle between login and register if called without parameter
      setMode(mode === "login" ? "register" : "login");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Content */}
        <div className="p-8">
          {mode === "login" && (
            <LoginForm onToggleMode={handleModeChange} onClose={onClose} />
          )}
          {mode === "register" && (
            <RegisterForm onToggleMode={handleModeChange} onClose={onClose} />
          )}
          {mode === "forgot" && (
            <ForgotPasswordForm onToggleMode={handleModeChange} />
          )}
        </div>
      </div>
    </div>
  );
}

AuthModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  defaultMode: PropTypes.oneOf(["login", "register", "forgot"]),
};

export default AuthModal;
