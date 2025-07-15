// Document Template Service
// Manages document templates with pre-configured signature fields and metadata

import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../firebase/config';

export class DocumentTemplateService {
  constructor() {
    this.collectionName = 'document_templates';
    this.storagePrefix = 'templates/';
  }

  /**
   * Create a new document template
   * @param {Object} templateData - Template configuration
   */
  async createTemplate(templateData) {
    try {
      const {
        name,
        description,
        category,
        industryType,
        complianceLevel = 'basic',
        file,
        fields = [],
        settings = {},
        createdBy,
        isPublic = false,
        tags = []
      } = templateData;

      // Validate required fields
      if (!name || !file || !createdBy) {
        throw new Error('Template name, file, and creator are required');
      }

      // Upload template file to storage
      const fileRef = ref(storage, `${this.storagePrefix}${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(fileRef, file);
      const fileUrl = await getDownloadURL(uploadResult.ref);

      // Create template document
      const template = {
        name: name.trim(),
        description: description?.trim() || '',
        category: category || 'general',
        industryType: industryType || 'general',
        complianceLevel,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        storagePath: uploadResult.ref.fullPath,
        fields: this.validateFields(fields),
        settings: {
          requireSequentialSigning: settings.requireSequentialSigning || false,
          allowDelegation: settings.allowDelegation || false,
          expirationDays: settings.expirationDays || 30,
          reminderDays: settings.reminderDays || 7,
          requireMFA: settings.requireMFA || false,
          complianceLevel: complianceLevel,
          ...settings
        },
        metadata: {
          createdBy,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          version: 1,
          isPublic,
          tags,
          usageCount: 0,
          lastUsed: null
        },
        status: 'active'
      };

      const docRef = await addDoc(collection(db, this.collectionName), template);

      return {
        success: true,
        templateId: docRef.id,
        template: {
          id: docRef.id,
          ...template
        }
      };

    } catch (error) {
      console.error('Failed to create template:', error);
      throw error;
    }
  }

  /**
   * Get template by ID
   * @param {string} templateId - Template ID
   * @param {string} userId - User ID (for access control)
   */
  async getTemplate(templateId, userId) {
    try {
      const templateDoc = await getDoc(doc(db, this.collectionName, templateId));
      
      if (!templateDoc.exists()) {
        throw new Error('Template not found');
      }

      const templateData = { id: templateDoc.id, ...templateDoc.data() };

      // Check access permissions
      if (!templateData.metadata.isPublic && 
          templateData.metadata.createdBy !== userId) {
        throw new Error('Access denied to template');
      }

      return {
        success: true,
        template: templateData
      };

    } catch (error) {
      console.error('Failed to get template:', error);
      throw error;
    }
  }

  /**
   * Get templates for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   */
  async getUserTemplates(userId, options = {}) {
    try {
      const {
        category = null,
        industryType = null,
        includePublic = true,
        limitCount = 50,
        sortBy = 'updatedAt',
        sortOrder = 'desc'
      } = options;

      let templates = [];

      // Get user's private templates
      let userQuery = query(
        collection(db, this.collectionName),
        where('metadata.createdBy', '==', userId),
        where('status', '==', 'active'),
        orderBy(`metadata.${sortBy}`, sortOrder),
        limit(limitCount)
      );

      if (category) {
        userQuery = query(userQuery, where('category', '==', category));
      }

      if (industryType) {
        userQuery = query(userQuery, where('industryType', '==', industryType));
      }

      const userSnapshot = await getDocs(userQuery);
      userSnapshot.forEach(doc => {
        templates.push({ id: doc.id, ...doc.data() });
      });

      // Get public templates if requested
      if (includePublic) {
        let publicQuery = query(
          collection(db, this.collectionName),
          where('metadata.isPublic', '==', true),
          where('status', '==', 'active'),
          orderBy(`metadata.${sortBy}`, sortOrder),
          limit(limitCount)
        );

        if (category) {
          publicQuery = query(publicQuery, where('category', '==', category));
        }

        if (industryType) {
          publicQuery = query(publicQuery, where('industryType', '==', industryType));
        }

        const publicSnapshot = await getDocs(publicQuery);
        publicSnapshot.forEach(doc => {
          const templateData = { id: doc.id, ...doc.data() };
          // Avoid duplicates if user created a public template
          if (!templates.find(t => t.id === templateData.id)) {
            templates.push(templateData);
          }
        });
      }

      // Sort combined results
      templates.sort((a, b) => {
        const aValue = a.metadata[sortBy];
        const bValue = b.metadata[sortBy];
        
        if (sortOrder === 'desc') {
          return bValue > aValue ? 1 : -1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });

      return {
        success: true,
        templates: templates.slice(0, limitCount),
        total: templates.length
      };

    } catch (error) {
      console.error('Failed to get user templates:', error);
      throw error;
    }
  }

  /**
   * Update template
   * @param {string} templateId - Template ID
   * @param {Object} updates - Updates to apply
   * @param {string} userId - User ID (for access control)
   */
  async updateTemplate(templateId, updates, userId) {
    try {
      const templateDoc = await getDoc(doc(db, this.collectionName, templateId));
      
      if (!templateDoc.exists()) {
        throw new Error('Template not found');
      }

      const templateData = templateDoc.data();

      // Check permissions
      if (templateData.metadata.createdBy !== userId) {
        throw new Error('Access denied to update template');
      }

      // Prepare update data
      const updateData = {
        'metadata.updatedAt': serverTimestamp(),
        'metadata.version': templateData.metadata.version + 1
      };

      // Handle allowed updates
      if (updates.name) updateData.name = updates.name.trim();
      if (updates.description !== undefined) updateData.description = updates.description.trim();
      if (updates.category) updateData.category = updates.category;
      if (updates.industryType) updateData.industryType = updates.industryType;
      if (updates.fields) updateData.fields = this.validateFields(updates.fields);
      if (updates.settings) updateData.settings = { ...templateData.settings, ...updates.settings };
      if (updates.tags) updateData['metadata.tags'] = updates.tags;
      if (updates.isPublic !== undefined) updateData['metadata.isPublic'] = updates.isPublic;

      await updateDoc(doc(db, this.collectionName, templateId), updateData);

      return {
        success: true,
        templateId,
        updatedFields: Object.keys(updates)
      };

    } catch (error) {
      console.error('Failed to update template:', error);
      throw error;
    }
  }

  /**
   * Delete template
   * @param {string} templateId - Template ID
   * @param {string} userId - User ID (for access control)
   */
  async deleteTemplate(templateId, userId) {
    try {
      const templateDoc = await getDoc(doc(db, this.collectionName, templateId));
      
      if (!templateDoc.exists()) {
        throw new Error('Template not found');
      }

      const templateData = templateDoc.data();

      // Check permissions
      if (templateData.metadata.createdBy !== userId) {
        throw new Error('Access denied to delete template');
      }

      // Delete file from storage
      if (templateData.storagePath) {
        try {
          await deleteObject(ref(storage, templateData.storagePath));
        } catch (storageError) {
          console.warn('Failed to delete template file from storage:', storageError);
        }
      }

      // Soft delete - mark as deleted instead of removing
      await updateDoc(doc(db, this.collectionName, templateId), {
        status: 'deleted',
        'metadata.deletedAt': serverTimestamp(),
        'metadata.deletedBy': userId
      });

      return {
        success: true,
        templateId
      };

    } catch (error) {
      console.error('Failed to delete template:', error);
      throw error;
    }
  }

  /**
   * Create document from template
   * @param {string} templateId - Template ID
   * @param {Object} documentData - Document creation data
   */
  async createDocumentFromTemplate(templateId, documentData) {
    try {
      const {
        title,
        signers = [],
        settings = {},
        createdBy,
        customFields = {}
      } = documentData;

      // Get template
      const templateResult = await this.getTemplate(templateId, createdBy);
      const template = templateResult.template;

      // Update usage statistics
      await this.updateTemplateUsage(templateId);

      // Merge template fields with custom fields
      const fields = template.fields.map(field => ({
        ...field,
        ...customFields[field.id] || {}
      }));

      // Create document using existing document service
      // This would integrate with your existing DocumentService
      const documentCreationData = {
        title: title || `${template.name} - ${new Date().toLocaleDateString()}`,
        templateId,
        templateName: template.name,
        fileUrl: template.fileUrl,
        fileName: template.fileName,
        fields,
        signers,
        settings: {
          ...template.settings,
          ...settings
        },
        metadata: {
          createdFrom: 'template',
          templateVersion: template.metadata.version,
          createdBy,
          createdAt: new Date()
        }
      };

      return {
        success: true,
        documentData: documentCreationData,
        templateUsed: {
          id: templateId,
          name: template.name,
          version: template.metadata.version
        }
      };

    } catch (error) {
      console.error('Failed to create document from template:', error);
      throw error;
    }
  }

  /**
   * Get template categories and statistics
   */
  async getTemplateStatistics() {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, this.collectionName),
          where('status', '==', 'active')
        )
      );

      const stats = {
        total: 0,
        categories: {},
        industryTypes: {},
        complianceLevels: {},
        publicTemplates: 0,
        mostUsed: []
      };

      const templates = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        templates.push({ id: doc.id, ...data });
        
        stats.total++;
        
        // Count by category
        stats.categories[data.category] = (stats.categories[data.category] || 0) + 1;
        
        // Count by industry type
        stats.industryTypes[data.industryType] = (stats.industryTypes[data.industryType] || 0) + 1;
        
        // Count by compliance level
        stats.complianceLevels[data.complianceLevel] = (stats.complianceLevels[data.complianceLevel] || 0) + 1;
        
        // Count public templates
        if (data.metadata.isPublic) {
          stats.publicTemplates++;
        }
      });

      // Get most used templates
      stats.mostUsed = templates
        .filter(t => t.metadata.usageCount > 0)
        .sort((a, b) => b.metadata.usageCount - a.metadata.usageCount)
        .slice(0, 10)
        .map(t => ({
          id: t.id,
          name: t.name,
          usageCount: t.metadata.usageCount,
          category: t.category
        }));

      return {
        success: true,
        statistics: stats
      };

    } catch (error) {
      console.error('Failed to get template statistics:', error);
      throw error;
    }
  }

  // Helper methods

  /**
   * Validate template fields
   * @param {Array} fields - Fields to validate
   */
  validateFields(fields) {
    return fields.map(field => {
      const validatedField = {
        id: field.id || `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: field.type || 'signature',
        label: field.label || 'Signature',
        required: field.required !== false,
        position: {
          x: parseFloat(field.position?.x) || 0,
          y: parseFloat(field.position?.y) || 0,
          width: parseFloat(field.position?.width) || 200,
          height: parseFloat(field.position?.height) || 50,
          page: parseInt(field.position?.page) || 1
        },
        validation: field.validation || {},
        signerId: field.signerId || null,
        signerEmail: field.signerEmail || null
      };

      // Validate field type
      const allowedTypes = ['signature', 'text', 'date', 'initial', 'checkbox'];
      if (!allowedTypes.includes(validatedField.type)) {
        validatedField.type = 'signature';
      }

      return validatedField;
    });
  }

  /**
   * Update template usage statistics
   * @param {string} templateId - Template ID
   */
  async updateTemplateUsage(templateId) {
    try {
      const templateRef = doc(db, this.collectionName, templateId);
      await updateDoc(templateRef, {
        'metadata.usageCount': (await getDoc(templateRef)).data()?.metadata?.usageCount + 1 || 1,
        'metadata.lastUsed': serverTimestamp()
      });
    } catch (error) {
      console.warn('Failed to update template usage:', error);
    }
  }

  /**
   * Search templates
   * @param {string} searchTerm - Search term
   * @param {Object} filters - Search filters
   */
  async searchTemplates(searchTerm, filters = {}) {
    try {
      // For now, get all templates and filter client-side
      // In production, use Algolia or similar for better search
      const allTemplates = await this.getUserTemplates(filters.userId || '', {
        includePublic: true,
        limitCount: 1000
      });

      if (!searchTerm) {
        return allTemplates;
      }

      const filteredTemplates = allTemplates.templates.filter(template => {
        const searchIn = [
          template.name,
          template.description,
          template.category,
          template.industryType,
          ...(template.metadata.tags || [])
        ].join(' ').toLowerCase();

        return searchIn.includes(searchTerm.toLowerCase());
      });

      return {
        success: true,
        templates: filteredTemplates,
        total: filteredTemplates.length,
        searchTerm
      };

    } catch (error) {
      console.error('Failed to search templates:', error);
      throw error;
    }
  }
}

export default new DocumentTemplateService();
