import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import {
  FhirClientService,
  Observation,
} from '../../services/fhir-client.service';
import { ObservationsChartComponent } from './observations-chart.component';

describe('ObservationsChartComponent', () => {
  let component: ObservationsChartComponent;
  let fixture: ComponentFixture<ObservationsChartComponent>;
  let mockFhirService: jasmine.SpyObj<FhirClientService>;

  const mockObservations: Observation[] = [
    {
      id: 'obs-1',
      status: 'final',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '8480-6',
            display: 'Systolic blood pressure',
          },
        ],
        text: 'Systolic blood pressure',
      },
      subject: { reference: 'Patient/123' },
      effectiveDateTime: '2023-01-15T10:30:00Z',
      valueQuantity: {
        value: 120,
        unit: 'mmHg',
        system: 'http://unitsofmeasure.org',
        code: 'mm[Hg]',
      },
    } as Observation,
    {
      id: 'obs-2',
      status: 'final',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '8462-4',
            display: 'Diastolic blood pressure',
          },
        ],
        text: 'Diastolic blood pressure',
      },
      subject: { reference: 'Patient/123' },
      effectiveDateTime: '2023-01-15T10:30:00Z',
      valueQuantity: {
        value: 80,
        unit: 'mmHg',
        system: 'http://unitsofmeasure.org',
        code: 'mm[Hg]',
      },
    } as Observation,
    {
      id: 'obs-3',
      status: 'final',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '4548-4',
            display: 'Hemoglobin A1c/Hemoglobin.total in Blood',
          },
        ],
        text: 'HbA1c',
      },
      subject: { reference: 'Patient/123' },
      effectiveDateTime: '2023-02-01T09:15:00Z',
      valueQuantity: {
        value: 6.5,
        unit: '%',
        system: 'http://unitsofmeasure.org',
        code: '%',
      },
    } as Observation,
  ];

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('FhirClientService', ['getObservations']);

    await TestBed.configureTestingModule({
      imports: [ObservationsChartComponent],
      providers: [{ provide: FhirClientService, useValue: spy }],
    }).compileComponents();

    fixture = TestBed.createComponent(ObservationsChartComponent);
    component = fixture.componentInstance;
    mockFhirService = TestBed.inject(
      FhirClientService,
    ) as jasmine.SpyObj<FhirClientService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Component Initialization', () => {
    it('should initialize with default state', () => {
      expect(component.loading).toBe(false);
      expect(component.error).toBe('');
      expect(component.observations).toEqual([]);
      expect(component.selectedCategory).toBe('all');
    });

    it('should load observations on init', () => {
      mockFhirService.getObservations.and.returnValue(of(mockObservations));
      component.ngOnInit();
      expect(mockFhirService.getObservations).toHaveBeenCalled();
      expect(component.observations).toEqual(mockObservations);
    });
  });

  describe('Data Loading', () => {
    it('should handle successful observation loading', () => {
      mockFhirService.getObservations.and.returnValue(of(mockObservations));
      component.loadObservations();
      expect(component.observations).toEqual(mockObservations);
      expect(component.error).toBe('');
      expect(component.loading).toBe(false);
    });

    it('should handle observation loading errors', () => {
      const errorMessage = 'Failed to load observations';
      mockFhirService.getObservations.and.returnValue(
        throwError(() => new Error(errorMessage)),
      );
      component.loadObservations();
      expect(component.error).toBe(errorMessage);
      expect(component.loading).toBe(false);
      expect(component.observations).toEqual([]);
    });
  });

  describe('LOINC Code Filtering', () => {
    it('should filter blood pressure observations', () => {
      const bpObservations = component.filterObservationsByCategory(
        mockObservations,
        'blood-pressure',
      );
      expect(bpObservations.length).toBe(2);
      expect(bpObservations[0]?.code?.coding?.[0]?.code).toBe('8480-6');
      expect(bpObservations[1]?.code?.coding?.[0]?.code).toBe('8462-4');
    });

    it('should filter A1c observations', () => {
      const a1cObservations = component.filterObservationsByCategory(
        mockObservations,
        'a1c',
      );
      expect(a1cObservations.length).toBe(1);
      expect(a1cObservations[0]?.code?.coding?.[0]?.code).toBe('4548-4');
    });

    it('should return all observations for "all" category', () => {
      const allObservations = component.filterObservationsByCategory(
        mockObservations,
        'all',
      );
      expect(allObservations.length).toBe(3);
    });
  });

  describe('Chart Data Preparation', () => {
    it('should prepare chart data from observations', () => {
      component.observations = mockObservations;
      component.prepareChartData();
      expect(component.chartData).toBeDefined();
    });

    it('should group observations by type', () => {
      const grouped = component.groupObservationsByType(mockObservations);
      expect(grouped['Systolic blood pressure']).toBeDefined();
      expect(grouped['Diastolic blood pressure']).toBeDefined();
      expect(grouped['HbA1c']).toBeDefined();
    });

    it('should sort observations by date', () => {
      const unsortedObs = [mockObservations[2], mockObservations[0]].filter(
        (obs) => obs !== undefined,
      );
      const sorted = component.sortObservationsByDate(unsortedObs);
      expect(sorted[0]?.effectiveDateTime).toBe('2023-01-15T10:30:00Z');
      expect(sorted[1]?.effectiveDateTime).toBe('2023-02-01T09:15:00Z');
    });
  });

  describe('Value Extraction', () => {
    it('should extract numeric value from valueQuantity', () => {
      const observation = mockObservations[0];
      if (observation) {
        const value = component.extractObservationValue(observation);
        expect(value).toBe(120);
      }
    });

    it('should return null for observations without numeric values', () => {
      const obsWithoutValue = {
        ...mockObservations[0],
        valueString: 'text value',
      } as Observation;
      delete (obsWithoutValue as any).valueQuantity;
      const value = component.extractObservationValue(obsWithoutValue);
      expect(value).toBeNull();
    });
  });

  describe('Date Handling', () => {
    it('should extract date from effectiveDateTime', () => {
      const observation = mockObservations[0];
      if (observation) {
        const date = component.extractObservationDate(observation);
        expect(date).toBe('2023-01-15T10:30:00Z');
      }
    });

    it('should return null for observations without date', () => {
      const obsWithoutDate = {
        ...mockObservations[0],
      } as Observation;
      delete (obsWithoutDate as any).effectiveDateTime;
      const date = component.extractObservationDate(obsWithoutDate);
      expect(date).toBeNull();
    });
  });

  describe('Template Integration', () => {
    it('should render loading state', () => {
      component.loading = true;
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Loading observations...');
    });

    it('should render error state', () => {
      component.error = 'Test error message';
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Test error message');
    });
  });
});
