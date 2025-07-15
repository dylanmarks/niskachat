import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import {
  FhirClientService,
  FhirContext,
  Patient,
} from '../../services/fhir-client.service';
import { PatientSummaryComponent } from './patient-summary.component';

describe('PatientSummaryComponent', () => {
  let component: PatientSummaryComponent;
  let fixture: ComponentFixture<PatientSummaryComponent>;
  let mockFhirClient: jasmine.SpyObj<FhirClientService>;
  let contextSubject: BehaviorSubject<FhirContext>;

  const mockPatient: Patient = {
    resourceType: 'Patient',
    id: 'patient-123',
    name: [
      {
        family: 'Doe',
        given: ['John', 'William'],
      },
    ],
    birthDate: '1985-03-15',
    gender: 'male',
    identifier: [
      {
        type: {
          coding: [
            {
              code: 'MR',
              display: 'Medical Record Number',
            },
          ],
        },
        value: 'MRN-123456',
      },
    ],
    telecom: [
      {
        system: 'phone',
        value: '555-1234',
      },
      {
        system: 'email',
        value: 'john.doe@example.com',
      },
    ],
    address: [
      {
        use: 'home',
        line: ['123 Main St'],
        city: 'Anytown',
        state: 'CA',
        postalCode: '12345',
        country: 'USA',
      },
    ],
  };

  beforeEach(async () => {
    contextSubject = new BehaviorSubject<FhirContext>({ authenticated: false });

    mockFhirClient = jasmine.createSpyObj<FhirClientService>(
      'FhirClientService',
      ['isAuthenticated', 'getPatient'],
      {
        context$: contextSubject.asObservable(),
      },
    );

    await TestBed.configureTestingModule({
      imports: [PatientSummaryComponent],
      providers: [{ provide: FhirClientService, useValue: mockFhirClient }],
    }).compileComponents();

    fixture = TestBed.createComponent(PatientSummaryComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    contextSubject.complete();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with initial state', () => {
    fixture.detectChanges();

    expect(component.isLoading).toBeFalse();
    expect(component.errorMessage).toBe('');
    expect(component.patient).toBeNull();
    expect(component.context).toEqual({ authenticated: false });
  });

  describe('Context Updates', () => {
    it('should update patient when context changes with patient', () => {
      const contextWithPatient: FhirContext = {
        authenticated: true,
        patient: mockPatient,
        clientId: 'test-client',
        serverUrl: 'https://test.fhir.org',
      };

      fixture.detectChanges();
      contextSubject.next(contextWithPatient);

      expect(component.context).toEqual(contextWithPatient);
      expect(component.patient).toEqual(mockPatient);
      expect(component.errorMessage).toBe('');
    });

    it('should load patient when context is authenticated but no patient', () => {
      mockFhirClient.isAuthenticated.and.returnValue(true);
      mockFhirClient.getPatient.and.returnValue(of(mockPatient));
      spyOn(component, 'loadPatient').and.callThrough();

      const contextWithoutPatient: FhirContext = {
        authenticated: true,
        clientId: 'test-client',
      };

      fixture.detectChanges();
      contextSubject.next(contextWithoutPatient);

      expect(component.loadPatient).toHaveBeenCalled();
    });
  });

  describe('loadPatient', () => {
    it('should load patient successfully', async () => {
      mockFhirClient.isAuthenticated.and.returnValue(true);
      mockFhirClient.getPatient.and.returnValue(of(mockPatient));

      await component.loadPatient();

      expect(component.patient).toEqual(mockPatient);
      expect(component.errorMessage).toBe('');
      expect(component.isLoading).toBeFalse();
    });

    it('should handle authentication error', async () => {
      mockFhirClient.isAuthenticated.and.returnValue(false);

      await component.loadPatient();

      expect(component.errorMessage).toContain('Not authenticated');
      expect(component.patient).toBeNull();
    });

    it('should handle patient loading error', async () => {
      mockFhirClient.isAuthenticated.and.returnValue(true);
      mockFhirClient.getPatient.and.returnValue(
        throwError(() => new Error('Network error')),
      );

      await component.loadPatient();

      expect(component.errorMessage).toContain('Failed to load patient');
      expect(component.isLoading).toBeFalse();
    });
  });

  describe('getPatientName', () => {
    it('should format complete patient name', () => {
      component.patient = mockPatient;

      expect(component.getPatientName()).toBe('John William Doe');
    });

    it('should handle patient with only family name', () => {
      component.patient = {
        resourceType: 'Patient',
        id: 'test',
        name: [{ family: 'Smith' }],
      };

      expect(component.getPatientName()).toBe('Smith');
    });

    it('should handle patient with only given names', () => {
      component.patient = {
        resourceType: 'Patient',
        id: 'test',
        name: [{ given: ['Jane', 'Marie'] }],
      };

      expect(component.getPatientName()).toBe('Jane Marie');
    });

    it('should return "Unknown Patient" for missing name', () => {
      component.patient = { resourceType: 'Patient', id: 'test' };

      expect(component.getPatientName()).toBe('Unknown Patient');
    });

    it('should return "Unknown Patient" for null patient', () => {
      component.patient = null;

      expect(component.getPatientName()).toBe('Unknown Patient');
    });
  });

  describe('getAge', () => {
    beforeEach(() => {
      // Mock current date to 2024-01-07 for consistent testing
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date('2024-01-07'));
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('should calculate age correctly', () => {
      component.patient = { ...mockPatient, birthDate: '1985-03-15' };

      expect(component.getAge()).toBe(38); // 2024 - 1985 = 39, but birthday hasn't occurred yet
    });

    it('should handle birthday this year', () => {
      component.patient = { ...mockPatient, birthDate: '1990-12-25' };

      expect(component.getAge()).toBe(33); // Birthday already passed
    });

    it('should return null for missing birth date', () => {
      component.patient = { resourceType: 'Patient', id: 'test' };

      expect(component.getAge()).toBeNull();
    });

    it('should return null for future birth date', () => {
      component.patient = { ...mockPatient, birthDate: '2030-01-01' };

      expect(component.getAge()).toBeNull();
    });
  });

  describe('formatDate', () => {
    it('should format valid date', () => {
      const result = component.formatDate('1985-03-15');

      expect(result).toBe('March 15, 1985');
    });

    it('should return original string for invalid date', () => {
      const result = component.formatDate('invalid-date');

      expect(result).toBe('invalid-date');
    });
  });

  describe('formatGender', () => {
    it('should capitalize gender', () => {
      expect(component.formatGender('male')).toBe('Male');
      expect(component.formatGender('female')).toBe('Female');
      expect(component.formatGender('UNKNOWN')).toBe('Unknown');
    });
  });

  describe('getMedicalRecordNumber', () => {
    it('should find MRN identifier', () => {
      component.patient = mockPatient;

      expect(component.getMedicalRecordNumber()).toBe('MRN-123456');
    });

    it('should return null when no MRN found', () => {
      component.patient = {
        resourceType: 'Patient',
        id: 'test',
        identifier: [
          {
            type: { coding: [{ code: 'SSN' }] },
            value: '123-45-6789',
          },
        ],
      };

      expect(component.getMedicalRecordNumber()).toBeNull();
    });

    it('should return null when no identifiers', () => {
      component.patient = { resourceType: 'Patient', id: 'test' };

      expect(component.getMedicalRecordNumber()).toBeNull();
    });
  });

  describe('Contact Information', () => {
    beforeEach(() => {
      component.patient = mockPatient;
    });

    it('should detect contact information', () => {
      expect(component.hasContactInfo()).toBeTrue();
    });

    it('should format contact information', () => {
      const contacts = component.getContactInfo();

      expect(contacts).toEqual([
        { type: 'phone', value: '555-1234' },
        { type: 'email', value: 'john.doe@example.com' },
      ]);
    });

    it('should handle missing contact info', () => {
      component.patient = { resourceType: 'Patient', id: 'test' };

      expect(component.hasContactInfo()).toBeFalse();
      expect(component.getContactInfo()).toEqual([]);
    });
  });

  describe('Addresses', () => {
    beforeEach(() => {
      component.patient = mockPatient;
    });

    it('should detect addresses', () => {
      expect(component.hasAddresses()).toBeTrue();
    });

    it('should format addresses', () => {
      const addresses = component.getAddresses();

      expect(addresses).toEqual([
        {
          type: 'home',
          text: '123 Main St, Anytown, CA, 12345, USA',
        },
      ]);
    });

    it('should handle missing addresses', () => {
      component.patient = { resourceType: 'Patient', id: 'test' };

      expect(component.hasAddresses()).toBeFalse();
      expect(component.getAddresses()).toEqual([]);
    });
  });

  describe('Metadata', () => {
    it('should detect metadata', () => {
      component.context = {
        authenticated: true,
        clientId: 'test-client',
        serverUrl: 'https://test.fhir.org',
      };

      expect(component.hasMetadata()).toBeTrue();
    });

    it('should handle missing metadata', () => {
      component.context = { authenticated: true };

      expect(component.hasMetadata()).toBeFalse();
    });
  });

  describe('Navigation', () => {
    it('should navigate to auth', () => {
      // Mock window.location
      delete (window as any).location;
      (window as any).location = { href: '' };

      component.navigateToAuth();

      expect((window as any).location.href).toBe('/smart-launch');
    });
  });

  describe('Component Rendering', () => {
    it('should render valid patient', () => {
      component.patient = mockPatient;
      component.isLoading = false;
      component.errorMessage = '';

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.querySelector('.patient-card')).toBeTruthy();
      expect(compiled.textContent).toContain('John William Doe');
    });

    it('should handle missing fields gracefully', () => {
      component.patient = { resourceType: 'Patient', id: 'minimal-patient' };
      component.isLoading = false;
      component.errorMessage = '';

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.querySelector('.patient-card')).toBeTruthy();
      expect(compiled.textContent).toContain('Unknown Patient');
    });

    it('should show loading state', () => {
      component.isLoading = true;

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.querySelector('.loading-card')).toBeTruthy();
      expect(compiled.textContent).toContain('Loading patient information');
    });

    it('should show error state', () => {
      component.errorMessage = 'Test error message';

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.querySelector('.error-card')).toBeTruthy();
      expect(compiled.textContent).toContain('Test error message');
    });

    it('should show no patient state', () => {
      component.patient = null;
      component.isLoading = false;
      component.errorMessage = '';

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.querySelector('.no-patient-card')).toBeTruthy();
      expect(compiled.textContent).toContain('No Patient Selected');
    });
  });
});
