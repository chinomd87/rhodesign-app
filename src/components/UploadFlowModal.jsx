import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import {
  FileText,
  UploadCloud,
  X,
  UserPlus,
  MapPin,
  Send,
  Trash2,
} from "lucide-react";
import { DocumentService } from "../services/documentService";
import { useAuth } from "../hooks/useAuth";
// cSpell:ignore uuidv
import { v4 as uuidv4 } from "uuid";

// Enhanced UploadFlowModal with Firebase integration
function UploadFlowModal({ onClose }) {
  const { user, userProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [signers, setSigners] = useState([
    { id: uuidv4(), name: "", email: "", order: 0 },
  ]);
  const [message, setMessage] = useState(
    "Please review and sign this document."
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const droppedFile = e.dataTransfer.files[0];
        setFile(droppedFile);
        if (!documentTitle) {
          setDocumentTitle(droppedFile.name.replace(/\.[^/.]+$/, ""));
        }
        e.dataTransfer.clearData();
      }
    },
    [documentTitle]
  );

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!documentTitle) {
        setDocumentTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const addSigner = () => {
    setSigners((prev) => [
      ...prev,
      {
        id: uuidv4(),
        name: "",
        email: "",
        order: prev.length,
      },
    ]);
  };

  const removeSigner = (id) => {
    setSigners((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSigner = (id, field, value) => {
    setSigners((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const validateStep = (stepNumber) => {
    switch (stepNumber) {
      case 1:
        return file !== null;
      case 2:
        return signers.every((s) => s.name.trim() && s.email.trim());
      case 3:
        return true; // Field placement will be optional for now
      case 4:
        return documentTitle.trim() !== "";
      default:
        return false;
    }
  };

  const handleSendDocument = async () => {
    try {
      setUploading(true);
      setError(null);

      // For demo purposes, we'll use a mock user ID
      const userId = "demo-user-123";

      // Upload the document file
      const uploadResult = await DocumentService.uploadDocument(file, userId);

      // Create the document record
      const documentData = {
        title: documentTitle,
        originalFileName: file.name,
        fileUrl: uploadResult.fileUrl,
        status: "draft",
        signers: signers.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          status: "pending",
          order: s.order,
        })),
        fields: [], // For Phase 1, we'll add basic signature fields
        message: message,
      };

      const documentId = await DocumentService.createDocument(
        documentData,
        userId
      );

      // Add default signature fields for each signer
      // In a real implementation, this would be done in Step 3
      for (const signer of signers) {
        await DocumentService.addField(
          documentId,
          {
            type: "signature",
            x: 100,
            y: 500,
            width: 200,
            height: 50,
            page: 1,
            signerId: signer.id,
            required: true,
          },
          userId
        );
      }

      // Send for signature with user information for email notifications
      await DocumentService.sendForSignature(
        documentId,
        userId,
        userProfile?.displayName || user?.displayName || user?.email,
        user?.email
      );

      alert(
        "Document sent successfully! Email notifications have been sent to all signers."
      );
      onClose();
    } catch (err) {
      console.error("Error sending document:", err);
      setError("Failed to send document. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const steps = [
    { number: 1, title: "Upload Document", icon: FileText },
    { number: 2, title: "Add Recipients", icon: UserPlus },
    { number: 3, title: "Place Fields", icon: MapPin },
    { number: 4, title: "Review & Send", icon: Send },
  ];

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <Step1Upload
            file={file}
            setFile={setFile}
            onFileChange={handleFileChange}
            onFileDrop={handleFileDrop}
            documentTitle={documentTitle}
            setDocumentTitle={setDocumentTitle}
          />
        );
      case 2:
        return (
          <Step2Recipients
            signers={signers}
            addSigner={addSigner}
            removeSigner={removeSigner}
            updateSigner={updateSigner}
          />
        );
      case 3:
        return <Step3PlaceFields fileName={file?.name} />;
      case 4:
        return (
          <Step4Review
            documentTitle={documentTitle}
            signers={signers}
            message={message}
            setMessage={setMessage}
            file={file}
          />
        );
      default:
        return null;
    }
  };

  return (
    // Drag and drop functionality for file upload - Sonar S6848 is acceptable here
    // The accessibility warning is acceptable as this is a file drop zone overlay
    // that provides necessary drag-and-drop functionality for file uploads
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
    >
      {/* Modal backdrop button for closing */}
      <button
        className="absolute inset-0 w-full h-full bg-transparent border-0 cursor-default focus:outline-none"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onClose();
          }
        }}
        aria-label="Close modal"
        style={{ background: "transparent" }}
      />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 id="modal-title" className="text-xl font-semibold text-gray-800">
            New Signature Request
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </header>

        <div className="flex-1 flex p-8 gap-8 overflow-y-auto">
          {/* Sidebar */}
          <div className="w-1/4">
            <ol className="space-y-4">
              {steps.map((s) => (
                <li key={s.number} className="flex items-center">
                  <span
                    className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                      step >= s.number
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {s.number}
                  </span>
                  <span
                    className={`ml-3 text-sm font-medium ${
                      step >= s.number ? "text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {s.title}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Main Content */}
          <div className="w-3/4 border-l border-gray-200 pl-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            {renderStepContent()}
          </div>
        </div>

        <footer className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={() => {
              if (step < 4) {
                setStep((s) => s + 1);
              } else {
                handleSendDocument();
              }
            }}
            disabled={!validateStep(step) || uploading}
            className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {(() => {
              if (uploading) return "Sending...";
              return step === 4 ? "Send Document" : "Next";
            })()}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Step1Upload({
  file,
  setFile,
  onFileChange,
  onFileDrop,
  documentTitle,
  setDocumentTitle,
}) {
  return (
    <section
      aria-label="File upload area"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onFileDrop}
    >
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        Upload your document
      </h3>
      <p className="text-sm text-gray-500 mb-6">
        File will be converted to a secure, non-editable PDF.
      </p>

      <div className="mb-4">
        <label
          htmlFor="document-title"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Document Title
        </label>
        <input
          id="document-title"
          type="text"
          value={documentTitle}
          onChange={(e) => setDocumentTitle(e.target.value)}
          placeholder="Enter document title"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div className="w-full p-8 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-indigo-500 bg-gray-50 transition-colors">
        <input
          type="file"
          id="file-upload"
          className="hidden"
          onChange={onFileChange}
          accept=".pdf,.doc,.docx,.png,.jpg"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <UploadCloud className="w-12 h-12 mx-auto text-gray-400" />
          <p className="mt-4 text-sm font-semibold text-gray-700">
            <span className="text-indigo-600">Click to upload</span> or drag and
            drop
          </p>
          <p className="mt-1 text-xs text-gray-500">
            PDF, DOC, DOCX, PNG, JPG (up to 25MB)
          </p>
        </label>
      </div>

      {file && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <FileText className="w-6 h-6 text-green-700" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{file.name}</p>
              <p className="text-xs text-green-600">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <button
            onClick={() => setFile(null)}
            className="p-1 rounded-full hover:bg-green-100"
          >
            <X className="w-4 h-4 text-green-800" />
          </button>
        </div>
      )}
    </section>
  );
}

function Step2Recipients({ signers, addSigner, removeSigner, updateSigner }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        Add recipients
      </h3>
      <p className="text-sm text-gray-500 mb-6">
        Specify who needs to sign the document.
      </p>

      <div className="space-y-4">
        {signers.map((signer, index) => (
          <div
            key={signer.id}
            className="border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Signer {index + 1}
              </label>
              {signers.length > 1 && (
                <button
                  onClick={() => removeSigner(signer.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="Full Name"
              value={signer.name}
              onChange={(e) => updateSigner(signer.id, "name", e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm mb-2"
            />
            <input
              type="email"
              placeholder="Email Address"
              value={signer.email}
              onChange={(e) => updateSigner(signer.id, "email", e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
        ))}

        <button
          onClick={addSigner}
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add Another Recipient
        </button>
      </div>
    </div>
  );
}

function Step3PlaceFields({ fileName }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        Place signature fields
      </h3>
      <p className="text-sm text-gray-500 mb-6">
        For Phase 1, signature fields will be automatically placed. Advanced
        field placement coming in Phase 2.
      </p>

      <div className="w-full h-96 bg-gray-200 rounded-lg flex items-center justify-center">
        <div className="text-center p-4">
          <FileText className="w-16 h-16 text-gray-400 mx-auto" />
          <p className="mt-2 font-medium text-gray-700">
            {fileName || "document.pdf"}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Document preview and drag-and-drop field placement will be available
            in Phase 2.
          </p>
          <p className="mt-2 text-xs text-gray-400">
            For now, a signature field will be automatically added for each
            signer.
          </p>
        </div>
      </div>
    </div>
  );
}

function Step4Review({ documentTitle, signers, message, setMessage, file }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        Review & Send
      </h3>
      <p className="text-sm text-gray-500 mb-6">
        Review the details below before sending your document.
      </p>

      <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
        <div>
          <h4 className="font-semibold text-gray-700">Document:</h4>
          <p className="text-sm text-gray-600">{documentTitle}</p>
          <p className="text-xs text-gray-500">File: {file?.name}</p>
        </div>
        <div>
          <h4 className="font-semibold text-gray-700">Recipients:</h4>
          {signers.map((signer, index) => (
            <p key={signer.id} className="text-sm text-gray-600">
              {index + 1}. {signer.name} ({signer.email})
            </p>
          ))}
        </div>
        <div>
          <label htmlFor="message" className="font-semibold text-gray-700">
            Message to Recipients:
          </label>
          <textarea
            id="message"
            rows="3"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Please sign this document..."
          />
        </div>
      </div>
    </div>
  );
}

// PropTypes
UploadFlowModal.propTypes = {
  onClose: PropTypes.func.isRequired,
};

Step1Upload.propTypes = {
  file: PropTypes.object,
  setFile: PropTypes.func.isRequired,
  onFileChange: PropTypes.func.isRequired,
  onFileDrop: PropTypes.func.isRequired,
  documentTitle: PropTypes.string.isRequired,
  setDocumentTitle: PropTypes.func.isRequired,
};

Step2Recipients.propTypes = {
  signers: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      email: PropTypes.string.isRequired,
      order: PropTypes.number.isRequired,
    })
  ).isRequired,
  addSigner: PropTypes.func.isRequired,
  removeSigner: PropTypes.func.isRequired,
  updateSigner: PropTypes.func.isRequired,
};

Step3PlaceFields.propTypes = {
  fileName: PropTypes.string,
};

Step4Review.propTypes = {
  documentTitle: PropTypes.string.isRequired,
  signers: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      email: PropTypes.string.isRequired,
      order: PropTypes.number.isRequired,
    })
  ).isRequired,
  message: PropTypes.string.isRequired,
  setMessage: PropTypes.func.isRequired,
  file: PropTypes.object,
};

export default UploadFlowModal;
