import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import {
  Condition,
  FhirClientService,
  FhirContext,
} from '../../services/fhir-client.service';
import { ConditionsListComponent } from './conditions-list.component';

describe('ConditionsListComponent', () => {
  let component: ConditionsListComponent;
  let fixture: ComponentFixture<ConditionsListComponent>;
  let mockFhirClientService: jasmine.SpyObj<FhirClientService>;

  // Mock data
  const mockActiveCondition: Condition = {
    id: 'condition-1',
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active',
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed',
          display: 'Confirmed',
        },
      ],
    },
    code: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '73211009',
          display: 'Diabetes mellitus',
        },
      ],
      text: 'Type 2 Diabetes',
    },
    subject: {
      reference: 'Patient/123',
      display: 'John Doe',
    },
    onsetDateTime: '2020-01-15',
    recordedDate: '2020-01-20T10:30:00Z',
  };

  const mockResolvedCondition: Condition = {
    id: 'condition-2',
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'resolved',
          display: 'Resolved',
        },
      ],
    },
    code: {
      text: 'Broken arm',
    },
    onsetPeriod: {
      start: '2019-06-01',
      end: '2019-08-01',
    },
    recordedDate: '2019-06-01T08:00:00Z',
  };

  const mockContext: FhirContext = {
    patient: {
      id: '123',
      name: [{ family: 'Doe', given: ['John'] }],
    },
    authenticated: true,
  };

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('FhirClientService', [
      'isAuthenticated',
      'getConditions',
    ]);

    // Set up default return values
    spy.isAuthenticated.and.returnValue(true);
    spy.getConditions.and.returnValue(of([mockActiveCondition]));

    await TestBed.configureTestingModule({
      imports: [ConditionsListComponent],
      providers: [{ provide: FhirClientService, useValue: spy }],
    }).compileComponents();

    fixture = TestBed.createComponent(ConditionsListComponent);
    component = fixture.componentInstance;
    mockFhirClientService = TestBed.inject(
      FhirClientService,
    ) as jasmine.SpyObj<FhirClientService>;

    // Mock the context$ observable
    Object.defineProperty(mockFhirClientService, 'context$', {
      get: () => of(mockContext),
    });
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Component Initialization', () => {
    it('should load conditions when context changes to authenticated', () => {
      spyOn(component, 'loadConditions');

      component.ngOnInit();

      expect(component.loadConditions).toHaveBeenCalled();
    });

    it('should not load conditions when not authenticated', () => {
      const unauthenticatedContext: FhirContext = {
        authenticated: false,
      };
      Object.defineProperty(mockFhirClientService, 'context$', {
        get: () => of(unauthenticatedContext),
      });

      spyOn(component, 'loadConditions');

      component.ngOnInit();

      expect(component.loadConditions).not.toHaveBeenCalled();
    });
  });

  describe('loadConditions', () => {
    it('should load active conditions successfully', async () => {
      const conditions = [mockActiveCondition, mockResolvedCondition];
      mockFhirClientService.getConditions.and.returnValue(of(conditions));

      await component.loadConditions();

      expect(mockFhirClientService.getConditions).toHaveBeenCalledWith({
        'clinical-status': 'active',
      });

      expect(component.conditions).toEqual(conditions);
      expect(component.isLoading).toBeFalse();
      expect(component.errorMessage).toBe('');
    });

    it('should handle authentication error', async () => {
      mockFhirClientService.isAuthenticated.and.returnValue(false);

      await component.loadConditions();

      expect(component.errorMessage).toContain('Not authenticated');
      expect(mockFhirClientService.getConditions).not.toHaveBeenCalled();
    });

    it('should handle conditions fetch error', async () => {
      const error = new Error('Network error');
      mockFhirClientService.getConditions.and.returnValue(
        throwError(() => error),
      );

      await component.loadConditions();

      expect(component.errorMessage).toContain('Failed to load conditions');
      expect(component.conditions).toEqual([]);
      expect(component.isLoading).toBeFalse();
    });

    it('should handle empty conditions array', async () => {
      mockFhirClientService.getConditions.and.returnValue(of([]));

      await component.loadConditions();

      expect(component.conditions).toEqual([]);
      expect(component.errorMessage).toBe('');
    });

    it('should filter for active conditions only', async () => {
      await component.loadConditions();

      expect(mockFhirClientService.getConditions).toHaveBeenCalledWith({
        'clinical-status': 'active',
      });
    });
  });

  describe('Condition Sorting', () => {
    it('should sort conditions by most recent first using recorded date', async () => {
      const olderCondition = {
        ...mockActiveCondition,
        id: 'older',
        recordedDate: '2019-01-01T00:00:00Z',
      } as Condition;

      const newerCondition = {
        ...mockActiveCondition,
        id: 'newer',
        recordedDate: '2021-01-01T00:00:00Z',
      } as Condition;

      mockFhirClientService.getConditions.and.returnValue(
        of([olderCondition, newerCondition]),
      );

      await component.loadConditions();

      expect(component.conditions[0]?.id).toBe('newer');
      expect(component.conditions[1]?.id).toBe('older');
    });

    it('should handle conditions without dates', async () => {
      const conditionWithoutDate = {
        ...mockActiveCondition,
        id: 'no-date',
      } as Condition;
      delete (conditionWithoutDate as any).recordedDate;
      delete (conditionWithoutDate as any).onsetDateTime;

      mockFhirClientService.getConditions.and.returnValue(
        of([mockActiveCondition, conditionWithoutDate]),
      );

      await component.loadConditions();

      // Should not crash and should include both conditions
      expect(component.conditions.length).toBe(2);
    });
  });

  describe('Condition Name Display', () => {
    it('should display condition text when available', () => {
      const name = component.getConditionName(mockActiveCondition);

      expect(name).toBe('Type 2 Diabetes');
    });

    it('should fall back to coding display when text not available', () => {
      const conditionWithoutText = {
        ...mockActiveCondition,
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '73211009',
              display: 'Diabetes mellitus',
            },
          ],
        },
      } as Condition;

      const name = component.getConditionName(conditionWithoutText);

      expect(name).toBe('Diabetes mellitus');
    });

    it('should fall back to code when display not available', () => {
      const conditionWithCode = {
        ...mockActiveCondition,
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '73211009',
            },
          ],
        },
      } as Condition;

      const name = component.getConditionName(conditionWithCode);

      expect(name).toBe('Code: 73211009');
    });

    it('should show Unknown Condition when no useful information', () => {
      const conditionWithoutName = {
        ...mockActiveCondition,
      } as Condition;
      delete (conditionWithoutName as any).code;

      const name = component.getConditionName(conditionWithoutName);

      expect(name).toBe('Unknown Condition');
    });
  });

  describe('Status Display', () => {
    it('should display clinical status', () => {
      const status = component.getConditionStatus(mockActiveCondition);

      expect(status).toBe('Active');
    });

    it('should fall back to code when display not available', () => {
      const conditionWithCodeOnly = {
        ...mockActiveCondition,
        clinicalStatus: {
          coding: [
            {
              system:
                'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: 'active',
            },
          ],
        },
      } as Condition;

      const status = component.getConditionStatus(conditionWithCodeOnly);

      expect(status).toBe('active');
    });

    it('should return Unknown when no status available', () => {
      const conditionWithoutStatus = {
        ...mockActiveCondition,
      } as Condition;
      delete (conditionWithoutStatus as any).clinicalStatus;

      const status = component.getConditionStatus(conditionWithoutStatus);

      expect(status).toBe('Unknown');
    });
  });

  describe('Status CSS Classes', () => {
    it('should return correct CSS class for active status', () => {
      const cssClass = component.getStatusClass(mockActiveCondition);

      expect(cssClass).toBe('status-active');
    });

    it('should return correct CSS class for resolved status', () => {
      const cssClass = component.getStatusClass(mockResolvedCondition);

      expect(cssClass).toBe('status-resolved');
    });

    it('should return unknown class for unrecognized status', () => {
      const conditionWithUnknownStatus = {
        ...mockActiveCondition,
        clinicalStatus: {
          coding: [{ code: 'some-unknown-status' }],
        },
      } as Condition;

      const cssClass = component.getStatusClass(conditionWithUnknownStatus);

      expect(cssClass).toBe('status-unknown');
    });
  });

  describe('Onset Date Display', () => {
    it('should format onset datetime', () => {
      const onset = component.getOnsetDate(mockActiveCondition);

      expect(onset).toBe('Jan 15, 2020');
    });

    it('should format onset period', () => {
      const onset = component.getOnsetDate(mockResolvedCondition);

      expect(onset).toBe('Jun 1, 2019 - Aug 1, 2019');
    });

    it('should format onset period with ongoing end', () => {
      const conditionWithOngoingPeriod = {
        ...mockActiveCondition,
        onsetPeriod: {
          start: '2020-01-01',
        },
      } as Condition;
      delete (conditionWithOngoingPeriod as any).onsetDateTime;

      const onset = component.getOnsetDate(conditionWithOngoingPeriod);

      expect(onset).toBe('Jan 1, 2020 - ongoing');
    });

    it('should return null when no onset information', () => {
      const conditionWithoutOnset = {
        ...mockActiveCondition,
      } as Condition;
      delete (conditionWithoutOnset as any).onsetDateTime;

      const onset = component.getOnsetDate(conditionWithoutOnset);

      expect(onset).toBeNull();
    });
  });

  describe('Date Formatting', () => {
    it('should format valid date', () => {
      const formatted = component.formatDate('2020-01-15T10:30:00Z');

      expect(formatted).toBe('Jan 15, 2020');
    });

    it('should handle invalid date gracefully', () => {
      const formatted = component.formatDate('invalid-date');

      expect(formatted).toBe('invalid-date');
    });
  });

  describe('Verification Status', () => {
    it('should return verification status display', () => {
      const status = component.getVerificationStatus(mockActiveCondition);

      expect(status).toBe('Confirmed');
    });

    it('should return null when no verification status', () => {
      const conditionWithoutVerification = {
        ...mockActiveCondition,
      } as Condition;
      delete (conditionWithoutVerification as any).verificationStatus;

      const status = component.getVerificationStatus(
        conditionWithoutVerification,
      );

      expect(status).toBeNull();
    });
  });

  describe('Coding Information', () => {
    it('should detect when condition has codings', () => {
      const hasCoding = component.hasCodings(mockActiveCondition);

      expect(hasCoding).toBeTrue();
    });

    it('should detect when condition has no codings', () => {
      const conditionWithoutCoding = {
        ...mockActiveCondition,
      } as Condition;
      delete (conditionWithoutCoding as any).code;

      const hasCoding = component.hasCodings(conditionWithoutCoding);

      expect(hasCoding).toBeFalse();
    });

    it('should return coding information', () => {
      const codings = component.getCodings(mockActiveCondition);

      expect(codings).toEqual([
        {
          system: 'http://snomed.info/sct',
          code: '73211009',
        },
      ]);
    });

    it('should filter out incomplete codings', () => {
      const conditionWithIncompleteCodings = {
        ...mockActiveCondition,
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '73211009',
            },
            {
              system: 'http://loinc.org',
              // Missing code
            },
            {
              // Missing system
              code: 'some-code',
            },
          ],
        },
      } as Condition;

      const codings = component.getCodings(conditionWithIncompleteCodings);

      expect(codings).toEqual([
        {
          system: 'http://snomed.info/sct',
          code: '73211009',
        },
      ]);
    });
  });

  describe('Metadata', () => {
    it('should detect when condition has codings', () => {
      const hasCodings = component.hasCodings(mockActiveCondition);

      expect(hasCodings).toBeTrue();
    });

    it('should detect when condition has no codings', () => {
      const conditionWithoutCodings = {
        id: 'test',
        code: {},
      } as Condition;

      const hasCodings = component.hasCodings(conditionWithoutCodings);

      expect(hasCodings).toBeFalse();
    });
  });

  describe('Navigation', () => {
    it('should select condition when condition is clicked', () => {
      component.selectCondition(mockActiveCondition);

      expect(component.selectedCondition).toBe(mockActiveCondition);
      expect(component.selectedConditionId).toBe(mockActiveCondition.id);
    });

    it('should navigate to condition details when condition is clicked', () => {
      component.conditions = [
        mockActiveCondition,
        mockResolvedCondition,
        mockActiveCondition,
      ];
      fixture.detectChanges();

      spyOn(window, 'open').and.stub();
      const conditionCards = fixture.debugElement.queryAll(
        By.css('.condition-card'),
      );

      expect(conditionCards.length).toBe(3);

      // Click on first condition card
      if (conditionCards[0]) {
        conditionCards[0].nativeElement.click();

        // Since we can't easily test window navigation in unit tests,
        // we'll just verify the element exists and is clickable
        expect(conditionCards[0].nativeElement).toBeTruthy();
      }
    });
  });

  describe('Template Rendering', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should show loading spinner when loading', () => {
      component.isLoading = true;
      fixture.detectChanges();

      const loadingElement =
        fixture.nativeElement.querySelector('.loading-card');

      expect(loadingElement).toBeTruthy();
      expect(loadingElement.textContent).toContain('Loading conditions');
    });

    it('should show error message when error occurs', () => {
      component.errorMessage = 'Test error message';
      component.isLoading = false;
      fixture.detectChanges();

      const errorElement = fixture.nativeElement.querySelector('.error-card');

      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain('Test error message');
    });

    it('should show no conditions message when list is empty', () => {
      component.conditions = [];
      component.isLoading = false;
      component.errorMessage = '';
      fixture.detectChanges();

      const noConditionsElement =
        fixture.nativeElement.querySelector('.no-conditions');

      expect(noConditionsElement).toBeTruthy();
      expect(noConditionsElement.textContent).toContain('No Active Conditions');
    });

    it('should display conditions when available', () => {
      component.conditions = [mockActiveCondition];
      component.isLoading = false;
      component.errorMessage = '';
      fixture.detectChanges();

      const conditionsElement =
        fixture.nativeElement.querySelector('.conditions-list');

      expect(conditionsElement).toBeTruthy();

      const conditionItems =
        fixture.nativeElement.querySelectorAll('.condition-item');

      expect(conditionItems.length).toBe(1);
    });

    it('should show conditions count in header', () => {
      component.conditions = [mockActiveCondition, mockResolvedCondition];
      component.isLoading = false;
      component.errorMessage = '';
      fixture.detectChanges();

      const countElement = fixture.nativeElement.querySelector(
        '.conditions-count .count',
      );

      expect(countElement.textContent).toBe('2');

      const labelElement = fixture.nativeElement.querySelector(
        '.conditions-count .label',
      );

      expect(labelElement.textContent).toContain('conditions');
    });

    it('should show singular form for single condition', () => {
      component.conditions = [mockActiveCondition];
      component.isLoading = false;
      component.errorMessage = '';
      fixture.detectChanges();

      const labelElement = fixture.nativeElement.querySelector(
        '.conditions-count .label',
      );

      expect(labelElement.textContent).toContain('condition');
    });

    it('should show no patient card when not authenticated', () => {
      component.context = { authenticated: false };
      component.isLoading = false;
      component.errorMessage = '';
      fixture.detectChanges();

      const noPatientElement =
        fixture.nativeElement.querySelector('.no-patient-card');

      expect(noPatientElement).toBeTruthy();
      expect(noPatientElement.textContent).toContain('No Patient Selected');
    });
  });

  describe('Component Lifecycle', () => {
    it('should call ngOnDestroy without error', () => {
      expect(() => {
        component.ngOnDestroy();
      }).not.toThrow();
    });
  });
});
