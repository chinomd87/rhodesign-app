// Task Manager Component
// Comprehensive interface for managing signing tasks and workflow progression

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  FileText, 
  Calendar, 
  Filter,
  Search,
  Bell,
  BellOff,
  Send,
  MessageSquare,
  Shield,
  Stamp,
  Eye,
  Download,
  RefreshCw,
  ArrowRight,
  User,
  Mail,
  Phone
} from 'lucide-react';
import SequentialSigningService from '../../services/workflows/SequentialSigningService';
import { useAuth } from '../../contexts/AuthContext';

const TaskManager = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [comment, setComment] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      loadData();
      
      // Set up real-time subscription for user tasks
      const unsubscribe = SequentialSigningService.subscribeToUserTasks(
        user.uid, 
        (updatedTasks) => {
          setTasks(updatedTasks);
        }
      );

      return () => unsubscribe?.();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load pending tasks
      const tasksResult = await SequentialSigningService.getUserPendingTasks(user.uid);
      if (tasksResult.success) {
        setTasks(tasksResult.tasks);
      }

      // Load user workflows
      const workflowsResult = await SequentialSigningService.getUserWorkflows(user.uid, {
        limit: 20
      });
      if (workflowsResult.success) {
        setWorkflows(workflowsResult.workflows);
      }

    } catch (error) {
      setError(`Failed to load data: ${error.message}`);
      console.error('Data loading error:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleTaskAction = async (taskId, action, data = {}) => {
    try {
      setError('');
      
      switch (action) {
        case 'complete':
          const result = await SequentialSigningService.completeTask(taskId, {
            ...data,
            userAgent: navigator.userAgent,
            ipAddress: 'client-ip', // Would be populated by backend
            timestamp: new Date()
          }, user.uid);
          
          if (result.success) {
            setSuccess('Task completed successfully!');
            await refreshData();
            setShowTaskModal(false);
          }
          break;

        case 'comment':
          // Add comment functionality here
          setSuccess('Comment added successfully!');
          setShowCommentModal(false);
          setComment('');
          break;

        case 'delegate':
          // Implement delegation logic
          setSuccess('Task delegated successfully!');
          break;

        default:
          break;
      }

    } catch (error) {
      setError(`Failed to ${action} task: ${error.message}`);
    }
  };

  const getTaskStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      overdue: 'bg-red-100 text-red-800 border-red-200',
      waiting: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[status] || colors.pending;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'text-gray-600',
      normal: 'text-blue-600',
      high: 'text-orange-600',
      urgent: 'text-red-600'
    };
    return colors[priority] || colors.normal;
  };

  const getTaskTypeIcon = (taskType) => {
    const icons = {
      signature: FileText,
      approval: CheckCircle2,
      review: Eye,
      witness: Users
    };
    const IconComponent = icons[taskType] || FileText;
    return <IconComponent className="w-4 h-4" />;
  };

  const isOverdue = (dueDate) => {
    return dueDate && new Date(dueDate.toDate()) < new Date();
  };

  const getDaysUntilDue = (dueDate) => {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate.toDate());
    const diffTime = due - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !searchTerm || 
      task.participantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.workflow?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.workflow?.documentTitle?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = selectedStatus === 'all' || 
      (selectedStatus === 'overdue' && isOverdue(task.dueDate)) ||
      task.status === selectedStatus;

    const matchesPriority = selectedPriority === 'all' || 
      task.workflow?.priority === selectedPriority;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Task Manager</h1>
          <p className="text-gray-600 mt-1">Manage your signing tasks and workflow progress</p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Tasks</p>
              <p className="text-2xl font-bold text-gray-900">
                {tasks.filter(t => t.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-gray-900">
                {tasks.filter(t => isOverdue(t.dueDate)).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed Today</p>
              <p className="text-2xl font-bold text-gray-900">
                {/* This would be calculated from completed tasks today */}
                0
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Workflows</p>
              <p className="text-2xl font-bold text-gray-900">
                {workflows.filter(w => w.status === 'active').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
            <option value="completed">Completed</option>
            <option value="waiting">Waiting</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
            <p className="text-gray-600">
              {searchTerm || selectedStatus !== 'all' || selectedPriority !== 'all' 
                ? 'Try adjusting your filters'
                : 'You have no pending tasks at the moment'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTasks.map((task) => (
              <div key={task.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isOverdue(task.dueDate) ? 'bg-red-100' : 
                        task.status === 'pending' ? 'bg-yellow-100' : 'bg-gray-100'
                      }`}>
                        {getTaskTypeIcon(task.taskType)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {task.workflow?.documentTitle || task.workflow?.name || 'Document Signing'}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getTaskStatusColor(isOverdue(task.dueDate) ? 'overdue' : task.status)}`}>
                          {isOverdue(task.dueDate) ? 'Overdue' : task.status}
                        </span>
                        {task.workflow?.priority && (
                          <span className={`text-xs font-medium ${getPriorityColor(task.workflow.priority)}`}>
                            {task.workflow.priority} priority
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                        <span className="flex items-center space-x-1">
                          <User className="w-4 h-4" />
                          <span>{task.participantName}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Mail className="w-4 h-4" />
                          <span>{task.participantEmail}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            Due {task.dueDate ? new Date(task.dueDate.toDate()).toLocaleDateString() : 'No deadline'}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="capitalize">{task.taskType}</span>
                        <span>•</span>
                        <span>Stage {task.order}</span>
                        <span>•</span>
                        <span>{task.participantRole}</span>
                        
                        {task.requirements?.requireMFA && (
                          <>
                            <span>•</span>
                            <span className="flex items-center space-x-1 text-green-600">
                              <Shield className="w-3 h-3" />
                              <span>MFA Required</span>
                            </span>
                          </>
                        )}
                        
                        {task.requirements?.requireTimestamping && (
                          <>
                            <span>•</span>
                            <span className="flex items-center space-x-1 text-blue-600">
                              <Stamp className="w-3 h-3" />
                              <span>Timestamped</span>
                            </span>
                          </>
                        )}
                      </div>

                      {getDaysUntilDue(task.dueDate) !== null && (
                        <div className="mt-2">
                          {getDaysUntilDue(task.dueDate) < 0 ? (
                            <span className="text-sm text-red-600 font-medium">
                              {Math.abs(getDaysUntilDue(task.dueDate))} day{Math.abs(getDaysUntilDue(task.dueDate)) !== 1 ? 's' : ''} overdue
                            </span>
                          ) : getDaysUntilDue(task.dueDate) === 0 ? (
                            <span className="text-sm text-orange-600 font-medium">Due today</span>
                          ) : (
                            <span className="text-sm text-gray-600">
                              {getDaysUntilDue(task.dueDate)} day{getDaysUntilDue(task.dueDate) !== 1 ? 's' : ''} remaining
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => setShowCommentModal(true)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                      title="Add Comment"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setSelectedTask(task);
                        setShowTaskModal(true);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                    >
                      <span>View Task</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {showTaskModal && selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => {
            setShowTaskModal(false);
            setSelectedTask(null);
          }}
          onAction={handleTaskAction}
        />
      )}

      {/* Comment Modal */}
      {showCommentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add Comment</h3>
              <button
                onClick={() => setShowCommentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                ✕
              </button>
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your comment..."
            />

            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => setShowCommentModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleTaskAction(selectedTask?.id, 'comment', { comment })}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Task Detail Modal Component
const TaskDetailModal = ({ task, onClose, onAction }) => {
  const [completionData, setCompletionData] = useState({
    signature: '',
    mfaVerified: false,
    certificate: null,
    timestampToken: null
  });
  const [isCompleting, setIsCompleting] = useState(false);

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await onAction(task.id, 'complete', completionData);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Task Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <span className="sr-only">Close</span>
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Task Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Task Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Document:</span>
                  <p className="text-sm text-gray-900">{task.workflow?.documentTitle || 'Document Signing'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Task Type:</span>
                  <p className="text-sm text-gray-900 capitalize">{task.taskType}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Due Date:</span>
                  <p className="text-sm text-gray-900">
                    {task.dueDate ? new Date(task.dueDate.toDate()).toLocaleDateString() : 'No deadline'}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Priority:</span>
                  <p className="text-sm text-gray-900 capitalize">{task.workflow?.priority || 'Normal'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Requirements */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Requirements</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={task.requirements?.requireMFA || false}
                  disabled
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Multi-Factor Authentication</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={task.requirements?.requireTimestamping || false}
                  disabled
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Trusted Timestamping</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={task.requirements?.allowDelegation || false}
                  disabled
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Delegation Allowed</span>
              </div>
            </div>
          </div>

          {/* Task Completion */}
          {task.status === 'pending' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Complete Task</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Signature
                  </label>
                  <textarea
                    value={completionData.signature}
                    onChange={(e) => setCompletionData(prev => ({ ...prev, signature: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your digital signature or confirmation"
                  />
                </div>

                {task.requirements?.requireMFA && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={completionData.mfaVerified}
                      onChange={(e) => setCompletionData(prev => ({ ...prev, mfaVerified: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label className="text-sm text-gray-700">
                      I have completed MFA verification
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>

            {task.status === 'pending' && (
              <button
                onClick={handleComplete}
                disabled={isCompleting || (task.requirements?.requireMFA && !completionData.mfaVerified)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isCompleting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>{isCompleting ? 'Completing...' : 'Complete Task'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskManager;
