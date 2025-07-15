// Sequential Signing Service
// Enterprise-grade workflow orchestration for multi-party document signing

import { 
  doc, 
  collection, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  runTransaction,
  onSnapshot
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';

/**
 * Sequential Signing Service
 * 
 * Manages complex multi-party signing workflows with:
 * - Sequential and parallel signing modes
 * - Conditional routing and dependencies
 * - Real-time status tracking
 * - Deadline management
 * - Approval chains and escalation
 * - Integration with PKI, MFA, and timestamping
 */
class SequentialSigningService {
  constructor() {
    this.workflowsCollection = collection(db, 'signingWorkflows');
    this.tasksCollection = collection(db, 'signingTasks');
    this.auditCollection = collection(db, 'workflowAudit');
  }

  /**
   * Create a new signing workflow
   */
  async createWorkflow(workflowData, createdBy) {
    try {
      // Validate workflow data
      this.validateWorkflowData(workflowData);

      const workflow = {
        ...workflowData,
        id: null, // Will be set by Firestore
        status: 'draft',
        createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        metadata: {
          ...workflowData.metadata,
          version: 1,
          totalParticipants: workflowData.participants?.length || 0,
          completedTasks: 0,
          pendingTasks: 0,
          isTemplate: false,
          estimatedCompletionDays: this.calculateEstimatedCompletion(workflowData),
          complianceLevel: workflowData.complianceLevel || 'basic'
        },
        settings: {
          enableNotifications: true,
          enableReminders: true,
          reminderIntervalHours: 24,
          enableDeadlines: true,
          enableEscalation: true,
          escalationDelayHours: 72,
          requireMFA: false,
          requireTimestamping: true,
          allowDelegation: false,
          enableParallelSigning: false,
          ...workflowData.settings
        },
        participants: workflowData.participants || [],
        tasks: [],
        auditLog: [],
        currentStage: null,
        statistics: {
          averageTaskCompletionTime: 0,
          bottleneckStages: [],
          participantMetrics: {}
        }
      };

      // Create workflow document
      const workflowRef = await addDoc(this.workflowsCollection, workflow);
      
      // Generate signing tasks
      const tasks = await this.generateSigningTasks(workflowRef.id, workflow);
      
      // Update workflow with task references
      await updateDoc(workflowRef, {
        tasks: tasks.map(task => task.id),
        currentStage: tasks.find(task => task.status === 'pending')?.stageId || null,
        'metadata.pendingTasks': tasks.filter(task => task.status === 'pending').length
      });

      // Log audit event
      await this.logAuditEvent(workflowRef.id, {
        type: 'workflow_created',
        actor: createdBy,
        details: {
          totalTasks: tasks.length,
          totalParticipants: workflow.participants.length,
          workflowType: workflow.type
        }
      });

      return {
        success: true,
        workflowId: workflowRef.id,
        workflow: {
          ...workflow,
          id: workflowRef.id,
          tasks
        }
      };

    } catch (error) {
      console.error('Error creating workflow:', error);
      throw new Error(`Failed to create workflow: ${error.message}`);
    }
  }

  /**
   * Generate signing tasks based on workflow configuration
   */
  async generateSigningTasks(workflowId, workflow) {
    try {
      const tasks = [];
      const { participants, type, settings } = workflow;

      if (type === 'sequential') {
        // Sequential signing - one participant at a time
        for (let i = 0; i < participants.length; i++) {
          const participant = participants[i];
          const task = {
            id: null,
            workflowId,
            stageId: `stage_${i + 1}`,
            participantId: participant.id,
            participantEmail: participant.email,
            participantName: participant.name,
            participantRole: participant.role,
            taskType: participant.taskType || 'signature',
            status: i === 0 ? 'pending' : 'waiting',
            order: i + 1,
            dependencies: i > 0 ? [`stage_${i}`] : [],
            assignedAt: i === 0 ? serverTimestamp() : null,
            dueDate: this.calculateDueDate(workflow.settings?.defaultDeadlineDays),
            completedAt: null,
            conditions: participant.conditions || [],
            requirements: {
              requireMFA: settings?.requireMFA || participant.requireMFA || false,
              requireTimestamping: settings?.requireTimestamping || true,
              allowDelegation: settings?.allowDelegation || false,
              signatureType: participant.signatureType || 'electronic',
              certificateLevel: participant.certificateLevel || 'basic'
            },
            metadata: {
              attempts: 0,
              lastAttempt: null,
              reminders: [],
              escalations: [],
              delegatedTo: null,
              comments: []
            }
          };

          const taskRef = await addDoc(this.tasksCollection, task);
          tasks.push({
            ...task,
            id: taskRef.id
          });
        }

      } else if (type === 'parallel') {
        // Parallel signing - all participants can sign simultaneously
        for (let i = 0; i < participants.length; i++) {
          const participant = participants[i];
          const task = {
            id: null,
            workflowId,
            stageId: `parallel_stage`,
            participantId: participant.id,
            participantEmail: participant.email,
            participantName: participant.name,
            participantRole: participant.role,
            taskType: participant.taskType || 'signature',
            status: 'pending',
            order: i + 1,
            dependencies: [],
            assignedAt: serverTimestamp(),
            dueDate: this.calculateDueDate(workflow.settings?.defaultDeadlineDays),
            completedAt: null,
            conditions: participant.conditions || [],
            requirements: {
              requireMFA: settings?.requireMFA || participant.requireMFA || false,
              requireTimestamping: settings?.requireTimestamping || true,
              allowDelegation: settings?.allowDelegation || false,
              signatureType: participant.signatureType || 'electronic',
              certificateLevel: participant.certificateLevel || 'basic'
            },
            metadata: {
              attempts: 0,
              lastAttempt: null,
              reminders: [],
              escalations: [],
              delegatedTo: null,
              comments: []
            }
          };

          const taskRef = await addDoc(this.tasksCollection, task);
          tasks.push({
            ...task,
            id: taskRef.id
          });
        }

      } else if (type === 'custom') {
        // Custom workflow with complex routing
        const stages = workflow.stages || [];
        
        for (const stage of stages) {
          for (const participantId of stage.participants) {
            const participant = participants.find(p => p.id === participantId);
            if (!participant) continue;

            const task = {
              id: null,
              workflowId,
              stageId: stage.id,
              participantId: participant.id,
              participantEmail: participant.email,
              participantName: participant.name,
              participantRole: participant.role,
              taskType: stage.taskType || 'signature',
              status: stage.autoStart ? 'pending' : 'waiting',
              order: stage.order,
              dependencies: stage.dependencies || [],
              assignedAt: stage.autoStart ? serverTimestamp() : null,
              dueDate: this.calculateDueDate(stage.deadlineDays || workflow.settings?.defaultDeadlineDays),
              completedAt: null,
              conditions: stage.conditions || [],
              requirements: {
                requireMFA: stage.requireMFA || settings?.requireMFA || false,
                requireTimestamping: stage.requireTimestamping || settings?.requireTimestamping || true,
                allowDelegation: stage.allowDelegation || settings?.allowDelegation || false,
                signatureType: stage.signatureType || 'electronic',
                certificateLevel: stage.certificateLevel || 'basic'
              },
              metadata: {
                attempts: 0,
                lastAttempt: null,
                reminders: [],
                escalations: [],
                delegatedTo: null,
                comments: []
              }
            };

            const taskRef = await addDoc(this.tasksCollection, task);
            tasks.push({
              ...task,
              id: taskRef.id
            });
          }
        }
      }

      return tasks;

    } catch (error) {
      console.error('Error generating tasks:', error);
      throw new Error(`Failed to generate signing tasks: ${error.message}`);
    }
  }

  /**
   * Complete a signing task
   */
  async completeTask(taskId, completionData, completedBy) {
    try {
      return await runTransaction(db, async (transaction) => {
        // Get task and workflow
        const taskRef = doc(this.tasksCollection, taskId);
        const taskSnap = await transaction.get(taskRef);
        
        if (!taskSnap.exists()) {
          throw new Error('Task not found');
        }

        const task = { id: taskId, ...taskSnap.data() };
        
        if (task.status !== 'pending') {
          throw new Error('Task is not in pending status');
        }

        // Validate completion data
        this.validateTaskCompletion(task, completionData);

        // Update task
        const taskUpdate = {
          status: 'completed',
          completedAt: serverTimestamp(),
          completedBy,
          completionData: {
            ...completionData,
            timestamp: serverTimestamp(),
            ipAddress: completionData.ipAddress,
            userAgent: completionData.userAgent,
            mfaVerified: completionData.mfaVerified || false,
            timestampToken: completionData.timestampToken,
            certificate: completionData.certificate
          },
          'metadata.attempts': task.metadata.attempts + 1,
          'metadata.lastAttempt': serverTimestamp()
        };

        transaction.update(taskRef, taskUpdate);

        // Get workflow
        const workflowRef = doc(this.workflowsCollection, task.workflowId);
        const workflowSnap = await transaction.get(workflowRef);
        const workflow = { id: task.workflowId, ...workflowSnap.data() };

        // Check for next tasks to activate
        const nextTasks = await this.getNextTasks(workflow, task);
        
        // Update next tasks
        for (const nextTask of nextTasks) {
          const nextTaskRef = doc(this.tasksCollection, nextTask.id);
          transaction.update(nextTaskRef, {
            status: 'pending',
            assignedAt: serverTimestamp()
          });
        }

        // Update workflow progress
        const allTasks = await this.getWorkflowTasks(task.workflowId);
        const completedCount = allTasks.filter(t => t.status === 'completed').length + 1; // +1 for current task
        const pendingCount = allTasks.filter(t => t.status === 'pending').length + nextTasks.length - 1; // Adjust for current completion
        
        const workflowUpdate = {
          'metadata.completedTasks': completedCount,
          'metadata.pendingTasks': pendingCount,
          updatedAt: serverTimestamp(),
          currentStage: nextTasks.length > 0 ? nextTasks[0].stageId : null
        };

        // Check if workflow is complete
        if (completedCount === allTasks.length) {
          workflowUpdate.status = 'completed';
          workflowUpdate.completedAt = serverTimestamp();
          workflowUpdate.currentStage = null;
        }

        transaction.update(workflowRef, workflowUpdate);

        // Log audit event
        await this.logAuditEvent(task.workflowId, {
          type: 'task_completed',
          actor: completedBy,
          taskId,
          details: {
            participantEmail: task.participantEmail,
            stageId: task.stageId,
            taskType: task.taskType,
            mfaVerified: completionData.mfaVerified,
            timestamped: !!completionData.timestampToken
          }
        });

        return {
          success: true,
          task: { ...task, ...taskUpdate },
          nextTasks,
          workflowComplete: workflowUpdate.status === 'completed'
        };
      });

    } catch (error) {
      console.error('Error completing task:', error);
      throw new Error(`Failed to complete task: ${error.message}`);
    }
  }

  /**
   * Get next tasks that should be activated
   */
  async getNextTasks(workflow, completedTask) {
    try {
      const allTasks = await this.getWorkflowTasks(workflow.id);
      const nextTasks = [];

      for (const task of allTasks) {
        if (task.status === 'waiting' && task.dependencies) {
          // Check if all dependencies are completed
          const dependenciesCompleted = task.dependencies.every(depStageId => {
            return allTasks.some(t => 
              t.stageId === depStageId && 
              (t.status === 'completed' || (t.id === completedTask.id))
            );
          });

          if (dependenciesCompleted) {
            nextTasks.push(task);
          }
        }
      }

      return nextTasks;

    } catch (error) {
      console.error('Error getting next tasks:', error);
      return [];
    }
  }

  /**
   * Get all tasks for a workflow
   */
  async getWorkflowTasks(workflowId) {
    try {
      const tasksQuery = query(
        this.tasksCollection,
        where('workflowId', '==', workflowId),
        orderBy('order', 'asc')
      );

      const tasksSnap = await getDocs(tasksQuery);
      return tasksSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

    } catch (error) {
      console.error('Error getting workflow tasks:', error);
      throw new Error(`Failed to get workflow tasks: ${error.message}`);
    }
  }

  /**
   * Get workflow details with tasks
   */
  async getWorkflow(workflowId) {
    try {
      const workflowSnap = await getDoc(doc(this.workflowsCollection, workflowId));
      
      if (!workflowSnap.exists()) {
        throw new Error('Workflow not found');
      }

      const workflow = { id: workflowId, ...workflowSnap.data() };
      const tasks = await this.getWorkflowTasks(workflowId);

      return {
        success: true,
        workflow: {
          ...workflow,
          tasks
        }
      };

    } catch (error) {
      console.error('Error getting workflow:', error);
      throw new Error(`Failed to get workflow: ${error.message}`);
    }
  }

  /**
   * Get workflows for a user
   */
  async getUserWorkflows(userId, options = {}) {
    try {
      const {
        status = null,
        role = null, // 'creator', 'participant'
        limit = 50,
        startAfter = null
      } = options;

      let workflowQuery;

      if (role === 'creator') {
        workflowQuery = query(
          this.workflowsCollection,
          where('createdBy', '==', userId),
          orderBy('createdAt', 'desc')
        );
      } else if (role === 'participant') {
        workflowQuery = query(
          this.workflowsCollection,
          where('participants', 'array-contains-any', [
            { id: userId },
            { email: userId } // Support email-based lookup
          ]),
          orderBy('createdAt', 'desc')
        );
      } else {
        // Get all workflows where user is involved
        workflowQuery = query(
          this.workflowsCollection,
          orderBy('createdAt', 'desc')
        );
      }

      if (status) {
        workflowQuery = query(workflowQuery, where('status', '==', status));
      }

      const workflowsSnap = await getDocs(workflowQuery);
      const workflows = [];

      for (const doc of workflowsSnap.docs) {
        const workflow = { id: doc.id, ...doc.data() };
        
        // Filter based on user involvement if not creator/participant specific
        if (!role) {
          const isCreator = workflow.createdBy === userId;
          const isParticipant = workflow.participants?.some(p => 
            p.id === userId || p.email === userId
          );
          
          if (!isCreator && !isParticipant) {
            continue;
          }
        }

        workflows.push(workflow);
      }

      return {
        success: true,
        workflows: workflows.slice(0, limit)
      };

    } catch (error) {
      console.error('Error getting user workflows:', error);
      throw new Error(`Failed to get user workflows: ${error.message}`);
    }
  }

  /**
   * Get pending tasks for a user
   */
  async getUserPendingTasks(userId, options = {}) {
    try {
      const tasksQuery = query(
        this.tasksCollection,
        where('participantId', '==', userId),
        where('status', '==', 'pending'),
        orderBy('dueDate', 'asc')
      );

      const tasksSnap = await getDocs(tasksQuery);
      const tasks = tasksSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Get workflow details for each task
      const tasksWithWorkflows = await Promise.all(
        tasks.map(async (task) => {
          const workflowSnap = await getDoc(doc(this.workflowsCollection, task.workflowId));
          const workflow = workflowSnap.exists() ? workflowSnap.data() : null;
          
          return {
            ...task,
            workflow: workflow ? {
              id: task.workflowId,
              name: workflow.name,
              documentTitle: workflow.documentTitle,
              priority: workflow.priority
            } : null
          };
        })
      );

      return {
        success: true,
        tasks: tasksWithWorkflows
      };

    } catch (error) {
      console.error('Error getting pending tasks:', error);
      throw new Error(`Failed to get pending tasks: ${error.message}`);
    }
  }

  /**
   * Send reminders for overdue tasks
   */
  async sendReminders() {
    try {
      const now = new Date();
      const overdueTasksQuery = query(
        this.tasksCollection,
        where('status', '==', 'pending'),
        where('dueDate', '<', now)
      );

      const tasksSnap = await getDocs(overdueTasksQuery);
      const remindersSent = [];

      for (const taskDoc of tasksSnap.docs) {
        const task = { id: taskDoc.id, ...taskDoc.data() };
        const lastReminder = task.metadata.reminders[task.metadata.reminders.length - 1];
        
        // Check if reminder should be sent based on interval
        const shouldSendReminder = !lastReminder || 
          (now - lastReminder.sentAt.toDate()) > (24 * 60 * 60 * 1000); // 24 hours

        if (shouldSendReminder) {
          // Send reminder (integrate with notification service)
          const reminderData = {
            sentAt: serverTimestamp(),
            type: 'overdue',
            daysOverdue: Math.floor((now - task.dueDate.toDate()) / (24 * 60 * 60 * 1000))
          };

          await updateDoc(doc(this.tasksCollection, task.id), {
            'metadata.reminders': arrayUnion(reminderData)
          });

          remindersSent.push({
            taskId: task.id,
            participantEmail: task.participantEmail,
            ...reminderData
          });
        }
      }

      return {
        success: true,
        remindersSent: remindersSent.length,
        reminders: remindersSent
      };

    } catch (error) {
      console.error('Error sending reminders:', error);
      throw new Error(`Failed to send reminders: ${error.message}`);
    }
  }

  /**
   * Subscribe to workflow updates
   */
  subscribeToWorkflow(workflowId, callback) {
    const workflowRef = doc(this.workflowsCollection, workflowId);
    
    return onSnapshot(workflowRef, (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() });
      }
    });
  }

  /**
   * Subscribe to user's pending tasks
   */
  subscribeToUserTasks(userId, callback) {
    const tasksQuery = query(
      this.tasksCollection,
      where('participantId', '==', userId),
      where('status', '==', 'pending')
    );
    
    return onSnapshot(tasksQuery, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(tasks);
    });
  }

  // Helper methods
  validateWorkflowData(data) {
    if (!data.name) throw new Error('Workflow name is required');
    if (!data.documentId) throw new Error('Document ID is required');
    if (!data.participants || data.participants.length === 0) {
      throw new Error('At least one participant is required');
    }
    if (!['sequential', 'parallel', 'custom'].includes(data.type)) {
      throw new Error('Invalid workflow type');
    }
  }

  validateTaskCompletion(task, completionData) {
    if (task.requirements.requireMFA && !completionData.mfaVerified) {
      throw new Error('MFA verification required for this task');
    }
    if (task.requirements.requireTimestamping && !completionData.timestampToken) {
      throw new Error('Timestamping required for this task');
    }
    if (!completionData.signature && task.taskType === 'signature') {
      throw new Error('Signature is required');
    }
  }

  calculateDueDate(days = 7) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  }

  calculateEstimatedCompletion(workflow) {
    const baseTime = workflow.participants?.length * 2 || 2; // 2 days per participant
    const complexityMultiplier = workflow.type === 'custom' ? 1.5 : 1;
    return Math.ceil(baseTime * complexityMultiplier);
  }

  async logAuditEvent(workflowId, event) {
    try {
      await addDoc(this.auditCollection, {
        workflowId,
        ...event,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  }
}

export default new SequentialSigningService();
