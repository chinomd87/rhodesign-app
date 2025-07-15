import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileText, Clock, User, MapPin, Calendar } from "lucide-react";
import SignatureCanvas from "../components/SignatureCanvas";
import { SigningService } from "../services/signingService";

const SigningPage = () => {
  const { documentId, signerId } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [signer, setSigner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSignatureCanvas, setShowSignatureCanvas] = useState(false);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [fieldValues, setFieldValues] = useState({});
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    const loadDocumentForSigning = async () => {
      try {
        setLoading(true);
        const validation = await SigningService.validateSigningLink(
          documentId,
          signerId
        );

        if (!validation.valid) {
          setError(validation.reason);
          return;
        }

        setDocument(validation.document);
        setSigner(validation.signer);

        // Initialize field values
        const signerFields = validation.document.fields.filter(
          (f) => f.signerId === signerId
        );
        const initialValues = {};
        signerFields.forEach((field) => {
          if (field.type === "date") {
            initialValues[field.id] = new Date().toLocaleDateString();
          } else {
            initialValues[field.id] = "";
          }
        });
        setFieldValues(initialValues);
      } catch {
        setError("Failed to load document for signing");
      } finally {
        setLoading(false);
      }
    };

    loadDocumentForSigning();
  }, [documentId, signerId]);

  const getSignerFields = () => {
    if (!document) return [];
    return document.fields.filter((field) => field.signerId === signerId);
  };

  const handleFieldClick = (fieldIndex) => {
    const field = getSignerFields()[fieldIndex];

    if (field.type === "signature") {
      setCurrentFieldIndex(fieldIndex);
      setShowSignatureCanvas(true);
    }
  };

  const handleSignatureComplete = (signatureBlob) => {
    const field = getSignerFields()[currentFieldIndex];
    setFieldValues((prev) => ({
      ...prev,
      [field.id]: signatureBlob,
    }));
    setShowSignatureCanvas(false);
  };

  const handleTextFieldChange = (fieldId, value) => {
    setFieldValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const handleSubmitSignature = async () => {
    try {
      setSigning(true);

      // Prepare signature data
      const signatureData = {
        signatureBlob: null,
        text: "",
        date: new Date().toLocaleDateString(),
        initial: "",
      };

      // Process field values
      const signerFields = getSignerFields();
      signerFields.forEach((field) => {
        const value = fieldValues[field.id];
        if (field.type === "signature" && value instanceof Blob) {
          signatureData.signatureBlob = value;
        } else {
          signatureData[field.type] = value;
        }
      });

      // Get client info for audit trail
      const clientInfo = {
        ipAddress: "unknown", // In a real app, you'd get this from the server
        userAgent: navigator.userAgent,
      };

      const result = await SigningService.completeSignature(
        documentId,
        signerId,
        signatureData,
        clientInfo
      );

      if (result.success) {
        // Show success message and redirect
        alert("Document signed successfully!");
        navigate("/signature-complete");
      }
    } catch (err) {
      console.error("Error signing document:", err);
      setError("Failed to sign document. Please try again.");
    } finally {
      setSigning(false);
    }
  };

  const allFieldsCompleted = () => {
    const signerFields = getSignerFields();
    return signerFields.every((field) => {
      const value = fieldValues[field.id];
      if (field.required) {
        return (
          value && (typeof value === "string" ? value.trim() !== "" : true)
        );
      }
      return true;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Unable to Sign Document
          </h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const signerFields = getSignerFields();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Sign Document
              </h1>
              <p className="text-gray-600 mt-1">
                {document?.title || document?.originalFileName}
              </p>
            </div>
            <div className="flex items-center text-sm text-gray-500">
              <Clock className="w-4 h-4 mr-1" />
              Requested by {signer?.name}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Document Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Document Preview</h2>

              {/* Placeholder for PDF viewer */}
              <div className="w-full bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 p-8">
                <div className="text-center">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">
                    Document: {document?.originalFileName}
                  </p>
                  <p className="text-sm text-gray-500">
                    PDF viewer and field placement will appear here
                  </p>

                  {/* Show clickable field areas */}
                  {signerFields.map((field, index) => (
                    <div key={field.id} className="mt-4">
                      <button
                        onClick={() => handleFieldClick(index)}
                        className={`inline-flex items-center px-4 py-2 rounded-lg border-2 border-dashed transition-colors ${
                          fieldValues[field.id]
                            ? "border-green-500 bg-green-50 text-green-700"
                            : "border-indigo-500 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        }`}
                      >
                        {field.type === "signature" && (
                          <User className="w-4 h-4 mr-2" />
                        )}
                        {field.type === "date" && (
                          <Calendar className="w-4 h-4 mr-2" />
                        )}
                        {field.type === "text" && (
                          <MapPin className="w-4 h-4 mr-2" />
                        )}
                        {field.type === "initial" && (
                          <User className="w-4 h-4 mr-2" />
                        )}

                        {fieldValues[field.id]
                          ? `${field.type} (completed)`
                          : `Click to ${field.type}`}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Signing Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
              <h2 className="text-lg font-semibold mb-4">Signature Required</h2>

              <div className="space-y-4 mb-6">
                {signerFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="border border-gray-200 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {field.type}
                      </span>
                      {fieldValues[field.id] && (
                        <span className="text-xs text-green-600 font-medium">
                          ✓ Complete
                        </span>
                      )}
                    </div>

                    {field.type === "signature" ? (
                      <button
                        onClick={() => handleFieldClick(index)}
                        className="w-full py-2 text-sm text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50"
                      >
                        {fieldValues[field.id]
                          ? "Update Signature"
                          : "Add Signature"}
                      </button>
                    ) : (
                      <>
                        {field.type === "date" ? (
                          <input
                            type="date"
                            value={fieldValues[field.id]}
                            onChange={(e) =>
                              handleTextFieldChange(field.id, e.target.value)
                            }
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          <input
                            type="text"
                            value={fieldValues[field.id]}
                            onChange={(e) =>
                              handleTextFieldChange(field.id, e.target.value)
                            }
                            placeholder={`Enter ${field.type}`}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {document?.message && (
                <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">{document.message}</p>
                </div>
              )}

              <button
                onClick={handleSubmitSignature}
                disabled={!allFieldsCompleted() || signing}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {signing ? "Signing..." : "Complete Signature"}
              </button>

              <p className="text-xs text-gray-500 mt-3 text-center">
                By signing, you agree that your signature is legally binding.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Canvas Modal */}
      {showSignatureCanvas && (
        <SignatureCanvas
          onSignatureComplete={handleSignatureComplete}
          onCancel={() => setShowSignatureCanvas(false)}
        />
      )}
    </div>
  );
};

export default SigningPage;
