import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import {
  FhirClientService,
  FhirContext,
  MedicationRequest,
} from '../../services/fhir-client.service';
import { MedicationsListComponent } from './medications-list.component';

describe('MedicationsListComponent', () => {
  let component: MedicationsListComponent;
  let fixture: ComponentFixture<MedicationsListComponent>;
  let mockFhirService: jasmine.SpyObj<FhirClientService>;

  const mockMedications: MedicationRequest[] = [
    {
      id: 'med-001',
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: {
        text: 'Atorvastatin 20 MG Oral Tablet',
      },
      authoredOn: '2023-01-15T09:30:00Z',
      requester: {
        display: 'Dr. Sarah Johnson',
      },
    } as MedicationRequest,
  ];

  const mockContext: FhirContext = {
    authenticated: true,
    patient: {
      id: 'patient-123',
      name: [{ family: 'Doe', given: ['John'] }],
    },
  };

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('FhirClientService', [
      'getMedicationRequests',
    ]);
    spy.context$ = of(mockContext);

    await TestBed.configureTestingModule({
      imports: [CommonModule, MedicationsListComponent],
      providers: [{ provide: FhirClientService, useValue: spy }],
    }).compileComponents();

    fixture = TestBed.createComponent(MedicationsListComponent);
    component = fixture.componentInstance;
    mockFhirService = TestBed.inject(
      FhirClientService,
    ) as jasmine.SpyObj<FhirClientService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load medications successfully', async () => {
    mockFhirService.getMedicationRequests.and.returnValue(of(mockMedications));

    await component.loadMedications();

    expect(component.medications.length).toBe(1);
    expect(component.isLoading).toBe(false);
    expect(component.errorMessage).toBeNull();
  });

  it('should handle loading errors', async () => {
    mockFhirService.getMedicationRequests.and.returnValue(
      throwError(() => new Error('Test error')),
    );

    await component.loadMedications();

    expect(component.errorMessage).toContain('Failed to load medications');
  });

  it('should get medication name correctly', () => {
    const medication = mockMedications[0];

    expect(medication).toBeDefined();
    const name = component.getMedicationName(medication!);

    expect(name).toBe('Atorvastatin 20 MG Oral Tablet');
  });

  it('should format dates correctly', () => {
    const formatted = component.formatDate('2023-01-15T09:30:00Z');

    expect(formatted).toBe('Jan 15, 2023');
  });

  it('should return correct status display', () => {
    expect(component.getStatusDisplay('active')).toBe('Active');
    expect(component.getStatusDisplay('completed')).toBe('Completed');
  });

  it('should return correct status class', () => {
    expect(component.getStatusClass('active')).toBe('active');
    expect(component.getStatusClass('cancelled')).toBe('cancelled');
  });
});
