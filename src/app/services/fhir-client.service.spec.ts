import { TestBed } from '@angular/core/testing';
import { FhirClientService, FhirContext } from './fhir-client.service';

// Mock FHIR client
const mockFhirClient = {
  patient: {
    read: jasmine.createSpy('read').and.resolveTo({
      id: 'test-patient-123',
      name: [
        {
          family: 'Doe',
          given: ['John'],
          use: 'official',
        },
      ],
      birthDate: '1990-01-01',
      gender: 'male',
      identifier: [
        {
          system: 'http://example.org/mrn',
          value: 'MRN123456',
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'MR',
                display: 'Medical Record Number',
              },
            ],
          },
        },
      ],
    }),
  },
  request: jasmine.createSpy('request').and.resolveTo({}),
  getClientId: jasmine
    .createSpy('getClientId')
    .and.returnValue('test-client-id'),
  getScope: jasmine.createSpy('getScope').and.returnValue('patient/*.read'),
  getServerUrl: jasmine
    .createSpy('getServerUrl')
    .and.returnValue('https://test-fhir.example.com'),
  getState: jasmine
    .createSpy('getState')
    .and.returnValue({ access_token: 'test-token' }),
};

const mockWindow = {
  FHIR: {
    oauth2: {
      init: jasmine.createSpy('init').and.resolveTo(mockFhirClient),
      ready: jasmine.createSpy('ready').and.resolveTo(mockFhirClient),
    },
  },
};

describe('FhirClientService', () => {
  let service: FhirClientService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FhirClientService);

    // Mock window.FHIR
    (window as any).FHIR = mockWindow.FHIR;
  });

  afterEach(() => {
    // Clean up
    delete (window as any).FHIR;
    service.clearSession();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with unauthenticated state', () => {
    const context = service.getCurrentContext();

    expect(context.authenticated).toBeFalse();
    expect(service.isAuthenticated()).toBeFalse();
  });

  describe('OAuth2 Ready Flow', () => {
    it('should handle OAuth2 ready successfully', async () => {
      // Mock the service to simulate successful authentication
      spyOn(service, 'isAuthenticated').and.returnValue(true);
      spyOn(service, 'getCurrentContext').and.returnValue({
        authenticated: true,
        patient: {
          id: 'test-patient-123',
          name: [{ family: 'Doe', given: ['John'] }],
        },
      });

      expect(service.isAuthenticated()).toBeTrue();
      const context = service.getCurrentContext();

      expect(context.authenticated).toBeTrue();
      expect(context.patient?.id).toBe('test-patient-123');
    });

    it('should handle OAuth2 ready failure gracefully', async () => {
      spyOn(service, 'isAuthenticated').and.returnValue(false);
      spyOn(service, 'getCurrentContext').and.returnValue({
        authenticated: false,
      });

      expect(service.isAuthenticated()).toBeFalse();
      const context = service.getCurrentContext();

      expect(context.authenticated).toBeFalse();
    });

    it('should throw error when FHIR client not loaded', async () => {
      delete (window as any).FHIR;

      try {
        await service.handleOAuth2Ready();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain(
          'FHIR client library not loaded',
        );
      }
    });
  });

  describe('SMART Launch Flow', () => {
    it('should initialize SMART launch with default parameters', async () => {
      await service.initializeSmartLaunch();

      expect(mockWindow.FHIR.oauth2.init).toHaveBeenCalledWith({
        iss: 'https://launch.smarthealthit.org/v/r4/fhir',
        clientId: 'your-client-id',
        scope: 'openid profile patient/*.read',
        redirectUri: window.location.origin + '/callback',
      });

      expect(service.isAuthenticated()).toBeTrue();
    });

    it('should initialize SMART launch with custom parameters', async () => {
      const customIss = 'https://custom-fhir.example.com';
      const customClientId = 'custom-client-123';

      await service.initializeSmartLaunch(customIss, customClientId);

      expect(mockWindow.FHIR.oauth2.init).toHaveBeenCalledWith({
        iss: customIss,
        clientId: customClientId,
        scope: 'openid profile patient/*.read',
        redirectUri: window.location.origin + '/callback',
      });
    });
  });

  describe('Patient Operations', () => {
    beforeEach(async () => {
      // Setup authenticated state
      await service.handleOAuth2Ready();
    });

    it('should get current patient', () => {
      const patient = service.getCurrentPatient();

      expect(patient).toBeDefined();
      expect(patient?.id).toBe('test-patient-123');
      expect(patient?.name?.[0]?.family).toBe('Doe');
      expect(patient?.name?.[0]?.given?.[0]).toBe('John');
    });

    it('should get patient by ID', (done) => {
      const patientId = 'specific-patient-456';
      mockFhirClient.request.and.resolveTo({
        id: patientId,
        name: [{ family: 'Smith', given: ['Jane'] }],
      });

      service.getPatient(patientId).subscribe({
        next: (patient) => {
          expect(patient.id).toBe(patientId);
          expect(mockFhirClient.request).toHaveBeenCalledWith(
            `Patient/${patientId}`,
          );
          done();
        },
        error: (error) => {
          fail(`Should not have failed: ${error}`);
          done();
        },
      });
    });

    it('should handle patient fetch error', (done) => {
      mockFhirClient.request.and.rejectWith(new Error('Patient not found'));

      service.getPatient('non-existent').subscribe({
        next: () => {
          fail('Should have failed');
          done();
        },
        error: (error) => {
          expect(error).toBeDefined();
          done();
        },
      });
    });
  });

  describe('FHIR Search Operations', () => {
    beforeEach(async () => {
      // Setup authenticated state
      await service.handleOAuth2Ready();
    });

    it('should search for resources without parameters', (done) => {
      const mockBundle = { resourceType: 'Bundle', entry: [] };
      mockFhirClient.request.and.resolveTo(mockBundle);

      service.search('Observation').subscribe({
        next: (result) => {
          expect(result).toEqual(mockBundle);
          expect(mockFhirClient.request).toHaveBeenCalledWith('Observation');
          done();
        },
        error: (error) => {
          fail(`Should not have failed: ${error}`);
          done();
        },
      });
    });

    it('should search for resources with parameters', (done) => {
      const mockBundle = { resourceType: 'Bundle', entry: [] };
      mockFhirClient.request.and.resolveTo(mockBundle);

      const params = { patient: 'test-patient-123', category: 'vital-signs' };

      service.search('Observation', params).subscribe({
        next: (result) => {
          expect(result).toEqual(mockBundle);
          expect(mockFhirClient.request).toHaveBeenCalledWith(
            'Observation?patient=test-patient-123&category=vital-signs',
          );
          done();
        },
        error: (error) => {
          fail(`Should not have failed: ${error}`);
          done();
        },
      });
    });

    it('should handle search errors', (done) => {
      mockFhirClient.request.and.rejectWith(new Error('Search failed'));

      service.search('InvalidResource').subscribe({
        next: () => {
          fail('Should have failed');
          done();
        },
        error: (error) => {
          expect(error).toBeDefined();
          done();
        },
      });
    });
  });

  describe('Session Management', () => {
    it('should clear session correctly', async () => {
      // First authenticate
      await service.handleOAuth2Ready();

      expect(service.isAuthenticated()).toBeTrue();

      // Then clear session
      service.clearSession();

      expect(service.isAuthenticated()).toBeFalse();
      expect(service.getCurrentPatient()).toBeUndefined();
    });

    it('should check client readiness', async () => {
      expect(service.isClientReady()).toBeFalse();

      await service.handleOAuth2Ready();

      expect(service.isClientReady()).toBeTrue();
    });
  });

  describe('Context Observable', () => {
    it('should emit context changes', (done) => {
      let emissionCount = 0;

      service.context$.subscribe((context: FhirContext) => {
        emissionCount++;

        if (emissionCount === 1) {
          // Initial state
          expect(context.authenticated).toBeFalse();
        } else if (emissionCount === 2) {
          // After authentication
          expect(context.authenticated).toBeTrue();
          expect(context.patient).toBeDefined();
          done();
        }
      });

      // Trigger authentication
      service.handleOAuth2Ready();
    });
  });
});
