// cSpell:ignore Firestore uuidv
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { createDocumentModel, createAuditTrailEntry } from "../models";
import { NotificationService } from "./notificationService";
import { v4 as uuidv4 } from "uuid";
// FGA Integration
import fgaService from "../authorization/FGAService.js";
import { Permissions } from "../authorization/models/index.js";

export class DocumentService {
  // Upload document to Firebase Storage
  static async uploadDocument(file, userId) {
    try {
      const fileId = uuidv4();
      const fileName = `${fileId}_${file.name}`;
      const storageRef = ref(storage, `documents/${userId}/${fileName}`);

      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      return {
        fileUrl: downloadURL,
        fileName: fileName,
        originalFileName: file.name,
        fileId: fileId,
      };
    } catch (error) {
      console.error("Error uploading document:", error);
      throw new Error("Failed to upload document");
    }
  }

  // Create a new document in Firestore
  static async createDocument(documentData, userId) {
    try {
      // Check if user can create documents
      const authResult = await fgaService.authorize(userId, Permissions.DOCUMENT_CREATE, null, 'document');
      if (authResult.decision !== 'allow') {
        throw new Error(`Access denied: ${authResult.reason}`);
      }

      const docData = createDocumentModel({
        ...documentData,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        auditTrail: [
          createAuditTrailEntry("document_created", {
            userId,
            title: documentData.title,
          }),
        ],
      });

      const docRef = await addDoc(collection(db, "documents"), docData);
      const documentId = docRef.id;

      // Set up FGA relationships and attributes
      await fgaService.addDocumentOwner(userId, documentId);
      
      // Set document attributes for ABAC
      await fgaService.setDocumentAttributes(documentId, {
        status: documentData.status || 'draft',
        type: documentData.type || 'contract',
        sensitivity: documentData.sensitivity || 'normal',
        created_date: new Date().toISOString(),
        size: documentData.size || 0
      });

      return documentId;
    } catch (error) {
      console.error("Error creating document:", error);
      throw new Error("Failed to create document");
    }
  }

  // Update document data
  static async updateDocument(documentId, updates, userId) {
    try {
      // Check if user can update this document
      const authResult = await fgaService.authorize(userId, Permissions.DOCUMENT_UPDATE, documentId, 'document');
      if (authResult.decision !== 'allow') {
        throw new Error(`Access denied: ${authResult.reason}`);
      }

      const docRef = doc(db, "documents", documentId);

      const updateData = {
        ...updates,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(docRef, updateData);

      // Update document attributes if needed
      if (updates.status || updates.type || updates.sensitivity) {
        const currentAttributes = await fgaService.getDocumentAttributes(documentId);
        await fgaService.setDocumentAttributes(documentId, {
          ...currentAttributes,
          status: updates.status || currentAttributes.status,
          type: updates.type || currentAttributes.type,
          sensitivity: updates.sensitivity || currentAttributes.sensitivity
        });
      }

      // Add audit trail entry
      await this.addAuditTrailEntry(documentId, "document_updated", {
        userId,
        changes: Object.keys(updates),
      });
    } catch (error) {
      console.error("Error updating document:", error);
      throw new Error("Failed to update document");
    }
  }

  // Get document by ID
  static async getDocument(documentId, userId = null) {
    try {
      const docRef = doc(db, "documents", documentId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Document not found");
      }

      const documentData = { id: docSnap.id, ...docSnap.data() };

      // If userId is provided, check read permissions
      if (userId) {
        const authResult = await fgaService.authorize(userId, Permissions.DOCUMENT_READ, documentId, 'document');
        if (authResult.decision !== 'allow') {
          throw new Error(`Access denied: ${authResult.reason}`);
        }
      }

      return documentData;
    } catch (error) {
      console.error("Error getting document:", error);
      throw error;
    }
  }

  // Get documents for a user
  static async getUserDocuments(userId) {
    try {
      // Get all documents user created
      const q = query(
        collection(db, "documents"),
        where("createdBy", "==", userId),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const ownedDocuments = [];

      querySnapshot.forEach((doc) => {
        ownedDocuments.push({ id: doc.id, ...doc.data() });
      });

      // Also get documents user has relationships with
      const relationships = await fgaService.relationshipStore.getUserRelationships(userId);
      const relatedDocumentIds = relationships
        .filter(rel => rel.objectType === 'document')
        .map(rel => rel.object);

      const relatedDocuments = [];
      for (const docId of relatedDocumentIds) {
        try {
          const doc = await this.getDocument(docId, userId);
          relatedDocuments.push(doc);
        } catch {
          // Skip documents user no longer has access to
          continue;
        }
      }

      // Combine and deduplicate
      const allDocuments = [...ownedDocuments];
      relatedDocuments.forEach(doc => {
        if (!allDocuments.find(existing => existing.id === doc.id)) {
          allDocuments.push(doc);
        }
      });

      return allDocuments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      console.error("Error getting user documents:", error);
      throw new Error("Failed to get documents");
    }
  }

  // Add signer to document
  static async addSigner(documentId, signerData, userId) {
    try {
      // Check if user can update this document
      const authResult = await fgaService.authorize(userId, Permissions.DOCUMENT_UPDATE, documentId, 'document');
      if (authResult.decision !== 'allow') {
        throw new Error(`Access denied: ${authResult.reason}`);
      }

      const docRef = doc(db, "documents", documentId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Document not found");
      }

      const currentDoc = docSnap.data();
      const signerId = uuidv4();
      const updatedSigners = [
        ...(currentDoc.signers || []),
        {
          ...signerData,
          id: signerId,
          order: currentDoc.signers?.length || 0,
        },
      ];

      await updateDoc(docRef, {
        signers: updatedSigners,
        updatedAt: serverTimestamp(),
      });

      // Add signer relationship for FGA
      await fgaService.addDocumentSigner(signerId, documentId);

      await this.addAuditTrailEntry(documentId, "signer_added", {
        userId,
        signerEmail: signerData.email,
        signerId
      });

      return updatedSigners;
    } catch (error) {
      console.error("Error adding signer:", error);
      throw new Error("Failed to add signer");
    }
  }

  // Add field to document
  static async addField(documentId, fieldData, userId) {
    try {
      const docRef = doc(db, "documents", documentId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Document not found");
      }

      const currentDoc = docSnap.data();
      const updatedFields = [
        ...(currentDoc.fields || []),
        {
          ...fieldData,
          id: uuidv4(),
        },
      ];

      await updateDoc(docRef, {
        fields: updatedFields,
        updatedAt: serverTimestamp(),
      });

      await this.addAuditTrailEntry(documentId, "field_added", {
        userId,
        fieldType: fieldData.type,
      });

      return updatedFields;
    } catch (error) {
      console.error("Error adding field:", error);
      throw new Error("Failed to add field");
    }
  }

  // Add audit trail entry
  static async addAuditTrailEntry(documentId, action, details = {}) {
    try {
      const docRef = doc(db, "documents", documentId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Document not found");
      }

      const currentDoc = docSnap.data();
      const newEntry = createAuditTrailEntry(action, details);

      const updatedAuditTrail = [...(currentDoc.auditTrail || []), newEntry];

      await updateDoc(docRef, {
        auditTrail: updatedAuditTrail,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error adding audit trail entry:", error);
      // Don't throw error for audit trail failures to avoid breaking main flow
    }
  }

  // Send document for signature (Phase 2.2 - with email notifications)
  static async sendForSignature(
    documentId,
    userId,
    requesterName,
    requesterEmail
  ) {
    try {
      // Check if user can send this document
      const authResult = await fgaService.authorize(userId, Permissions.DOCUMENT_SEND, documentId, 'document');
      if (authResult.decision !== 'allow') {
        throw new Error(`Access denied: ${authResult.reason}`);
      }

      // Get the document to access signers
      const document = await this.getDocument(documentId);

      await this.updateDocument(
        documentId,
        {
          status: "out_for_signature",
        },
        userId
      );

      await this.addAuditTrailEntry(documentId, "document_sent", {
        userId,
        sentAt: new Date(),
      });

      // Send email notifications to all signers
      const emailPromises = document.signers.map((signer) =>
        NotificationService.sendSignatureRequest(
          documentId,
          signer,
          requesterName || requesterEmail,
          document.title
        )
      );

      await Promise.all(emailPromises);

      // Schedule automatic reminders
      await NotificationService.scheduleReminders(documentId, document.signers);

      return true;
    } catch (error) {
      console.error("Error sending document for signature:", error);
      throw new Error("Failed to send document");
    }
  }
}
