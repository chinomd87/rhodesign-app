import React, { useState } from "react";
import PropTypes from "prop-types";
import { CheckCircle, FileText, Users, Shield, ArrowRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export function WelcomeModal({ isOpen, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const { user, updateUserProfile } = useAuth();

  const steps = [
    {
      title: "Welcome to RhodeSign!",
      description: "Your secure digital signature platform",
      icon: <CheckCircle className="w-16 h-16 text-green-500" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Hi {user?.displayName || "there"}! We're excited to have you on
            board. RhodeSign makes it easy to create, send, and manage digital
            signatures for your documents.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <FileText className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <h4 className="font-medium text-gray-900">Upload Documents</h4>
              <p className="text-sm text-gray-600">
                Securely upload PDF documents
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <h4 className="font-medium text-gray-900">Add Signers</h4>
              <p className="text-sm text-gray-600">Invite people to sign</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Shield className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <h4 className="font-medium text-gray-900">Track Progress</h4>
              <p className="text-sm text-gray-600">Monitor signing status</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Getting Started",
      description: "Let's create your first document",
      icon: <FileText className="w-16 h-16 text-blue-500" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Ready to send your first document for signature? Here's how easy it
            is:
          </p>
          <div className="space-y-3">
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                1
              </div>
              <div>
                <h4 className="font-medium text-gray-900">
                  Upload your document
                </h4>
                <p className="text-sm text-gray-600">
                  Choose a PDF file from your device
                </p>
              </div>
            </div>
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                2
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Add signers</h4>
                <p className="text-sm text-gray-600">
                  Enter email addresses of people who need to sign
                </p>
              </div>
            </div>
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                3
              </div>
              <div>
                <h4 className="font-medium text-gray-900">
                  Send for signatures
                </h4>
                <p className="text-sm text-gray-600">
                  We'll notify signers and track progress
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "You're All Set!",
      description: "Ready to start signing documents",
      icon: <CheckCircle className="w-16 h-16 text-green-500" />,
      content: (
        <div className="space-y-4 text-center">
          <p className="text-gray-600">
            Your account is ready! You can now create and manage documents,
            invite signers, and track the signing process.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">Quick Tips:</h4>
            <ul className="text-sm text-green-800 space-y-1 text-left">
              <li>• Use the "Upload Document" button to get started</li>
              <li>• Check your dashboard to see document status</li>
              <li>• Visit Settings to customize your profile</li>
              <li>• All documents are encrypted and secure</li>
            </ul>
          </div>
        </div>
      ),
    },
  ];

  const currentStepData = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    // Mark user as having completed onboarding
    try {
      await updateUserProfile({
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      });
      onClose();
    } catch (error) {
      console.error("Error completing onboarding:", error);
      onClose(); // Close anyway to not block the user
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative">
        {/* Progress indicator */}
        <div className="flex justify-center pt-6 pb-4">
          <div className="flex space-x-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index <= currentStep ? "bg-blue-500" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-8 pb-8">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              {currentStepData.icon}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {currentStepData.title}
            </h2>
            <p className="text-gray-600">{currentStepData.description}</p>
          </div>

          <div className="mb-8">{currentStepData.content}</div>

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <button
              onClick={handleNext}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center"
            >
              {currentStep === steps.length - 1 ? (
                "Get Started"
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

WelcomeModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default WelcomeModal;
