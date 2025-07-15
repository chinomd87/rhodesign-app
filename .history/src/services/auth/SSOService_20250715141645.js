// Single Sign-On (SSO) Service
// Enterprise identity provider integration with SAML, OAuth, and OIDC support

import { 
  signInWithCustomToken,
  signOut,
  onAuthStateChanged,
  connectAuthEmulator
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../../firebase/config';
import CryptoJS from 'crypto-js';

/**
 * Single Sign-On Service
 * 
 * Provides enterprise SSO integration with:
 * - SAML 2.0 authentication
 * - OAuth 2.0 / OpenID Connect
 * - Enterprise identity providers (Okta, Auth0, Azure AD, Google Workspace)
 * - Just-In-Time (JIT) user provisioning
 * - Role mapping and attribute assertion
 * - Session management and security
 */
class SSOService {
  constructor() {
    this.providersCollection = collection(db, 'ssoProviders');
    this.sessionsCollection = collection(db, 'ssoSessions');
    this.auditCollection = collection(db, 'ssoAudit');
    
    // Supported SSO providers
    this.supportedProviders = {
      'azure-ad': {
        name: 'Microsoft Azure AD',
        protocol: 'oidc',
        scopes: ['openid', 'profile', 'email'],
        endpoints: {
          authorization: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize',
          token: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token',
          userinfo: 'https://graph.microsoft.com/v1.0/me'
        }
      },
      'google-workspace': {
        name: 'Google Workspace',
        protocol: 'oidc',
        scopes: ['openid', 'profile', 'email'],
        endpoints: {
          authorization: 'https://accounts.google.com/o/oauth2/v2/auth',
          token: 'https://oauth2.googleapis.com/token',
          userinfo: 'https://www.googleapis.com/oauth2/v2/userinfo'
        }
      },
      'okta': {
        name: 'Okta',
        protocol: 'oidc',
        scopes: ['openid', 'profile', 'email'],
        endpoints: {
          authorization: 'https://{domain}/oauth2/v1/authorize',
          token: 'https://{domain}/oauth2/v1/token',
          userinfo: 'https://{domain}/oauth2/v1/userinfo'
        }
      },
      'auth0': {
        name: 'Auth0',
        protocol: 'oidc',
        scopes: ['openid', 'profile', 'email'],
        endpoints: {
          authorization: 'https://{domain}/authorize',
          token: 'https://{domain}/oauth/token',
          userinfo: 'https://{domain}/userinfo'
        }
      },
      'ping-identity': {
        name: 'Ping Identity',
        protocol: 'saml',
        endpoints: {
          sso: 'https://{domain}/as/authorization.oauth2',
          metadata: 'https://{domain}/pf/federation_metadata'
        }
      },
      'generic-saml': {
        name: 'Generic SAML Provider',
        protocol: 'saml',
        endpoints: {
          sso: null, // To be configured
          metadata: null
        }
      }
    };

    // Initialize auth state listener
    this.initializeAuthListener();
  }

  /**
   * Configure SSO provider for organization
   */
  async configureProvider(organizationId, providerConfig, configuredBy) {
    try {
      this.validateProviderConfig(providerConfig);

      const providerId = `${organizationId}_${providerConfig.type}`;
      const providerData = {
        id: providerId,
        organizationId,
        type: providerConfig.type,
        name: providerConfig.name || this.supportedProviders[providerConfig.type]?.name,
        protocol: this.supportedProviders[providerConfig.type]?.protocol,
        status: 'active',
        configuration: {
          ...providerConfig.configuration,
          // Encrypt sensitive data
          clientSecret: this.encryptSensitiveData(providerConfig.configuration.clientSecret),
          privateKey: providerConfig.configuration.privateKey ? 
            this.encryptSensitiveData(providerConfig.configuration.privateKey) : null
        },
        attributeMapping: {
          email: providerConfig.attributeMapping?.email || 'email',
          firstName: providerConfig.attributeMapping?.firstName || 'given_name',
          lastName: providerConfig.attributeMapping?.lastName || 'family_name',
          roles: providerConfig.attributeMapping?.roles || 'roles',
          department: providerConfig.attributeMapping?.department || 'department',
          ...providerConfig.attributeMapping
        },
        roleMapping: providerConfig.roleMapping || {},
        jitProvisioning: {
          enabled: providerConfig.jitProvisioning?.enabled || true,
          createUsers: providerConfig.jitProvisioning?.createUsers || true,
          updateAttributes: providerConfig.jitProvisioning?.updateAttributes || true,
          defaultRole: providerConfig.jitProvisioning?.defaultRole || 'user'
        },
        security: {
          enforceSSL: true,
          sessionTimeout: providerConfig.security?.sessionTimeout || 8, // hours
          requireMFA: providerConfig.security?.requireMFA || false,
          allowedIPs: providerConfig.security?.allowedIPs || [],
          signingAlgorithm: providerConfig.security?.signingAlgorithm || 'RS256'
        },
        metadata: {
          configuredBy,
          configuredAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
          version: 1
        }
      };

      await setDoc(doc(this.providersCollection, providerId), providerData);

      // Log configuration event
      await this.logAuditEvent({
        type: 'provider_configured',
        organizationId,
        providerId,
        actor: configuredBy,
        details: {
          providerType: providerConfig.type,
          protocol: this.supportedProviders[providerConfig.type]?.protocol
        }
      });

      return {
        success: true,
        providerId,
        provider: providerData
      };

    } catch (error) {
      console.error('Failed to configure SSO provider:', error);
      throw new Error(`Failed to configure SSO provider: ${error.message}`);
    }
  }

  /**
   * Initiate SSO authentication flow
   */
  async initiateSSO(organizationId, providerType, options = {}) {
    try {
      const providerId = `${organizationId}_${providerType}`;
      const provider = await this.getProvider(providerId);

      if (!provider) {
        throw new Error('SSO provider not found or not configured');
      }

      if (provider.status !== 'active') {
        throw new Error('SSO provider is not active');
      }

      const state = this.generateSecureState();
      const nonce = this.generateNonce();

      // Store SSO session
      await this.createSSOSession({
        organizationId,
        providerId,
        state,
        nonce,
        returnUrl: options.returnUrl,
        initiatedAt: new Date(),
        status: 'initiated'
      });

      let authUrl;

      if (provider.protocol === 'oidc') {
        authUrl = await this.buildOIDCAuthUrl(provider, state, nonce, options);
      } else if (provider.protocol === 'saml') {
        authUrl = await this.buildSAMLAuthUrl(provider, state, options);
      } else {
        throw new Error(`Unsupported SSO protocol: ${provider.protocol}`);
      }

      // Log initiation event
      await this.logAuditEvent({
        type: 'sso_initiated',
        organizationId,
        providerId,
        details: {
          protocol: provider.protocol,
          userAgent: options.userAgent,
          ipAddress: options.ipAddress
        }
      });

      return {
        success: true,
        authUrl,
        state,
        providerId
      };

    } catch (error) {
      console.error('Failed to initiate SSO:', error);
      throw new Error(`Failed to initiate SSO: ${error.message}`);
    }
  }

  /**
   * Handle SSO callback and complete authentication
   */
  async handleSSOCallback(callbackData) {
    try {
      const { code, state, error, samlResponse } = callbackData;

      if (error) {
        throw new Error(`SSO authentication error: ${error}`);
      }

      // Validate state parameter
      const session = await this.getSSOSessionByState(state);
      if (!session) {
        throw new Error('Invalid or expired SSO session');
      }

      const provider = await this.getProvider(session.providerId);
      if (!provider) {
        throw new Error('SSO provider not found');
      }

      let userInfo;

      if (provider.protocol === 'oidc') {
        // Handle OIDC callback
        const tokenResponse = await this.exchangeCodeForTokens(provider, code, session);
        userInfo = await this.getUserInfoFromTokens(provider, tokenResponse);
      } else if (provider.protocol === 'saml') {
        // Handle SAML callback
        userInfo = await this.processSAMLResponse(provider, samlResponse);
      }

      // Map provider attributes to user profile
      const userProfile = this.mapProviderAttributes(provider, userInfo);

      // Handle Just-In-Time provisioning
      const user = await this.handleJITProvisioning(provider, userProfile);

      // Create Firebase custom token
      const customToken = await this.createCustomToken(user, {
        ssoProvider: provider.type,
        organizationId: provider.organizationId,
        sessionId: session.id
      });

      // Update SSO session
      await this.updateSSOSession(session.id, {
        status: 'completed',
        userId: user.uid,
        completedAt: serverTimestamp(),
        userInfo: {
          email: userProfile.email,
          name: `${userProfile.firstName} ${userProfile.lastName}`,
          roles: userProfile.roles
        }
      });

      // Log successful authentication
      await this.logAuditEvent({
        type: 'sso_completed',
        organizationId: provider.organizationId,
        providerId: session.providerId,
        userId: user.uid,
        details: {
          email: userProfile.email,
          roles: userProfile.roles,
          jitProvisioned: user.jitProvisioned || false
        }
      });

      return {
        success: true,
        customToken,
        user: {
          uid: user.uid,
          email: userProfile.email,
          displayName: `${userProfile.firstName} ${userProfile.lastName}`,
          roles: userProfile.roles,
          organizationId: provider.organizationId
        },
        returnUrl: session.returnUrl
      };

    } catch (error) {
      console.error('Failed to handle SSO callback:', error);
      
      // Log failed authentication
      await this.logAuditEvent({
        type: 'sso_failed',
        organizationId: callbackData.organizationId,
        details: {
          error: error.message,
          state: callbackData.state
        }
      });

      throw new Error(`SSO authentication failed: ${error.message}`);
    }
  }

  /**
   * Sign out user and invalidate SSO session
   */
  async signOutSSO(userId, sessionId) {
    try {
      // Sign out from Firebase
      await signOut(auth);

      // Invalidate SSO session
      if (sessionId) {
        await this.updateSSOSession(sessionId, {
          status: 'signed_out',
          signedOutAt: serverTimestamp()
        });
      }

      // Log sign out event
      await this.logAuditEvent({
        type: 'sso_signout',
        userId,
        sessionId,
        details: {
          signOutTime: new Date().toISOString()
        }
      });

      return {
        success: true,
        message: 'Successfully signed out'
      };

    } catch (error) {
      console.error('Failed to sign out SSO:', error);
      throw new Error(`Failed to sign out: ${error.message}`);
    }
  }

  /**
   * Get organization's SSO providers
   */
  async getOrganizationProviders(organizationId) {
    try {
      const q = query(
        this.providersCollection,
        where('organizationId', '==', organizationId),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(q);
      const providers = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        // Remove sensitive data from response
        const { configuration, ...publicData } = data;
        const { clientSecret, privateKey, ...publicConfig } = configuration;
        
        providers.push({
          ...publicData,
          configuration: publicConfig
        });
      });

      return {
        success: true,
        providers
      };

    } catch (error) {
      console.error('Failed to get organization providers:', error);
      throw new Error(`Failed to get SSO providers: ${error.message}`);
    }
  }

  /**
   * Validate user's SSO session
   */
  async validateSSOSession(sessionId, userId) {
    try {
      const sessionDoc = await getDoc(doc(this.sessionsCollection, sessionId));
      
      if (!sessionDoc.exists()) {
        return { valid: false, reason: 'Session not found' };
      }

      const session = sessionDoc.data();
      
      // Check if session belongs to user
      if (session.userId !== userId) {
        return { valid: false, reason: 'Session does not belong to user' };
      }

      // Check session status
      if (session.status !== 'completed') {
        return { valid: false, reason: 'Session not completed' };
      }

      // Check session expiration
      const now = new Date();
      const sessionAge = now - session.completedAt.toDate();
      const maxAge = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

      if (sessionAge > maxAge) {
        // Mark session as expired
        await this.updateSSOSession(sessionId, {
          status: 'expired',
          expiredAt: serverTimestamp()
        });
        return { valid: false, reason: 'Session expired' };
      }

      return {
        valid: true,
        session: {
          id: sessionId,
          organizationId: session.organizationId,
          providerId: session.providerId,
          completedAt: session.completedAt,
          userInfo: session.userInfo
        }
      };

    } catch (error) {
      console.error('Failed to validate SSO session:', error);
      return { valid: false, reason: 'Validation error' };
    }
  }

  // Helper methods

  validateProviderConfig(config) {
    if (!config.type || !this.supportedProviders[config.type]) {
      throw new Error('Invalid or unsupported provider type');
    }

    if (!config.configuration) {
      throw new Error('Provider configuration is required');
    }

    const requiredFields = {
      'azure-ad': ['clientId', 'clientSecret', 'tenantId'],
      'google-workspace': ['clientId', 'clientSecret'],
      'okta': ['clientId', 'clientSecret', 'domain'],
      'auth0': ['clientId', 'clientSecret', 'domain'],
      'ping-identity': ['entityId', 'ssoUrl', 'certificate'],
      'generic-saml': ['entityId', 'ssoUrl', 'certificate']
    };

    const required = requiredFields[config.type] || [];
    for (const field of required) {
      if (!config.configuration[field]) {
        throw new Error(`Missing required configuration field: ${field}`);
      }
    }
  }

  encryptSensitiveData(data) {
    if (!data) return null;
    const key = process.env.REACT_APP_SSO_ENCRYPTION_KEY || 'default-key';
    return CryptoJS.AES.encrypt(data, key).toString();
  }

  decryptSensitiveData(encryptedData) {
    if (!encryptedData) return null;
    const key = process.env.REACT_APP_SSO_ENCRYPTION_KEY || 'default-key';
    const bytes = CryptoJS.AES.decrypt(encryptedData, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  generateSecureState() {
    return CryptoJS.lib.WordArray.random(32).toString();
  }

  generateNonce() {
    return CryptoJS.lib.WordArray.random(16).toString();
  }

  async buildOIDCAuthUrl(provider, state, nonce, options) {
    const config = provider.configuration;
    const providerDef = this.supportedProviders[provider.type];
    
    let authEndpoint = providerDef.endpoints.authorization;
    
    // Replace placeholders
    if (provider.type === 'azure-ad') {
      authEndpoint = authEndpoint.replace('{tenant}', config.tenantId);
    } else if (provider.type === 'okta' || provider.type === 'auth0') {
      authEndpoint = authEndpoint.replace('{domain}', config.domain);
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: providerDef.scopes.join(' '),
      state: state,
      nonce: nonce
    });

    return `${authEndpoint}?${params.toString()}`;
  }

  async buildSAMLAuthUrl(provider, state, options) {
    // SAML implementation would require XML handling
    // For now, return configured SSO URL with state
    const config = provider.configuration;
    return `${config.ssoUrl}?RelayState=${state}`;
  }

  async exchangeCodeForTokens(provider, code, session) {
    // This would be implemented as a Firebase function for security
    const exchangeTokens = httpsCallable(functions, 'exchangeOIDCTokens');
    
    return await exchangeTokens({
      providerId: session.providerId,
      code,
      sessionId: session.id
    });
  }

  async getUserInfoFromTokens(provider, tokenResponse) {
    // This would be implemented as a Firebase function
    const getUserInfo = httpsCallable(functions, 'getOIDCUserInfo');
    
    return await getUserInfo({
      providerId: provider.id,
      accessToken: tokenResponse.access_token
    });
  }

  async processSAMLResponse(provider, samlResponse) {
    // This would be implemented as a Firebase function for SAML parsing
    const processSAML = httpsCallable(functions, 'processSAMLResponse');
    
    return await processSAML({
      providerId: provider.id,
      samlResponse
    });
  }

  mapProviderAttributes(provider, userInfo) {
    const mapping = provider.attributeMapping;
    
    return {
      email: userInfo[mapping.email],
      firstName: userInfo[mapping.firstName],
      lastName: userInfo[mapping.lastName],
      roles: userInfo[mapping.roles] || [],
      department: userInfo[mapping.department],
      customAttributes: {}
    };
  }

  async handleJITProvisioning(provider, userProfile) {
    if (!provider.jitProvisioning.enabled) {
      throw new Error('Just-In-Time provisioning is not enabled');
    }

    // Check if user exists
    const existingUser = await this.findUserByEmail(userProfile.email);
    
    if (existingUser && provider.jitProvisioning.updateAttributes) {
      // Update existing user attributes
      await this.updateUserProfile(existingUser.uid, {
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        roles: userProfile.roles,
        department: userProfile.department,
        lastSSOLogin: serverTimestamp()
      });
      
      return existingUser;
    } else if (!existingUser && provider.jitProvisioning.createUsers) {
      // Create new user
      return await this.createJITUser(provider, userProfile);
    } else {
      throw new Error('User not found and JIT user creation is disabled');
    }
  }

  async createCustomToken(user, claims) {
    const createToken = httpsCallable(functions, 'createCustomToken');
    
    const result = await createToken({
      uid: user.uid,
      claims
    });

    return result.data.customToken;
  }

  async initializeAuthListener() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in
        this.currentUser = user;
      } else {
        // User is signed out
        this.currentUser = null;
      }
    });
  }

  async getProvider(providerId) {
    const doc = await getDoc(doc(this.providersCollection, providerId));
    return doc.exists() ? { id: doc.id, ...doc.data() } : null;
  }

  async createSSOSession(sessionData) {
    const sessionRef = doc(this.sessionsCollection);
    await setDoc(sessionRef, {
      id: sessionRef.id,
      ...sessionData,
      createdAt: serverTimestamp()
    });
    return sessionRef.id;
  }

  async updateSSOSession(sessionId, updates) {
    await updateDoc(doc(this.sessionsCollection, sessionId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }

  async getSSOSessionByState(state) {
    const q = query(this.sessionsCollection, where('state', '==', state));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async logAuditEvent(event) {
    try {
      await addDoc(this.auditCollection, {
        ...event,
        timestamp: serverTimestamp(),
        source: 'sso_service'
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  async findUserByEmail(email) {
    // Implementation depends on your user storage structure
    const usersCollection = collection(db, 'users');
    const q = query(usersCollection, where('email', '==', email));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return { uid: doc.id, ...doc.data() };
  }

  async updateUserProfile(uid, updates) {
    await updateDoc(doc(db, 'users', uid), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }

  async createJITUser(provider, userProfile) {
    const userRef = doc(collection(db, 'users'));
    const userData = {
      uid: userRef.id,
      email: userProfile.email,
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      displayName: `${userProfile.firstName} ${userProfile.lastName}`,
      roles: userProfile.roles,
      department: userProfile.department,
      organizationId: provider.organizationId,
      accountType: 'sso',
      ssoProvider: provider.type,
      jitProvisioned: true,
      createdAt: serverTimestamp(),
      lastSSOLogin: serverTimestamp(),
      status: 'active'
    };

    await setDoc(userRef, userData);
    return userData;
  }
}

export default new SSOService();
