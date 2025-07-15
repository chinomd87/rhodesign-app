// eIDAS Integration Tests
// Comprehensive test suite for eIDAS qualified signature services

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import EIDASQualifiedSignatureService from '../services/eidas/EIDASQualifiedSignatureService';
import EIDASValidationService from '../services/eidas/EIDASValidationService';
import EIDASTrustManagementService from '../services/eidas/EIDASTrustManagementService';
import EIDASConfigurationService from '../services/eidas/EIDASConfigurationService';

// Mock Firebase
jest.mock('../firebase/config', () => ({
  db: {},
  functions: {}
}));

describe('eIDAS Qualified Signature Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Qualified Signature Creation', () => {
    it('should create a qualified electronic signature with QTSP integration', async () => {
      const mockDocument = {
        id: 'test-doc-001',
        content: 'Test document content for eIDAS signature',
        hash: 'sha256-mock-hash',
        fileName: 'test-contract.pdf'
      };

      const mockUser = {
        id: 'user-001',
        email: 'test@example.com',
        qualifiedCertificate: {
          serialNumber: 'QC-001-2024',
          issuer: 'Test QTSP CA',
          subject: 'CN=Test User,O=Test Company,C=DE',
          validFrom: new Date('2024-01-01'),
          validTo: new Date('2026-01-01'),
          keyUsage: ['digitalSignature', 'nonRepudiation']
        }
      };

      const signatureRequest = {
        document: mockDocument,
        signer: mockUser,
        signatureFormat: 'PAdES-LTA',
        signatureLevel: 'qualified',
        qtspProvider: 'test-qtsp',
        timestampRequired: true,
        longTermValidation: true
      };

      // Mock QTSP response
      const mockQTSPResponse = {
        signatureValue: 'mock-signature-bytes',
        timestamp: new Date().toISOString(),
        certificates: [mockUser.qualifiedCertificate],
        revocationData: {
          ocspResponses: ['mock-ocsp-response'],
          crlData: ['mock-crl-data']
        }
      };

      // Mock the QTSP call
      jest.spyOn(EIDASQualifiedSignatureService, 'callQTSPSigningService')
        .mockResolvedValue(mockQTSPResponse);

      const result = await EIDASQualifiedSignatureService.createQualifiedSignature(signatureRequest);

      expect(result.success).toBe(true);
      expect(result.signature).toBeDefined();
      expect(result.signature.level).toBe('qualified');
      expect(result.signature.format).toBe('PAdES-LTA');
      expect(result.signature.legalEffect).toBe('equivalent_to_handwritten');
      expect(result.qualificationDetails.qualified).toBe(true);
    });

    it('should handle QTSP authentication and certificate selection', async () => {
      const mockUser = {
        id: 'user-002',
        email: 'business@example.com',
        qtspCredentials: {
          provider: 'globalsign',
          userId: 'gs-user-123',
          pin: 'mock-pin'
        }
      };

      const certificateRequest = {
        certificateType: 'QCertESeal',
        organizationInfo: {
          name: 'Test Corporation',
          country: 'DE',
          organizationIdentifier: 'VATDE-123456789'
        },
        keyGeneration: 'remote_qscd'
      };

      const result = await EIDASQualifiedSignatureService.getQualifiedCertificate(
        mockUser,
        certificateRequest
      );

      expect(result.success).toBe(true);
      expect(result.certificate).toBeDefined();
      expect(result.certificate.type).toBe('qualified');
      expect(result.certificate.qcStatements).toContain('QC-Compliance');
      expect(result.qscdType).toBe('remote');
    });

    it('should validate signature policy and legal requirements', async () => {
      const signaturePolicy = {
        jurisdiction: 'DE',
        signatureFormat: 'CAdES-LTA',
        hashAlgorithm: 'SHA-256',
        timestampRequired: true,
        archivalPeriod: 30, // years
        legalFramework: 'eIDAS'
      };

      const result = await EIDASConfigurationService.validateSignaturePolicy(signaturePolicy);

      expect(result.valid).toBe(true);
      expect(result.compliance.eidas).toBe(true);
      expect(result.legalEffect).toBe('qualified');
      expect(result.recommendations).toBeDefined();
    });
  });

  describe('eIDAS Signature Validation', () => {
    it('should validate qualified signature according to ETSI standards', async () => {
      const mockSignatureData = {
        format: 'PAdES-LTA',
        signatureValue: 'mock-signature-bytes',
        signingCertificate: {
          serialNumber: 'QC-001-2024',
          issuer: 'CN=Test QTSP CA,O=Test QTSP,C=DE',
          subject: 'CN=Test User,O=Test Company,C=DE',
          validFrom: new Date('2024-01-01'),
          validTo: new Date('2026-01-01'),
          extensions: {
            qcStatements: ['QC-Compliance', 'QC-SSCD', 'QC-Type-ESig']
          }
        },
        timestamps: [{
          tsa: 'Test TSA',
          timestamp: new Date().toISOString(),
          policy: 'qualified'
        }]
      };

      const mockDocument = {
        id: 'test-doc-001',
        content: 'Original document content',
        hash: 'sha256-original-hash'
      };

      const validationRequest = {
        signatureData: mockSignatureData,
        signedDocument: mockDocument,
        validationPolicy: 'eidas_qualified',
        checkRevocation: true,
        checkTimestamps: true
      };

      // Mock successful validation responses
      jest.spyOn(EIDASValidationService, 'performBasicValidation')
        .mockResolvedValue({
          passed: true,
          errors: [],
          signingCertificate: mockSignatureData.signingCertificate,
          timestamps: mockSignatureData.timestamps
        });

      jest.spyOn(EIDASValidationService, 'validateCertificatePath')
        .mockResolvedValue({
          passed: true,
          errors: [],
          trustAnchor: { country: 'DE', qtsp: 'Test QTSP' }
        });

      jest.spyOn(EIDASValidationService, 'assessSignatureQualification')
        .mockResolvedValue({
          qualified: true,
          qcCompliant: true,
          qcQSCD: true,
          esiLevel: 'qualified'
        });

      const result = await EIDASValidationService.validateSignature(validationRequest);

      expect(result.success).toBe(true);
      expect(result.indication).toBe('TOTAL-PASSED');
      expect(result.qualified).toBe(true);
      expect(result.legalEffect).toBe('legally_equivalent_to_handwritten');
    });

    it('should detect and handle revoked certificates', async () => {
      const mockRevokedCertificate = {
        serialNumber: 'REVOKED-001',
        issuer: 'CN=Test QTSP CA,O=Test QTSP,C=DE',
        revocationStatus: 'revoked',
        revocationDate: new Date('2024-06-01'),
        revocationReason: 'keyCompromise'
      };

      const mockSignatureData = {
        format: 'CAdES-B',
        signingCertificate: mockRevokedCertificate,
        signatureValue: 'mock-signature-bytes'
      };

      // Mock revocation check
      jest.spyOn(EIDASValidationService, 'validateCertificatePath')
        .mockResolvedValue({
          passed: false,
          fatal: true,
          errors: ['Certificate is revoked'],
          subIndication: 'REVOKED_NO_POE',
          revocationData: {
            revoked: true,
            revocationDate: mockRevokedCertificate.revocationDate,
            reason: mockRevokedCertificate.revocationReason
          }
        });

      const validationRequest = {
        signatureData: mockSignatureData,
        signedDocument: { content: 'test' },
        checkRevocation: true
      };

      const result = await EIDASValidationService.validateSignature(validationRequest);

      expect(result.success).toBe(false);
      expect(result.indication).toBe('TOTAL-FAILED');
      expect(result.report.results.errors).toContain('Certificate is revoked');
    });
  });

  describe('Cross-Border Recognition', () => {
    it('should validate cross-border signature recognition between EU Member States', async () => {
      const mockSignatureData = {
        format: 'XAdES-LTA',
        signingCertificate: {
          issuer: 'CN=French QTSP CA,O=ANSSI Qualified CA,C=FR',
          qualificationLevel: 'qualified'
        }
      };

      const validationContext = {
        requestingMemberState: 'DE',
        acceptanceCriteria: 'qualified',
        mutualRecognitionPolicy: 'full'
      };

      // Mock trust management responses
      jest.spyOn(EIDASTrustManagementService, 'identifyIssuingMemberState')
        .mockResolvedValue('FR');

      jest.spyOn(EIDASTrustManagementService, 'verifyQTSPStatus')
        .mockResolvedValue({
          verified: true,
          qualified: true,
          qtspData: {
            name: 'French QTSP',
            country: 'FR',
            supervisionBody: 'ANSSI'
          }
        });

      jest.spyOn(EIDASTrustManagementService, 'applyMutualRecognitionPrinciples')
        .mockResolvedValue({
          recognized: true,
          details: {
            basis: 'eidas_mutual_recognition',
            conditions: ['qualified_certificate', 'qualified_qtsp'],
            limitations: []
          }
        });

      const result = await EIDASTrustManagementService.validateCrossBorderSignature(
        mockSignatureData,
        mockSignatureData.signingCertificate,
        validationContext
      );

      expect(result.valid).toBe(true);
      expect(result.mutuallyRecognized).toBe(true);
      expect(result.issuingMemberState).toBe('FR');
      expect(result.legalEffect).toBe('equivalent_to_handwritten');
    });
  });

  describe('Trust List Management', () => {
    it('should synchronize EU Member State trust lists', async () => {
      // Mock trust list download and parsing
      jest.spyOn(EIDASTrustManagementService, 'downloadTrustList')
        .mockResolvedValue('<TrustServiceStatusList>Mock XML</TrustServiceStatusList>');

      jest.spyOn(EIDASTrustManagementService, 'parseTrustList')
        .mockResolvedValue({
          territoryCode: 'DE',
          sequenceNumber: 100,
          issueDate: new Date(),
          nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          qtspList: [
            {
              identifier: 'QTSP-DE-001',
              name: 'German Test QTSP',
              trustServices: [
                {
                  type: 'QCertESig',
                  status: 'granted',
                  statusStartingTime: new Date('2024-01-01')
                }
              ]
            }
          ]
        });

      const result = await EIDASTrustManagementService.synchronizeTrustLists();

      expect(result.success).toBe(true);
      expect(result.results.memberStatesProcessed).toBeGreaterThan(0);
      expect(result.results.successfulDownloads).toBeGreaterThan(0);
      expect(result.results.qtspCount).toBeGreaterThan(0);
    });

    it('should verify QTSP qualification and supervision status', async () => {
      const qtspIdentifier = 'GlobalSign-DE-CA';
      const serviceType = 'QCertESig';

      // Mock QTSP verification
      jest.spyOn(EIDASTrustManagementService, 'checkSupervisionStatus')
        .mockResolvedValue({
          supervised: true,
          supervisionBody: 'Bundesnetzagentur',
          status: 'active',
          lastReview: new Date('2024-01-01')
        });

      const result = await EIDASTrustManagementService.verifyQTSPStatus(qtspIdentifier, serviceType);

      expect(result.verified).toBe(true);
      expect(result.qualified).toBe(true);
      expect(result.supervisionStatus.supervised).toBe(true);
      expect(result.trustListInclusion.included).toBe(true);
    });
  });

  describe('Configuration and Legal Framework', () => {
    it('should configure eIDAS legal framework for different jurisdictions', async () => {
      const jurisdictionConfig = {
        country: 'DE',
        legalFramework: 'eIDAS',
        nationalLaw: 'VDG (Vertrauensdienstegesetz)',
        supervisionBody: 'Bundesnetzagentur',
        recognizedStandards: ['ETSI EN 319 102-1', 'ETSI EN 319 122', 'ETSI EN 319 142']
      };

      const result = await EIDASConfigurationService.configureLegalFramework(jurisdictionConfig);

      expect(result.success).toBe(true);
      expect(result.configuration.compliance.eidas).toBe(true);
      expect(result.configuration.supervisionBody).toBe('Bundesnetzagentur');
      expect(result.configuration.legalBasis).toContain('EU Regulation 910/2014');
    });

    it('should generate compliance reports for audit purposes', async () => {
      const reportRequest = {
        period: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31')
        },
        jurisdiction: 'DE',
        reportType: 'annual_compliance',
        includeStatistics: true
      };

      const result = await EIDASConfigurationService.generateComplianceReport(reportRequest);

      expect(result.success).toBe(true);
      expect(result.report.period).toEqual(reportRequest.period);
      expect(result.report.compliance.eidas).toBe(true);
      expect(result.report.statistics.totalSignatures).toBeGreaterThanOrEqual(0);
      expect(result.report.statistics.qualifiedSignatures).toBeGreaterThanOrEqual(0);
      expect(result.report.auditTrail).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle QTSP service unavailability gracefully', async () => {
      const signatureRequest = {
        document: { id: 'test-doc', content: 'test' },
        signer: { id: 'user-001' },
        qtspProvider: 'unavailable-qtsp'
      };

      // Mock QTSP service error
      jest.spyOn(EIDASQualifiedSignatureService, 'callQTSPSigningService')
        .mockRejectedValue(new Error('QTSP service unavailable'));

      const result = await EIDASQualifiedSignatureService.createQualifiedSignature(signatureRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('QTSP service unavailable');
      expect(result.fallbackOptions).toBeDefined();
    });

    it('should validate expired certificates correctly', async () => {
      const expiredCertificate = {
        serialNumber: 'EXPIRED-001',
        validFrom: new Date('2022-01-01'),
        validTo: new Date('2023-01-01'), // Expired
        issuer: 'CN=Test CA'
      };

      const validationTime = new Date('2024-01-01');

      const result = await EIDASValidationService.validateCertificatePath(
        expiredCertificate,
        validationTime,
        true
      );

      expect(result.passed).toBe(false);
      expect(result.subIndication).toBe('EXPIRED');
      expect(result.errors).toContain('Certificate expired: CN=Test CA');
    });

    it('should handle malformed signature data', async () => {
      const malformedSignature = {
        format: 'invalid',
        signatureValue: 'not-base64-data',
        signingCertificate: null
      };

      const validationRequest = {
        signatureData: malformedSignature,
        signedDocument: { content: 'test' }
      };

      const result = await EIDASValidationService.validateSignature(validationRequest);

      expect(result.success).toBe(false);
      expect(result.indication).toBe('TOTAL-FAILED');
      expect(result.report.results.errors.length).toBeGreaterThan(0);
    });
  });
});

// Integration test for complete eIDAS workflow
describe('eIDAS Complete Workflow Integration', () => {
  it('should complete full qualified signature lifecycle', async () => {
    // Step 1: Configure eIDAS environment
    const config = await EIDASConfigurationService.setupEIDASEnvironment({
      jurisdiction: 'DE',
      qtspProviders: ['globalsign', 'digicert'],
      trustListUrl: 'https://test.trust-list.de/tsl.xml'
    });

    expect(config.success).toBe(true);

    // Step 2: Synchronize trust lists
    const trustSync = await EIDASTrustManagementService.synchronizeTrustLists();
    expect(trustSync.success).toBe(true);

    // Step 3: Create qualified signature
    const signatureRequest = {
      document: {
        id: 'integration-test-doc',
        content: 'Integration test document content',
        fileName: 'test-contract.pdf'
      },
      signer: {
        id: 'integration-user',
        email: 'integration@test.com'
      },
      signatureLevel: 'qualified',
      qtspProvider: 'globalsign'
    };

    const signatureResult = await EIDASQualifiedSignatureService.createQualifiedSignature(signatureRequest);
    expect(signatureResult.success).toBe(true);

    // Step 4: Validate the created signature
    const validationRequest = {
      signatureData: signatureResult.signature,
      signedDocument: signatureRequest.document,
      validationPolicy: 'eidas_qualified'
    };

    const validationResult = await EIDASValidationService.validateSignature(validationRequest);
    expect(validationResult.success).toBe(true);
    expect(validationResult.qualified).toBe(true);
    expect(validationResult.legalEffect).toBe('legally_equivalent_to_handwritten');

    // Step 5: Test cross-border recognition
    const crossBorderResult = await EIDASTrustManagementService.validateCrossBorderSignature(
      signatureResult.signature,
      signatureResult.signature.signingCertificate,
      { requestingMemberState: 'FR', acceptanceCriteria: 'qualified' }
    );

    expect(crossBorderResult.valid).toBe(true);
    expect(crossBorderResult.mutuallyRecognized).toBe(true);
  });
});

export default {
  EIDASQualifiedSignatureService,
  EIDASValidationService,
  EIDASTrustManagementService,
  EIDASConfigurationService
};
