// Firebase-based stores for FGA system
// Implements storage and retrieval for policies, relationships, and attributes

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config.js';

// Policy Store - manages authorization policies
export class FirebasePolicyStore {
  constructor() {
    this.collectionName = 'fga_policies';
  }

  async createPolicy(policy) {
    try {
      const policyData = {
        ...policy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, this.collectionName), policyData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating policy:', error);
      throw new Error('Failed to create policy');
    }
  }

  async getPolicy(policyId) {
    try {
      const docRef = doc(db, this.collectionName, policyId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      
      throw new Error('Policy not found');
    } catch (error) {
      console.error('Error getting policy:', error);
      throw error;
    }
  }

  async updatePolicy(policyId, updates) {
    try {
      const docRef = doc(db, this.collectionName, policyId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating policy:', error);
      throw new Error('Failed to update policy');
    }
  }

  async deletePolicy(policyId) {
    try {
      const docRef = doc(db, this.collectionName, policyId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting policy:', error);
      throw new Error('Failed to delete policy');
    }
  }

  async getApplicablePolicies(request) {
    try {
      const queries = [];
      
      // Query by resource type
      if (request.resourceType) {
        queries.push(
          query(
            collection(db, this.collectionName),
            where('enabled', '==', true),
            where('resourceTypes', 'array-contains', request.resourceType),
            orderBy('priority', 'desc')
          )
        );
      }
      
      // Query by action/permission
      if (request.action) {
        queries.push(
          query(
            collection(db, this.collectionName),
            where('enabled', '==', true),
            where('permissions', 'array-contains', request.action),
            orderBy('priority', 'desc')
          )
        );
      }
      
      // Default query for all enabled policies
      queries.push(
        query(
          collection(db, this.collectionName),
          where('enabled', '==', true),
          orderBy('priority', 'desc')
        )
      );

      const policies = new Set();
      
      for (const q of queries) {
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(doc => {
          policies.add({ id: doc.id, ...doc.data() });
        });
      }
      
      return Array.from(policies);
    } catch (error) {
      console.error('Error getting applicable policies:', error);
      return [];
    }
  }

  async getAllPolicies() {
    try {
      const q = query(
        collection(db, this.collectionName),
        orderBy('priority', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const policies = [];
      
      querySnapshot.forEach(doc => {
        policies.push({ id: doc.id, ...doc.data() });
      });
      
      return policies;
    } catch (error) {
      console.error('Error getting all policies:', error);
      return [];
    }
  }
}

// Relationship Store - manages ReBAC relationships
export class FirebaseRelationshipStore {
  constructor() {
    this.collectionName = 'fga_relationships';
  }

  async createRelationship(relationship) {
    try {
      const relationshipData = {
        ...relationship,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, this.collectionName), relationshipData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating relationship:', error);
      throw new Error('Failed to create relationship');
    }
  }

  async deleteRelationship(relationshipId) {
    try {
      const docRef = doc(db, this.collectionName, relationshipId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting relationship:', error);
      throw new Error('Failed to delete relationship');
    }
  }

  async hasRelationship(subject, relation, object, objectType) {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('subject', '==', subject),
        where('relation', '==', relation),
        where('object', '==', object),
        where('objectType', '==', objectType)
      );
      
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking relationship:', error);
      return false;
    }
  }

  async getUserRelationships(userId) {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('subject', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const relationships = [];
      
      querySnapshot.forEach(doc => {
        relationships.push({ id: doc.id, ...doc.data() });
      });
      
      return relationships;
    } catch (error) {
      console.error('Error getting user relationships:', error);
      return [];
    }
  }

  async getResourceRelationships(resourceId, resourceType) {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('object', '==', resourceId),
        where('objectType', '==', resourceType)
      );
      
      const querySnapshot = await getDocs(q);
      const relationships = [];
      
      querySnapshot.forEach(doc => {
        relationships.push({ id: doc.id, ...doc.data() });
      });
      
      return relationships;
    } catch (error) {
      console.error('Error getting resource relationships:', error);
      return [];
    }
  }

  async getOrganizationRelationships(userId, resourceId) {
    try {
      // Get user's organization memberships
      const userOrgQuery = query(
        collection(db, this.collectionName),
        where('subject', '==', userId),
        where('relation', 'in', ['org:member', 'org:admin', 'org:owner'])
      );
      
      const userOrgSnapshot = await getDocs(userOrgQuery);
      const userOrgs = [];
      
      userOrgSnapshot.forEach(doc => {
        userOrgs.push(doc.data().object);
      });
      
      if (userOrgs.length === 0) {
        return [];
      }
      
      // Check if resource belongs to any of user's organizations
      const resourceOrgQuery = query(
        collection(db, this.collectionName),
        where('object', '==', resourceId),
        where('subject', 'in', userOrgs)
      );
      
      const resourceOrgSnapshot = await getDocs(resourceOrgQuery);
      const relationships = [];
      
      resourceOrgSnapshot.forEach(doc => {
        relationships.push(doc.data().relation);
      });
      
      return relationships;
    } catch (error) {
      console.error('Error getting organization relationships:', error);
      return [];
    }
  }

  async bulkCreateRelationships(relationships) {
    try {
      const batch = [];
      
      for (const relationship of relationships) {
        batch.push(this.createRelationship(relationship));
      }
      
      await Promise.all(batch);
    } catch (error) {
      console.error('Error bulk creating relationships:', error);
      throw new Error('Failed to bulk create relationships');
    }
  }
}

// Attribute Store - manages ABAC attributes
export class FirebaseAttributeStore {
  constructor() {
    this.userAttributesCollection = 'fga_user_attributes';
    this.resourceAttributesCollection = 'fga_resource_attributes';
  }

  // User attribute methods
  async setUserAttributes(userId, attributes) {
    try {
      const docRef = doc(db, this.userAttributesCollection, userId);
      await updateDoc(docRef, {
        ...attributes,
        updatedAt: serverTimestamp()
      });
    } catch {
      // If document doesn't exist, create it
      try {
        await addDoc(collection(db, this.userAttributesCollection), {
          userId,
          ...attributes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (createError) {
        console.error('Error setting user attributes:', createError);
        throw new Error('Failed to set user attributes');
      }
    }
  }

  async getUserAttributes(userId) {
    try {
      const docRef = doc(db, this.userAttributesCollection, userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      }
      
      return {};
    } catch (error) {
      console.error('Error getting user attributes:', error);
      return {};
    }
  }

  async getUserRoles(userId) {
    try {
      const attributes = await this.getUserAttributes(userId);
      return attributes.roles || ['user']; // Default to 'user' role
    } catch (error) {
      console.error('Error getting user roles:', error);
      return ['user'];
    }
  }

  // Resource attribute methods
  async setResourceAttributes(resourceId, resourceType, attributes) {
    try {
      const docId = `${resourceType}_${resourceId}`;
      const docRef = doc(db, this.resourceAttributesCollection, docId);
      
      await updateDoc(docRef, {
        ...attributes,
        resourceId,
        resourceType,
        updatedAt: serverTimestamp()
      });
    } catch {
      // If document doesn't exist, create it
      try {
        const docId = `${resourceType}_${resourceId}`;
        const docRef = doc(db, this.resourceAttributesCollection, docId);
        
        await setDoc(docRef, {
          resourceId,
          resourceType,
          ...attributes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (createError) {
        console.error('Error setting resource attributes:', createError);
        throw new Error('Failed to set resource attributes');
      }
    }
  }

  async getResourceAttributes(resourceId, resourceType) {
    try {
      const docId = `${resourceType}_${resourceId}`;
      const docRef = doc(db, this.resourceAttributesCollection, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      }
      
      return {};
    } catch (error) {
      console.error('Error getting resource attributes:', error);
      return {};
    }
  }

  // Bulk operations
  async bulkSetUserAttributes(userAttributesList) {
    try {
      const batch = [];
      
      for (const { userId, attributes } of userAttributesList) {
        batch.push(this.setUserAttributes(userId, attributes));
      }
      
      await Promise.all(batch);
    } catch (error) {
      console.error('Error bulk setting user attributes:', error);
      throw new Error('Failed to bulk set user attributes');
    }
  }

  async bulkSetResourceAttributes(resourceAttributesList) {
    try {
      const batch = [];
      
      for (const { resourceId, resourceType, attributes } of resourceAttributesList) {
        batch.push(this.setResourceAttributes(resourceId, resourceType, attributes));
      }
      
      await Promise.all(batch);
    } catch (error) {
      console.error('Error bulk setting resource attributes:', error);
      throw new Error('Failed to bulk set resource attributes');
    }
  }

  // Search and query methods
  async findUsersByAttribute(attributeName, attributeValue) {
    try {
      const q = query(
        collection(db, this.userAttributesCollection),
        where(attributeName, '==', attributeValue)
      );
      
      const querySnapshot = await getDocs(q);
      const users = [];
      
      querySnapshot.forEach(doc => {
        users.push({ userId: doc.id, ...doc.data() });
      });
      
      return users;
    } catch (error) {
      console.error('Error finding users by attribute:', error);
      return [];
    }
  }

  async findResourcesByAttribute(resourceType, attributeName, attributeValue) {
    try {
      const q = query(
        collection(db, this.resourceAttributesCollection),
        where('resourceType', '==', resourceType),
        where(attributeName, '==', attributeValue)
      );
      
      const querySnapshot = await getDocs(q);
      const resources = [];
      
      querySnapshot.forEach(doc => {
        resources.push({ id: doc.id, ...doc.data() });
      });
      
      return resources;
    } catch (error) {
      console.error('Error finding resources by attribute:', error);
      return [];
    }
  }
}
