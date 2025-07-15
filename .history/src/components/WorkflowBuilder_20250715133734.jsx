// Workflow Builder Component
// Visual workflow designer for sequential and parallel signing processes

import React, { useState, useEffect } from 'react';
import { 
  Plus,
  X,
  ArrowRight,
  ArrowDown,
  Users,
  Clock,
  Shield,
  Settings,
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Circle,
  Edit3,
  Copy,
  Trash2,
  Save,
  Play
} from 'lucide-react';
import SequentialSigningService from '../../services/workflows/SequentialSigningService';
import { useAuth } from '../../contexts/AuthContext';

const WorkflowBuilder = ({ documentId, onWorkflowCreated, initialData = null }) => {
  const { user } = useAuth();
  const [workflowData, setWorkflowData] = useState({
    name: '',
    description: '',
    documentId: documentId || '',
    documentTitle: '',
    type: 'sequential', // sequential, parallel, custom
    priority: 'normal',
    complianceLevel: 'basic',
    participants: [],
    stages: [], // For custom workflows
    settings: {
      defaultDeadlineDays: 7,
      enableNotifications: true,
      enableReminders: true,
      reminderIntervalHours: 24,
      enableDeadlines: true,
      enableEscalation: true,
      escalationDelayHours: 72,
      requireMFA: false,
      requireTimestamping: true,
      allowDelegation: false,
      enableParallelSigning: false
    },
    metadata: {
      category: 'general',
      tags: []
    }
  });

  const [draggedParticipant, setDraggedParticipant] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Predefined participant templates
  const participantTemplates = [
    {
      role: 'CEO',
      taskType: 'signature',
      signatureType: 'electronic',
      requireMFA: true,
      certificateLevel: 'advanced'
    },
    {
      role: 'Legal Counsel',
      taskType: 'review',
      signatureType: 'electronic',
      requireMFA: false,
      certificateLevel: 'basic'
    },
    {
      role: 'Finance Director',
      taskType: 'approval',
      signatureType: 'electronic',
      requireMFA: true,
      certificateLevel: 'advanced'
    },
    {
      role: 'Witness',
      taskType: 'signature',
      signatureType: 'electronic',
      requireMFA: false,
      certificateLevel: 'basic'
    }
  ];

  useEffect(() => {
    if (initialData) {
      setWorkflowData(initialData);
    }
  }, [initialData]);

  const addParticipant = (participantData) => {
    const newParticipant = {
      id: `participant_${Date.now()}`,
      name: participantData.name,
      email: participantData.email,
      role: participantData.role,
      taskType: participantData.taskType || 'signature',
      signatureType: participantData.signatureType || 'electronic',
      requireMFA: participantData.requireMFA || false,
      certificateLevel: participantData.certificateLevel || 'basic',
      conditions: participantData.conditions || [],
      metadata: {
        addedAt: new Date().toISOString(),
        order: workflowData.participants.length + 1
      }
    };

    setWorkflowData(prev => ({
      ...prev,
      participants: [...prev.participants, newParticipant]
    }));

    // Auto-create stages for custom workflows
    if (workflowData.type === 'custom') {
      addStage({
        name: `${participantData.role} Stage`,
        participants: [newParticipant.id],
        taskType: newParticipant.taskType,
        dependencies: workflowData.stages.length > 0 ? [workflowData.stages[workflowData.stages.length - 1].id] : [],
        autoStart: workflowData.stages.length === 0
      });
    }
  };

  const addStage = (stageData) => {
    const newStage = {
      id: `stage_${Date.now()}`,
      name: stageData.name,
      description: stageData.description || '',
      participants: stageData.participants || [],
      taskType: stageData.taskType || 'signature',
      order: workflowData.stages.length + 1,
      dependencies: stageData.dependencies || [],
      conditions: stageData.conditions || [],
      deadlineDays: stageData.deadlineDays || workflowData.settings.defaultDeadlineDays,
      requireMFA: stageData.requireMFA || false,
      requireTimestamping: stageData.requireTimestamping !== false,
      allowDelegation: stageData.allowDelegation || false,
      autoStart: stageData.autoStart || false,
      metadata: {
        addedAt: new Date().toISOString()
      }
    };

    setWorkflowData(prev => ({
      ...prev,
      stages: [...prev.stages, newStage]
    }));
  };

  const removeParticipant = (participantId) => {
    setWorkflowData(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p.id !== participantId),
      stages: prev.stages.map(stage => ({
        ...stage,
        participants: stage.participants.filter(id => id !== participantId)
      }))
    }));
  };

  const removeStage = (stageId) => {
    setWorkflowData(prev => ({
      ...prev,
      stages: prev.stages.filter(s => s.id !== stageId)
    }));
  };

  const updateParticipant = (participantId, updates) => {
    setWorkflowData(prev => ({
      ...prev,
      participants: prev.participants.map(p =>
        p.id === participantId ? { ...p, ...updates } : p
      )
    }));
  };

  const updateStage = (stageId, updates) => {
    setWorkflowData(prev => ({
      ...prev,
      stages: prev.stages.map(s =>
        s.id === stageId ? { ...s, ...updates } : s
      )
    }));
  };

  const validateWorkflow = () => {
    const errors = [];

    if (!workflowData.name.trim()) {
      errors.push('Workflow name is required');
    }

    if (!workflowData.documentId) {
      errors.push('Document ID is required');
    }

    if (workflowData.participants.length === 0) {
      errors.push('At least one participant is required');
    }

    // Check for duplicate email addresses
    const emails = workflowData.participants.map(p => p.email.toLowerCase());
    const duplicateEmails = emails.filter((email, index) => emails.indexOf(email) !== index);
    if (duplicateEmails.length > 0) {
      errors.push(`Duplicate email addresses found: ${duplicateEmails.join(', ')}`);
    }

    // Custom workflow validation
    if (workflowData.type === 'custom') {
      if (workflowData.stages.length === 0) {
        errors.push('Custom workflows require at least one stage');
      }

      // Check for circular dependencies
      const hasCircularDependency = checkCircularDependencies(workflowData.stages);
      if (hasCircularDependency) {
        errors.push('Circular dependencies detected in workflow stages');
      }

      // Check for unreachable stages
      const unreachableStages = findUnreachableStages(workflowData.stages);
      if (unreachableStages.length > 0) {
        errors.push(`Unreachable stages found: ${unreachableStages.map(s => s.name).join(', ')}`);
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const checkCircularDependencies = (stages) => {
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (stageId) => {
      if (recursionStack.has(stageId)) return true;
      if (visited.has(stageId)) return false;

      visited.add(stageId);
      recursionStack.add(stageId);

      const stage = stages.find(s => s.id === stageId);
      if (stage) {
        for (const depId of stage.dependencies) {
          if (hasCycle(depId)) return true;
        }
      }

      recursionStack.delete(stageId);
      return false;
    };

    return stages.some(stage => hasCycle(stage.id));
  };

  const findUnreachableStages = (stages) => {
    const autoStartStages = stages.filter(s => s.autoStart);
    if (autoStartStages.length === 0) return stages; // All stages unreachable

    const reachable = new Set();
    const queue = [...autoStartStages.map(s => s.id)];

    while (queue.length > 0) {
      const stageId = queue.shift();
      if (reachable.has(stageId)) continue;

      reachable.add(stageId);

      // Find stages that depend on this stage
      const dependentStages = stages.filter(s => 
        s.dependencies.includes(stageId)
      );

      queue.push(...dependentStages.map(s => s.id));
    }

    return stages.filter(s => !reachable.has(s.id));
  };

  const createWorkflow = async () => {
    if (!validateWorkflow()) {
      return;
    }

    setIsCreating(true);
    try {
      const result = await SequentialSigningService.createWorkflow(workflowData, user.uid);
      
      if (result.success) {
        onWorkflowCreated?.(result.workflow);
      }
    } catch (error) {
      setValidationErrors([error.message]);
    } finally {
      setIsCreating(false);
    }
  };

  const renderWorkflowVisualization = () => {
    if (workflowData.type === 'sequential') {
      return (
        <div className="space-y-4">
          {workflowData.participants.map((participant, index) => (
            <div key={participant.id} className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-800">
                  {index + 1}
                </div>
              </div>
              
              <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{participant.name}</h4>
                    <p className="text-sm text-gray-600">{participant.email}</p>
                    <p className="text-xs text-gray-500">{participant.role} • {participant.taskType}</p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {participant.requireMFA && (
                      <Shield className="w-4 h-4 text-green-600" title="MFA Required" />
                    )}
                    <button
                      onClick={() => removeParticipant(participant.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              
              {index < workflowData.participants.length - 1 && (
                <div className="flex-shrink-0">
                  <ArrowDown className="w-5 h-5 text-gray-400" />
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (workflowData.type === 'parallel') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflowData.participants.map((participant) => (
            <div key={participant.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <button
                  onClick={() => removeParticipant(participant.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <h4 className="font-medium text-gray-900">{participant.name}</h4>
              <p className="text-sm text-gray-600">{participant.email}</p>
              <p className="text-xs text-gray-500">{participant.role} • {participant.taskType}</p>
              
              <div className="mt-2 flex items-center space-x-2">
                {participant.requireMFA && (
                  <Shield className="w-4 h-4 text-green-600" title="MFA Required" />
                )}
                <span className="text-xs text-gray-500">
                  {participant.certificateLevel} certificate
                </span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (workflowData.type === 'custom') {
      return (
        <div className="space-y-6">
          {workflowData.stages.map((stage, index) => (
            <div key={stage.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-sm font-semibold text-purple-800">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{stage.name}</h4>
                    <p className="text-sm text-gray-600">{stage.taskType}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedStage(stage)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeStage(stage.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {stage.participants.map(participantId => {
                  const participant = workflowData.participants.find(p => p.id === participantId);
                  if (!participant) return null;

                  return (
                    <div key={participantId} className="bg-gray-50 border border-gray-200 rounded p-3">
                      <h5 className="font-medium text-gray-900 text-sm">{participant.name}</h5>
                      <p className="text-xs text-gray-600">{participant.email}</p>
                      <p className="text-xs text-gray-500">{participant.role}</p>
                    </div>
                  );
                })}
              </div>

              {stage.dependencies.length > 0 && (
                <div className="mt-3 text-sm text-gray-600">
                  <span className="font-medium">Dependencies:</span>
                  {stage.dependencies.map(depId => {
                    const depStage = workflowData.stages.find(s => s.id === depId);
                    return depStage ? ` ${depStage.name}` : ` Unknown`;
                  }).join(', ')}
                </div>
              )}

              <div className="mt-3 flex items-center space-x-4 text-sm text-gray-600">
                <span className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>{stage.deadlineDays} days</span>
                </span>
                {stage.requireMFA && (
                  <span className="flex items-center space-x-1">
                    <Shield className="w-4 h-4 text-green-600" />
                    <span>MFA</span>
                  </span>
                )}
                {stage.autoStart && (
                  <span className="flex items-center space-x-1">
                    <Play className="w-4 h-4 text-blue-600" />
                    <span>Auto-start</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow Builder</h1>
          <p className="text-gray-600">Design your document signing workflow</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            {previewMode ? 'Edit Mode' : 'Preview Mode'}
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button
            onClick={createWorkflow}
            disabled={isCreating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
          >
            {isCreating ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isCreating ? 'Creating...' : 'Create Workflow'}</span>
          </button>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-medium text-red-800">Validation Errors</h3>
          </div>
          <ul className="list-disc list-inside space-y-1 text-red-700 text-sm">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {!previewMode ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Basic Information */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Workflow Details</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Workflow Name
                  </label>
                  <input
                    type="text"
                    value={workflowData.name}
                    onChange={(e) => setWorkflowData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter workflow name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={workflowData.description}
                    onChange={(e) => setWorkflowData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Describe the workflow purpose"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Workflow Type
                  </label>
                  <select
                    value={workflowData.type}
                    onChange={(e) => setWorkflowData(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="sequential">Sequential (One at a time)</option>
                    <option value="parallel">Parallel (All at once)</option>
                    <option value="custom">Custom (Advanced routing)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={workflowData.priority}
                    onChange={(e) => setWorkflowData(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Add Participants */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Participants</h3>
                <button
                  onClick={() => setShowParticipantModal(true)}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </button>
              </div>

              <div className="space-y-2">
                {workflowData.participants.map((participant) => (
                  <div key={participant.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{participant.name}</p>
                      <p className="text-xs text-gray-600">{participant.role}</p>
                    </div>
                    <button
                      onClick={() => removeParticipant(participant.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                {workflowData.participants.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">
                    No participants added yet
                  </p>
                )}
              </div>
            </div>

            {/* Quick Templates */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Templates</h3>
              <div className="space-y-2">
                {participantTemplates.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => setShowParticipantModal(true)}
                    className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <p className="font-medium text-gray-900 text-sm">{template.role}</p>
                    <p className="text-xs text-gray-600">{template.taskType}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Workflow Visualization */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Workflow Diagram</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>{workflowData.participants.length} participants</span>
                </div>
              </div>

              {workflowData.participants.length > 0 ? (
                renderWorkflowVisualization()
              ) : (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No participants yet</h4>
                  <p className="text-gray-600 mb-4">Add participants to see your workflow visualization</p>
                  <button
                    onClick={() => setShowParticipantModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add First Participant
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Preview Mode */
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Workflow Preview</h3>
          {renderWorkflowVisualization()}
        </div>
      )}

      {/* Participant Modal */}
      {showParticipantModal && (
        <ParticipantModal
          onClose={() => setShowParticipantModal(false)}
          onAdd={addParticipant}
          templates={participantTemplates}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          settings={workflowData.settings}
          onClose={() => setShowSettingsModal(false)}
          onSave={(settings) => {
            setWorkflowData(prev => ({ ...prev, settings }));
            setShowSettingsModal(false);
          }}
        />
      )}
    </div>
  );
};

// Participant Modal Component
const ParticipantModal = ({ onClose, onAdd, templates }) => {
  const [participantData, setParticipantData] = useState({
    name: '',
    email: '',
    role: '',
    taskType: 'signature',
    signatureType: 'electronic',
    requireMFA: false,
    certificateLevel: 'basic',
    conditions: []
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (participantData.name && participantData.email) {
      onAdd(participantData);
      onClose();
    }
  };

  const applyTemplate = (template) => {
    setParticipantData(prev => ({
      ...prev,
      ...template
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Add Participant</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={participantData.name}
              onChange={(e) => setParticipantData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={participantData.email}
              onChange={(e) => setParticipantData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <input
              type="text"
              value={participantData.role}
              onChange={(e) => setParticipantData(prev => ({ ...prev, role: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., CEO, Legal Counsel"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Type
              </label>
              <select
                value={participantData.taskType}
                onChange={(e) => setParticipantData(prev => ({ ...prev, taskType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="signature">Signature</option>
                <option value="approval">Approval</option>
                <option value="review">Review</option>
                <option value="witness">Witness</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Certificate Level
              </label>
              <select
                value={participantData.certificateLevel}
                onChange={(e) => setParticipantData(prev => ({ ...prev, certificateLevel: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="basic">Basic</option>
                <option value="advanced">Advanced</option>
                <option value="qualified">Qualified</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="requireMFA"
              checked={participantData.requireMFA}
              onChange={(e) => setParticipantData(prev => ({ ...prev, requireMFA: e.target.checked }))}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="requireMFA" className="text-sm text-gray-700">
              Require Multi-Factor Authentication
            </label>
          </div>

          {/* Template Quick Actions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quick Templates
            </label>
            <div className="grid grid-cols-2 gap-2">
              {templates.map((template, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="p-2 text-left bg-gray-50 hover:bg-gray-100 rounded text-sm"
                >
                  {template.role}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Participant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Settings Modal Component
const SettingsModal = ({ settings, onClose, onSave }) => {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSave = () => {
    onSave(localSettings);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Workflow Settings</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Timing Settings */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Timing & Deadlines</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Deadline (days)
                </label>
                <input
                  type="number"
                  value={localSettings.defaultDeadlineDays}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, defaultDeadlineDays: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reminder Interval (hours)
                </label>
                <input
                  type="number"
                  value={localSettings.reminderIntervalHours}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, reminderIntervalHours: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Security Settings */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Security & Compliance</h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="requireMFA"
                  checked={localSettings.requireMFA}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, requireMFA: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="requireMFA" className="text-sm text-gray-700">
                  Require MFA for all participants
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="requireTimestamping"
                  checked={localSettings.requireTimestamping}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, requireTimestamping: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="requireTimestamping" className="text-sm text-gray-700">
                  Require trusted timestamping
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="allowDelegation"
                  checked={localSettings.allowDelegation}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, allowDelegation: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="allowDelegation" className="text-sm text-gray-700">
                  Allow task delegation
                </label>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Notifications</h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="enableNotifications"
                  checked={localSettings.enableNotifications}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, enableNotifications: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="enableNotifications" className="text-sm text-gray-700">
                  Enable email notifications
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="enableReminders"
                  checked={localSettings.enableReminders}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, enableReminders: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="enableReminders" className="text-sm text-gray-700">
                  Enable automatic reminders
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="enableEscalation"
                  checked={localSettings.enableEscalation}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, enableEscalation: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="enableEscalation" className="text-sm text-gray-700">
                  Enable escalation for overdue tasks
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilder;
