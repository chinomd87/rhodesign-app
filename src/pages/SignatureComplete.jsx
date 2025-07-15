import React from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, ArrowRight, FileText } from "lucide-react";

function SignatureComplete() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Signature Complete!
          </h1>
          <p className="text-gray-600">
            Your signature has been successfully recorded and the document has
            been processed.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-center mb-2">
              <FileText className="w-5 h-5 text-gray-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">
                What happens next?
              </span>
            </div>
            <p className="text-sm text-gray-600">
              You'll receive an email confirmation with a copy of the signed
              document. The document owner will also be notified of your
              signature.
            </p>
          </div>

          <button
            onClick={() => navigate("/")}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center"
          >
            Return to Home
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            This document was processed securely by RhodeSign
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignatureComplete;
