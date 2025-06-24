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
  serverTimestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { createDocumentModel, createAuditTrailEntry } from '../models';
import { v4 as uuidv4 } from 'uuid';

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
        fileId: fileId
      };
    } catch (error) {
      console.error('Error uploading document:', error);
      throw new Error('Failed to upload document');
    }
  }

  // Create a new document in Firestore
  static async createDocument(documentData, userId) {
    try {
      const docData = createDocumentModel({
        ...documentData,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        auditTrail: [
          createAuditTrailEntry('document_created', {
            userId,
            title: documentData.title
          })
        ]
      });

      const docRef = await addDoc(collection(db, 'documents'), docData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating document:', error);
      throw new Error('Failed to create document');
    }
  }

  // Update document data
  static async updateDocument(documentId, updates, userId) {
    try {
      const docRef = doc(db, 'documents', documentId);
      
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp()
      };

      await updateDoc(docRef, updateData);
      
      // Add audit trail entry
      await this.addAuditTrailEntry(documentId, 'document_updated', {
        userId,
        changes: Object.keys(updates)
      });
      
    } catch (error) {
      console.error('Error updating document:', error);
      throw new Error('Failed to update document');
    }
  }

  // Get document by ID
  static async getDocument(documentId) {
    try {
      const docRef = doc(db, 'documents', documentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error('Document not found');
      }
    } catch (error) {
      console.error('Error getting document:', error);
      throw new Error('Failed to get document');
    }
  }

  // Get documents for a user
  static async getUserDocuments(userId) {
    try {
      const q = query(
        collection(db, 'documents'),
        where('createdBy', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const documents = [];
      
      querySnapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() });
      });
      
      return documents;
    } catch (error) {
      console.error('Error getting user documents:', error);
      throw new Error('Failed to get documents');
    }
  }

  // Add signer to document
  static async addSigner(documentId, signerData, userId) {
    try {
      const docRef = doc(db, 'documents', documentId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Document not found');
      }
      
      const currentDoc = docSnap.data();
      const updatedSigners = [...(currentDoc.signers || []), {
        ...signerData,
        id: uuidv4(),
        order: currentDoc.signers?.length || 0
      }];
      
      await updateDoc(docRef, {
        signers: updatedSigners,
        updatedAt: serverTimestamp()
      });
      
      await this.addAuditTrailEntry(documentId, 'signer_added', {
        userId,
        signerEmail: signerData.email
      });
      
      return updatedSigners;
    } catch (error) {
      console.error('Error adding signer:', error);
      throw new Error('Failed to add signer');
    }
  }

  // Add field to document
  static async addField(documentId, fieldData, userId) {
    try {
      const docRef = doc(db, 'documents', documentId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Document not found');
      }
      
      const currentDoc = docSnap.data();
      const updatedFields = [...(currentDoc.fields || []), {
        ...fieldData,
        id: uuidv4()
      }];
      
      await updateDoc(docRef, {
        fields: updatedFields,
        updatedAt: serverTimestamp()
      });
      
      await this.addAuditTrailEntry(documentId, 'field_added', {
        userId,
        fieldType: fieldData.type
      });
      
      return updatedFields;
    } catch (error) {
      console.error('Error adding field:', error);
      throw new Error('Failed to add field');
    }
  }

  // Add audit trail entry
  static async addAuditTrailEntry(documentId, action, details = {}) {
    try {
      const docRef = doc(db, 'documents', documentId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Document not found');
      }
      
      const currentDoc = docSnap.data();
      const newEntry = createAuditTrailEntry(action, details);
      
      const updatedAuditTrail = [...(currentDoc.auditTrail || []), newEntry];
      
      await updateDoc(docRef, {
        auditTrail: updatedAuditTrail,
        updatedAt: serverTimestamp()
      });
      
    } catch (error) {
      console.error('Error adding audit trail entry:', error);
      // Don't throw error for audit trail failures to avoid breaking main flow
    }
  }

  // Send document for signature (Phase 1 - basic email notification)
  static async sendForSignature(documentId, userId) {
    try {
      await this.updateDocument(documentId, {
        status: 'out_for_signature'
      }, userId);
      
      await this.addAuditTrailEntry(documentId, 'document_sent', {
        userId,
        sentAt: new Date()
      });
      
      // TODO: In Phase 1, we'll integrate with email service
      // For now, we'll just update the status
      
      return true;
    } catch (error) {
      console.error('Error sending document for signature:', error);
      throw new Error('Failed to send document');
    }
  }
}
