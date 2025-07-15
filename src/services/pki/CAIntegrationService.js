// Certificate Authority (CA) Integration Service
// Handles communication with external Certificate Authorities

export class CAIntegrationService {
  constructor() {
    this.providers = new Map();
    this.apiKeys = new Map();
  }

  /**
   * Register a Certificate Authority provider
   * @param {string} name - Provider name
   * @param {Object} config - Provider configuration
   */
  registerProvider(name, config) {
    this.providers.set(name, {
      name: config.name,
      baseUrl: config.baseUrl,
      apiVersion: config.apiVersion,
      endpoints: config.endpoints,
      supportedTypes: config.supportedTypes,
      authentication: config.authentication
    });
  }

  /**
   * Set API credentials for a provider
   * @param {string} provider - Provider name
   * @param {Object} credentials - API credentials
   */
  setCredentials(provider, credentials) {
    this.apiKeys.set(provider, credentials);
  }

  /**
   * Sectigo CA Integration
   */
  async requestSectigo(csr, certificateType, validationData) {
    const config = this.providers.get('sectigo');
    const credentials = this.apiKeys.get('sectigo');

    const requestData = {
      csr,
      certType: certificateType,
      term: 365, // 1 year
      validationMethod: 'EMAIL',
      ...validationData
    };

    try {
      const response = await this.makeAPIRequest(
        config.baseUrl + '/certificates/request',
        'POST',
        requestData,
        credentials
      );

      return {
        success: true,
        requestId: response.requestId,
        status: response.status,
        validationRequired: response.validationRequired,
        estimatedIssuance: response.estimatedIssuance
      };
    } catch (error) {
      console.error('Sectigo certificate request failed:', error);
      throw error;
    }
  }

  /**
   * DigiCert CA Integration
   */
  async requestDigiCert(csr, certificateType, validationData) {
    const config = this.providers.get('digicert');
    const credentials = this.apiKeys.get('digicert');

    const requestData = {
      certificate: {
        common_name: validationData.commonName,
        csr,
        signature_hash: 'sha256'
      },
      validity_years: 1,
      organization: validationData.organization
    };

    try {
      const response = await this.makeAPIRequest(
        config.baseUrl + '/order/certificate/ssl_plus',
        'POST',
        requestData,
        credentials
      );

      return {
        success: true,
        orderId: response.id,
        status: response.status,
        validationRequired: true,
        estimatedIssuance: '1-3 business days'
      };
    } catch (error) {
      console.error('DigiCert certificate request failed:', error);
      throw error;
    }
  }

  /**
   * GlobalSign CA Integration
   */
  async requestGlobalSign(csr, certificateType, validationData) {
    const config = this.providers.get('globalsign');
    const credentials = this.apiKeys.get('globalsign');

    const requestData = {
      ProductCode: this.getGlobalSignProductCode(certificateType),
      CSR: csr,
      ValidityPeriod: 12, // months
      ContactInfo: validationData
    };

    try {
      const response = await this.makeAPIRequest(
        config.baseUrl + '/certificate',
        'POST',
        requestData,
        credentials
      );

      return {
        success: true,
        orderId: response.OrderID,
        status: 'pending',
        validationRequired: true,
        estimatedIssuance: response.EstimatedIssuance
      };
    } catch (error) {
      console.error('GlobalSign certificate request failed:', error);
      throw error;
    }
  }

  /**
   * Check certificate status across providers
   */
  async checkCertificateStatus(provider, requestId) {
    switch (provider) {
      case 'sectigo':
        return await this.checkSectigoStatus(requestId);
      case 'digicert':
        return await this.checkDigiCertStatus(requestId);
      case 'globalsign':
        return await this.checkGlobalSignStatus(requestId);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Download issued certificate
   */
  async downloadCertificate(provider, requestId, format = 'PEM') {
    switch (provider) {
      case 'sectigo':
        return await this.downloadSectigo(requestId, format);
      case 'digicert':
        return await this.downloadDigiCert(requestId, format);
      case 'globalsign':
        return await this.downloadGlobalSign(requestId, format);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  // Provider-specific status check methods
  async checkSectigoStatus(requestId) {
    const config = this.providers.get('sectigo');
    const credentials = this.apiKeys.get('sectigo');

    try {
      const response = await this.makeAPIRequest(
        `${config.baseUrl}/certificates/${requestId}/status`,
        'GET',
        null,
        credentials
      );

      return {
        status: response.status,
        issued: response.status === 'issued',
        certificate: response.certificate,
        validationDetails: response.validation
      };
    } catch (error) {
      console.error('Failed to check Sectigo status:', error);
      throw error;
    }
  }

  async checkDigiCertStatus(orderId) {
    const config = this.providers.get('digicert');
    const credentials = this.apiKeys.get('digicert');

    try {
      const response = await this.makeAPIRequest(
        `${config.baseUrl}/order/certificate/${orderId}`,
        'GET',
        null,
        credentials
      );

      return {
        status: response.status,
        issued: response.status === 'issued',
        certificate: response.certificate?.crt,
        validationDetails: response.requests
      };
    } catch (error) {
      console.error('Failed to check DigiCert status:', error);
      throw error;
    }
  }

  async checkGlobalSignStatus(orderId) {
    const config = this.providers.get('globalsign');
    const credentials = this.apiKeys.get('globalsign');

    try {
      const response = await this.makeAPIRequest(
        `${config.baseUrl}/certificate/${orderId}`,
        'GET',
        null,
        credentials
      );

      return {
        status: response.OrderStatus,
        issued: response.OrderStatus === 'ISSUED',
        certificate: response.Certificate,
        validationDetails: response.ValidationDetails
      };
    } catch (error) {
      console.error('Failed to check GlobalSign status:', error);
      throw error;
    }
  }

  // Helper methods
  async makeAPIRequest(url, method, data, credentials) {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'RhodeSign/1.0'
    };

    // Add authentication headers based on provider
    if (credentials.apiKey) {
      headers['X-API-Key'] = credentials.apiKey;
    }
    if (credentials.customerUri) {
      headers['customerUri'] = credentials.customerUri;
    }
    if (credentials.authorization) {
      headers['Authorization'] = credentials.authorization;
    }

    const options = {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined
    };

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    return await response.json();
  }

  getGlobalSignProductCode(certificateType) {
    const productCodes = {
      'personal': 'PersonalSign_1_SHA256',
      'organization': 'OrganizationSSL_1_SHA256',
      'extended_validation': 'ExtendedSSL_1_SHA256'
    };
    return productCodes[certificateType] || productCodes.personal;
  }
}

export default new CAIntegrationService();
