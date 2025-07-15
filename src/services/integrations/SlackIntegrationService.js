// Slack Integration Service
// Real-time notifications, workflow updates, and team collaboration

import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc,
  query, 
  where, 
  orderBy,
  limit,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase/config';

/**
 * Slack Integration Service
 * 
 * Provides comprehensive Slack integration:
 * - OAuth2 authentication with Slack
 * - Real-time signature notifications
 * - Workflow status updates
 * - Team collaboration features
 * - Custom slash commands
 * - Interactive message components
 * - Document sharing and previews
 */
class SlackIntegrationService {
  constructor() {
    this.integrationsCollection = collection(db, 'slackIntegrations');
    this.notificationsCollection = collection(db, 'slackNotifications');
    this.channelMappingsCollection = collection(db, 'slackChannelMappings');
    this.commandLogsCollection = collection(db, 'slackCommandLogs');

    // Slack API configuration
    this.slackConfig = {
      clientId: process.env.REACT_APP_SLACK_CLIENT_ID,
      clientSecret: process.env.REACT_APP_SLACK_CLIENT_SECRET,
      redirectUri: `${window.location.origin}/auth/slack/callback`,
      scopes: [
        'chat:write',
        'channels:read',
        'groups:read',
        'im:read',
        'mpim:read',
        'users:read',
        'users:read.email',
        'commands',
        'files:write',
        'files:read'
      ],
      apiBaseUrl: 'https://slack.com/api'
    };

    // Notification templates
    this.notificationTemplates = {
      document_sent: {
        type: 'document_sent',
        title: '📄 Document Sent for Signature',
        color: '#36a64f',
        fields: [
          { title: 'Document', value: '{documentName}', short: true },
          { title: 'Recipient', value: '{recipientEmail}', short: true },
          { title: 'Status', value: 'Pending Signature', short: true },
          { title: 'Sent By', value: '{senderName}', short: true }
        ],
        actions: [
          {
            type: 'button',
            text: 'View Document',
            url: '{documentUrl}',
            style: 'primary'
          },
          {
            type: 'button',
            text: 'Track Progress',
            url: '{trackingUrl}'
          }
        ]
      },
      document_signed: {
        type: 'document_signed',
        title: '✅ Document Successfully Signed',
        color: '#2eb886',
        fields: [
          { title: 'Document', value: '{documentName}', short: true },
          { title: 'Signer', value: '{signerEmail}', short: true },
          { title: 'Signed At', value: '{signedDate}', short: true },
          { title: 'Status', value: 'Complete', short: true }
        ],
        actions: [
          {
            type: 'button',
            text: 'Download Signed',
            url: '{downloadUrl}',
            style: 'primary'
          },
          {
            type: 'button',
            text: 'View Certificate',
            url: '{certificateUrl}'
          }
        ]
      },
      document_declined: {
        type: 'document_declined',
        title: '❌ Document Signature Declined',
        color: '#e01e5a',
        fields: [
          { title: 'Document', value: '{documentName}', short: true },
          { title: 'Declined By', value: '{signerEmail}', short: true },
          { title: 'Reason', value: '{declineReason}', short: false },
          { title: 'Declined At', value: '{declinedDate}', short: true }
        ],
        actions: [
          {
            type: 'button',
            text: 'Review Document',
            url: '{documentUrl}'
          },
          {
            type: 'button',
            text: 'Send Reminder',
            action_id: 'send_reminder'
          }
        ]
      },
      workflow_completed: {
        type: 'workflow_completed',
        title: '🎉 Signature Workflow Completed',
        color: '#2eb886',
        fields: [
          { title: 'Workflow', value: '{workflowName}', short: true },
          { title: 'Total Signers', value: '{totalSigners}', short: true },
          { title: 'Completed', value: '{completedDate}', short: true },
          { title: 'Duration', value: '{duration}', short: true }
        ],
        actions: [
          {
            type: 'button',
            text: 'Download Final',
            url: '{finalDocumentUrl}',
            style: 'primary'
          },
          {
            type: 'button',
            text: 'View Timeline',
            url: '{timelineUrl}'
          }
        ]
      },
      reminder_due: {
        type: 'reminder_due',
        title: '⏰ Signature Reminder',
        color: '#ff9900',
        fields: [
          { title: 'Document', value: '{documentName}', short: true },
          { title: 'Pending Signer', value: '{signerEmail}', short: true },
          { title: 'Days Pending', value: '{daysPending}', short: true },
          { title: 'Due Date', value: '{dueDate}', short: true }
        ],
        actions: [
          {
            type: 'button',
            text: 'Send Reminder',
            action_id: 'send_reminder',
            style: 'primary'
          },
          {
            type: 'button',
            text: 'View Document',
            url: '{documentUrl}'
          }
        ]
      }
    };

    // Slash commands
    this.slashCommands = {
      '/rhodesign-status': {
        description: 'Check status of your documents',
        usage: '/rhodesign-status [document-id]',
        handler: 'handleStatusCommand'
      },
      '/rhodesign-send': {
        description: 'Send a document for signature',
        usage: '/rhodesign-send [document-name] [recipient-email]',
        handler: 'handleSendCommand'
      },
      '/rhodesign-remind': {
        description: 'Send a reminder to pending signers',
        usage: '/rhodesign-remind [document-id]',
        handler: 'handleRemindCommand'
      },
      '/rhodesign-help': {
        description: 'Show RhodeSign help',
        usage: '/rhodesign-help',
        handler: 'handleHelpCommand'
      }
    };

    this.initializeSlackIntegration();
  }

  /**
   * Authenticate with Slack
   */
  async authenticateWithSlack(userId, organizationId, teamId = null) {
    try {
      const integrationId = `slack_${Date.now()}`;

      // Build Slack OAuth URL
      const authUrl = this.buildSlackAuthUrl(integrationId, teamId);

      // Store pending authentication
      await addDoc(this.integrationsCollection, {
        integrationId,
        userId,
        organizationId,
        provider: 'slack',
        status: 'pending_auth',
        authUrl,
        teamId,
        createdAt: serverTimestamp()
      });

      return {
        success: true,
        integrationId,
        authUrl,
        message: 'Please complete Slack authentication'
      };

    } catch (error) {
      console.error('Failed to initiate Slack authentication:', error);
      throw new Error(`Slack authentication failed: ${error.message}`);
    }
  }

  /**
   * Complete OAuth2 authentication
   */
  async completeAuthentication(integrationId, authCode) {
    try {
      // Exchange auth code for access token
      const tokenResponse = await this.exchangeCodeForTokens(authCode);

      // Get team and user information
      const teamInfo = await this.getTeamInfo(tokenResponse.access_token);
      const userInfo = await this.getUserInfo(tokenResponse.access_token, tokenResponse.authed_user.id);

      // Get channels list
      const channels = await this.getChannelsList(tokenResponse.access_token);

      // Update integration record
      await updateDoc(doc(this.integrationsCollection, integrationId), {
        status: 'authenticated',
        accessToken: this.encryptToken(tokenResponse.access_token),
        teamInfo: {
          id: teamInfo.team.id,
          name: teamInfo.team.name,
          domain: teamInfo.team.domain,
          icon: teamInfo.team.icon
        },
        userInfo: {
          id: userInfo.user.id,
          name: userInfo.user.name,
          email: userInfo.user.profile.email,
          avatar: userInfo.user.profile.image_192
        },
        botInfo: {
          botUserId: tokenResponse.bot_user_id,
          scope: tokenResponse.scope
        },
        channels: channels.channels.map(channel => ({
          id: channel.id,
          name: channel.name,
          isPrivate: channel.is_private,
          isMember: channel.is_member
        })),
        authenticatedAt: serverTimestamp()
      });

      // Test connection by sending welcome message
      const welcomeMessage = await this.sendWelcomeMessage(tokenResponse.access_token, userInfo.user.id);

      return {
        success: true,
        integrationId,
        teamInfo: teamInfo.team,
        userInfo: userInfo.user,
        channels: channels.channels,
        welcomeMessage,
        status: 'authenticated'
      };

    } catch (error) {
      console.error('Failed to complete Slack authentication:', error);
      throw new Error(`Authentication completion failed: ${error.message}`);
    }
  }

  /**
   * Send document notification to Slack
   */
  async sendDocumentNotification(notificationRequest) {
    try {
      const {
        integrationId,
        notificationType, // 'document_sent', 'document_signed', etc.
        channelId = null,
        userId = null,
        documentData,
        customMessage = null
      } = notificationRequest;

      const notificationId = `notif_${Date.now()}`;

      // Get integration credentials
      const integration = await this.getIntegration(integrationId);
      const accessToken = this.decryptToken(integration.accessToken);

      // Get notification template
      const template = this.notificationTemplates[notificationType];
      if (!template) {
        throw new Error(`Unknown notification type: ${notificationType}`);
      }

      // Build message from template
      const message = await this.buildMessageFromTemplate(template, documentData, customMessage);

      // Determine where to send the message
      const destination = channelId || userId || integration.userInfo.id;

      // Send message to Slack
      const slackResponse = await this.sendSlackMessage(accessToken, destination, message);

      // Store notification record
      await addDoc(this.notificationsCollection, {
        notificationId,
        integrationId,
        notificationType,
        channelId,
        userId,
        documentId: documentData.documentId,
        slackMessageTs: slackResponse.ts,
        slackChannel: slackResponse.channel,
        messageContent: message,
        status: 'sent',
        sentAt: serverTimestamp()
      });

      return {
        success: true,
        notificationId,
        slackTs: slackResponse.ts,
        channel: slackResponse.channel,
        message
      };

    } catch (error) {
      console.error('Failed to send document notification:', error);
      throw new Error(`Notification send failed: ${error.message}`);
    }
  }

  /**
   * Setup channel mapping for automatic notifications
   */
  async setupChannelMapping(mappingRequest) {
    try {
      const {
        integrationId,
        channelId,
        channelName,
        notificationTypes = ['document_sent', 'document_signed', 'document_declined'],
        filters = {},
        active = true
      } = mappingRequest;

      const mappingId = `mapping_${Date.now()}`;

      // Validate channel access
      const integration = await this.getIntegration(integrationId);
      const accessToken = this.decryptToken(integration.accessToken);
      
      const channelInfo = await this.getChannelInfo(accessToken, channelId);
      if (!channelInfo.ok) {
        throw new Error('Cannot access specified channel');
      }

      // Create channel mapping
      const mapping = {
        mappingId,
        integrationId,
        channelId,
        channelName: channelName || channelInfo.channel.name,
        notificationTypes,
        filters,
        active,
        channelInfo: {
          name: channelInfo.channel.name,
          isPrivate: channelInfo.channel.is_private,
          memberCount: channelInfo.channel.num_members
        },
        createdAt: serverTimestamp()
      };

      await addDoc(this.channelMappingsCollection, mapping);

      // Send test message to channel
      const testMessage = {
        text: `🎉 RhodeSign notifications are now active in this channel!`,
        attachments: [{
          color: '#36a64f',
          fields: [
            { title: 'Notification Types', value: notificationTypes.join(', '), short: false },
            { title: 'Status', value: 'Active', short: true }
          ]
        }]
      };

      await this.sendSlackMessage(accessToken, channelId, testMessage);

      return {
        success: true,
        mappingId,
        channelId,
        channelName: channelInfo.channel.name,
        notificationTypes,
        active
      };

    } catch (error) {
      console.error('Failed to setup channel mapping:', error);
      throw new Error(`Channel mapping setup failed: ${error.message}`);
    }
  }

  /**
   * Handle slash command
   */
  async handleSlashCommand(commandRequest) {
    try {
      const {
        command,
        text,
        userId,
        channelId,
        teamId,
        responseUrl
      } = commandRequest;

      const commandId = `cmd_${Date.now()}`;

      // Get integration for this team
      const integration = await this.getIntegrationByTeam(teamId);
      if (!integration) {
        return {
          text: 'RhodeSign is not installed in this workspace. Please contact your administrator.',
          response_type: 'ephemeral'
        };
      }

      // Route to appropriate handler
      let response;
      switch (command) {
        case '/rhodesign-status':
          response = await this.handleStatusCommand(integration, text, userId);
          break;
        case '/rhodesign-send':
          response = await this.handleSendCommand(integration, text, userId, channelId);
          break;
        case '/rhodesign-remind':
          response = await this.handleRemindCommand(integration, text, userId);
          break;
        case '/rhodesign-help':
          response = await this.handleHelpCommand();
          break;
        default:
          response = {
            text: `Unknown command: ${command}`,
            response_type: 'ephemeral'
          };
      }

      // Log command usage
      await addDoc(this.commandLogsCollection, {
        commandId,
        command,
        text,
        userId,
        channelId,
        teamId,
        integrationId: integration.integrationId,
        response: response.text || 'Interactive response',
        executedAt: serverTimestamp()
      });

      return response;

    } catch (error) {
      console.error('Failed to handle slash command:', error);
      return {
        text: `Error executing command: ${error.message}`,
        response_type: 'ephemeral'
      };
    }
  }

  /**
   * Send workflow summary to channel
   */
  async sendWorkflowSummary(summaryRequest) {
    try {
      const {
        integrationId,
        channelId,
        workflowId,
        summary
      } = summaryRequest;

      // Get integration credentials
      const integration = await this.getIntegration(integrationId);
      const accessToken = this.decryptToken(integration.accessToken);

      // Build comprehensive summary message
      const message = {
        text: `📊 Workflow Summary: ${summary.workflowName}`,
        attachments: [
          {
            color: '#36a64f',
            fields: [
              { title: 'Total Documents', value: summary.totalDocuments.toString(), short: true },
              { title: 'Completed', value: summary.completedDocuments.toString(), short: true },
              { title: 'Pending', value: summary.pendingDocuments.toString(), short: true },
              { title: 'Average Time', value: summary.averageCompletionTime, short: true }
            ],
            actions: [
              {
                type: 'button',
                text: 'View Full Report',
                url: `https://app.rhodesign.com/workflows/${workflowId}/report`,
                style: 'primary'
              }
            ]
          }
        ]
      };

      // Send summary message
      const slackResponse = await this.sendSlackMessage(accessToken, channelId, message);

      return {
        success: true,
        messageTs: slackResponse.ts,
        channel: slackResponse.channel
      };

    } catch (error) {
      console.error('Failed to send workflow summary:', error);
      throw new Error(`Workflow summary send failed: ${error.message}`);
    }
  }

  // Helper methods

  buildSlackAuthUrl(integrationId, teamId) {
    const params = new URLSearchParams({
      client_id: this.slackConfig.clientId,
      scope: this.slackConfig.scopes.join(','),
      redirect_uri: this.slackConfig.redirectUri,
      state: integrationId
    });

    if (teamId) {
      params.append('team', teamId);
    }

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(authCode) {
    const response = await fetch(`${this.slackConfig.apiBaseUrl}/oauth.v2.access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: this.slackConfig.clientId,
        client_secret: this.slackConfig.clientSecret,
        code: authCode,
        redirect_uri: this.slackConfig.redirectUri
      })
    });

    if (!response.ok) {
      throw new Error('Failed to exchange authorization code');
    }

    const result = await response.json();
    if (!result.ok) {
      throw new Error(result.error || 'OAuth exchange failed');
    }

    return result;
  }

  async sendSlackMessage(accessToken, channel, message) {
    const response = await fetch(`${this.slackConfig.apiBaseUrl}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel,
        ...message
      })
    });

    if (!response.ok) {
      throw new Error('Failed to send Slack message');
    }

    const result = await response.json();
    if (!result.ok) {
      throw new Error(result.error || 'Message send failed');
    }

    return result;
  }

  async buildMessageFromTemplate(template, documentData, customMessage) {
    let message = {
      text: customMessage || template.title,
      attachments: [
        {
          title: template.title,
          color: template.color,
          fields: template.fields.map(field => ({
            title: field.title,
            value: this.replaceTemplatePlaceholders(field.value, documentData),
            short: field.short
          })),
          actions: template.actions?.map(action => ({
            ...action,
            url: action.url ? this.replaceTemplatePlaceholders(action.url, documentData) : undefined
          }))
        }
      ]
    };

    return message;
  }

  replaceTemplatePlaceholders(template, data) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  async getIntegration(integrationId) {
    const integrationDoc = await getDoc(doc(this.integrationsCollection, integrationId));
    if (!integrationDoc.exists()) {
      throw new Error('Integration not found');
    }
    return { integrationId, ...integrationDoc.data() };
  }

  async getIntegrationByTeam(teamId) {
    const q = query(
      this.integrationsCollection,
      where('teamInfo.id', '==', teamId),
      where('status', '==', 'authenticated')
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return { integrationId: doc.id, ...doc.data() };
  }

  // Mock implementations for demo
  encryptToken(token) {
    return `encrypted_${btoa(token)}`;
  }

  decryptToken(encryptedToken) {
    return atob(encryptedToken.replace('encrypted_', ''));
  }

  async initializeSlackIntegration() {
    console.log('Slack Integration Service initialized');
  }

  // Additional helper methods would be implemented here...
  async getTeamInfo(accessToken) { return { team: {} }; }
  async getUserInfo(accessToken, userId) { return { user: {} }; }
  async getChannelsList(accessToken) { return { channels: [] }; }
  async getChannelInfo(accessToken, channelId) { return { ok: true, channel: {} }; }
  async sendWelcomeMessage(accessToken, userId) { return {}; }
  async handleStatusCommand(integration, text, userId) { return { text: 'Status command executed' }; }
  async handleSendCommand(integration, text, userId, channelId) { return { text: 'Send command executed' }; }
  async handleRemindCommand(integration, text, userId) { return { text: 'Remind command executed' }; }
  async handleHelpCommand() { return { text: 'Help command executed' }; }
}

export default new SlackIntegrationService();
