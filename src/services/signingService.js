// cSpell:ignore Firestore uuidv
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { DocumentService } from "./documentService";
import { NotificationService } from "./notificationService";
import { SignerStatus } from "../models";
import { v4 as uuidv4 } from "uuid";
// FGA Integration
import fgaService from "../authorization/FGAService.js";
import { Permissions } from "../authorization/models/index.js";

export class SigningService {
  // Enhanced validate signing link with FGA
  static async validateSigningLink(documentId, signerId) {
    try {
      const document = await DocumentService.getDocument(documentId);

      // Check if the signer is authorized using FGA
      const authResult = await fgaService.authorize(signerId, Permissions.DOCUMENT_SIGN, documentId, 'document');
      if (authResult.decision !== 'allow') {
        return {
          valid: false,
          reason: `Access denied: ${authResult.reason}`
        };
      }

      // Check if the signer is in the document's signer list
      const signer = document.signers?.find((s) => s.id === signerId);
      if (!signer) {
        return {
          valid: false,
          reason: "Signer not found in document"
        };
      }

      // Check document status
      if (document.status !== 'out_for_signature' && document.status !== 'draft') {
        return {
          valid: false,
          reason: "Document is not available for signing"
        };
      }

      return {
        valid: true,
        document,
        signer
      };
    } catch (error) {
      console.error("Error validating signing link:", error);
      return {
        valid: false,
        reason: "Failed to validate signing link"
      };
    }
  }

  // Get document for signing by signer ID
  static async getDocumentForSigning(documentId, signerId) {
    try {
      // Validate signing permissions
      const validation = await this.validateSigningLink(documentId, signerId);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      const document = validation.document;
      const signer = validation.signer;

      // Add audit trail entry for document viewed
      await DocumentService.addAuditTrailEntry(documentId, "document_viewed", {
        signerId,
        signerEmail: signer.email,
        viewedAt: new Date(),
      });

      // Update signer status to viewed if it was pending
      if (signer.status === SignerStatus.PENDING) {
        await this.updateSignerStatus(
          documentId,
          signerId,
          SignerStatus.VIEWED
        );
      }

      return document;
    } catch (error) {
      console.error("Error getting document for signing:", error);
      throw new Error("Failed to get document for signing");
    }
  }

  // Update signer status
  static async updateSignerStatus(
    documentId,
    signerId,
    status,
    additionalData = {}
  ) {
    try {
      const docRef = doc(db, "documents", documentId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Document not found");
      }

      const currentDoc = docSnap.data();
      const updatedSigners = currentDoc.signers.map((signer) => {
        if (signer.id === signerId) {
          return {
            ...signer,
            status,
            ...additionalData,
            updatedAt: new Date(),
          };
        }
        return signer;
      });

      await updateDoc(docRef, {
        signers: updatedSigners,
        updatedAt: serverTimestamp(),
      });

      return updatedSigners;
    } catch (error) {
      console.error("Error updating signer status:", error);
      throw new Error("Failed to update signer status");
    }
  }

  // Upload signature image
  static async uploadSignature(signatureBlob, documentId) {
    try {
      const signatureId = uuidv4();
      const fileName = `signature_${signatureId}.png`;
      const storageRef = ref(storage, `signatures/${documentId}/${fileName}`);

      const snapshot = await uploadBytes(storageRef, signatureBlob);
      const downloadURL = await getDownloadURL(snapshot.ref);

      return {
        signatureUrl: downloadURL,
        signatureId: signatureId,
      };
    } catch (error) {
      console.error("Error uploading signature:", error);
      throw new Error("Failed to upload signature");
    }
  }

  // Complete signing process
  static async completeSignature(
    documentId,
    signerId,
    signatureData,
    clientInfo = {}
  ) {
    try {
      // Check signing permissions
      const authResult = await fgaService.authorize(signerId, Permissions.DOCUMENT_SIGN, documentId, 'document');
      if (authResult.decision !== 'allow') {
        throw new Error(`Access denied: ${authResult.reason}`);
      }

      // Upload signature if it's a blob
      let signatureUrl = signatureData.signatureUrl;
      if (signatureData.signatureBlob) {
        const uploadResult = await this.uploadSignature(
          signatureData.signatureBlob,
          documentId,
          signerId
        );
        signatureUrl = uploadResult.signatureUrl;
      }

      // Update field values with signature data
      const document = await DocumentService.getDocument(documentId);
      const updatedFields = document.fields.map((field) => {
        if (field.signerId === signerId) {
          return {
            ...field,
            value:
              field.type === "signature"
                ? signatureUrl
                : signatureData[field.type],
            signedAt: new Date(),
          };
        }
        return field;
      });

      // Update signer status to signed
      await this.updateSignerStatus(documentId, signerId, SignerStatus.SIGNED, {
        signedAt: new Date(),
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        signatureUrl: signatureUrl,
      });

      // Update document fields
      const docRef = doc(db, "documents", documentId);
      await updateDoc(docRef, {
        fields: updatedFields,
        updatedAt: serverTimestamp(),
      });

      // Add audit trail entry
      await DocumentService.addAuditTrailEntry(documentId, "document_signed", {
        signerId,
        signedAt: new Date(),
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      });

      // Check if all signers have signed
      const updatedDocument = await DocumentService.getDocument(documentId);
      const allSigned = updatedDocument.signers.every(
        (signer) => signer.status === SignerStatus.SIGNED
      );

      if (allSigned) {
        await this.completeDocument(documentId);
      }

      return {
        success: true,
        documentCompleted: allSigned
      };
    } catch (error) {
      console.error("Error completing signature:", error);
      throw new Error("Failed to complete signature");
    }
  }

  // Complete document (all signers have signed)
  static async completeDocument(documentId) {
    try {
      const document = await DocumentService.getDocument(documentId);

      const docRef = doc(db, "documents", documentId);
      await updateDoc(docRef, {
        status: "completed",
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await DocumentService.addAuditTrailEntry(
        documentId,
        "document_completed",
        {
          completedAt: new Date(),
        }
      );

      // Send completion notifications to all parties
      const recipients = [
        // Document creator
        {
          email: document.createdByEmail || "unknown@example.com",
          name: document.createdByName || "Document Creator",
        },
        // All signers
        ...document.signers.map((signer) => ({
          email: signer.email,
          name: signer.name,
        })),
      ];

      await NotificationService.sendDocumentCompleted(
        documentId,
        document,
        recipients
      );

      return true;
    } catch (error) {
      console.error("Error completing document:", error);
      throw new Error("Failed to complete document");
    }
  }

  // Generate signing link
  static generateSigningLink(
    documentId,
    signerId,
    baseUrl = window.location.origin
  ) {
    return `${baseUrl}/sign/${documentId}/${signerId}`;
  }
}
