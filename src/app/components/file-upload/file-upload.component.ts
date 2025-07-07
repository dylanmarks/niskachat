import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subject, takeUntil } from 'rxjs';
import {
  Condition,
  FhirClientService,
  FhirContext,
  MedicationRequest,
  Observation,
  Patient,
} from '../../services/fhir-client.service';
import { logger } from '../../utils/logger';

interface FhirBundle {
  resourceType: string;
  id?: string;
  type?: string;
  total?: number;
  entry?: {
    fullUrl?: string;
    resource?: any;
  }[];
}

interface UploadStatus {
  isUploading: boolean;
  progress: number;
  error: string | null;
  success: boolean;
  fileName: string | null;
  extractedResources: {
    patients: Patient[];
    conditions: Condition[];
    observations: Observation[];
    medicationRequests: MedicationRequest[];
  };
}

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.scss',
})
export class FileUploadComponent implements OnInit, OnDestroy {
  context: FhirContext | null = null;
  isDragOver = false;
  selectedFile: File | null = null;

  uploadStatus: UploadStatus = {
    isUploading: false,
    progress: 0,
    error: null,
    success: false,
    fileName: null,
    extractedResources: {
      patients: [],
      conditions: [],
      observations: [],
      medicationRequests: [],
    },
  };

  private destroy$ = new Subject<void>();

  constructor(private fhirClient: FhirClientService) {}

  ngOnInit(): void {
    this.fhirClient.context$
      .pipe(takeUntil(this.destroy$))
      .subscribe((context) => {
        this.context = context;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0 && files[0]) {
      this.handleFileSelection(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0 && input.files[0]) {
      this.handleFileSelection(input.files[0]);
    }
  }

  handleFileSelection(file: File): void {
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.json')) {
      this.uploadStatus.error = 'Please select a valid JSON file.';
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      this.uploadStatus.error = 'File size must be less than 10MB.';
      return;
    }

    this.selectedFile = file;
    this.uploadStatus.fileName = file.name;
    this.uploadStatus.error = null;
    this.uploadStatus.success = false;

    // Automatically start processing after selection
    void this.processFile();
  }

  async processFile(): Promise<void> {
    if (!this.selectedFile) {
      return;
    }

    this.uploadStatus.isUploading = true;
    this.uploadStatus.progress = 0;
    this.uploadStatus.error = null;

    try {
      // Simulate progress for reading file
      this.uploadStatus.progress = 20;

      const fileContent = await this.readFile(this.selectedFile);
      this.uploadStatus.progress = 40;

      const bundle = JSON.parse(fileContent) as FhirBundle;
      this.uploadStatus.progress = 60;

      // Validate bundle
      this.validateBundle(bundle);
      this.uploadStatus.progress = 80;

      // Extract resources
      const extractedResources = this.extractResources(bundle);
      this.uploadStatus.progress = 90;

      // Load extracted resources into the service
      await this.loadResourcesIntoService(extractedResources);
      this.uploadStatus.progress = 100;

      // Success!
      this.uploadStatus.extractedResources = extractedResources;
      this.uploadStatus.success = true;
      this.uploadStatus.isUploading = false;
    } catch (error) {
      logger.error('Error processing FHIR bundle:', error);
      this.uploadStatus.error = `Failed to process file: ${error}`;
      this.uploadStatus.isUploading = false;
      this.uploadStatus.progress = 0;
    }
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsText(file);
    });
  }

  validateBundle(bundle: FhirBundle): void {
    if (!bundle || typeof bundle !== 'object') {
      throw new Error('Invalid JSON format');
    }

    if (bundle.resourceType !== 'Bundle') {
      throw new Error('File is not a FHIR Bundle resource');
    }

    if (!bundle.entry || !Array.isArray(bundle.entry)) {
      throw new Error('Bundle must contain an entry array');
    }

    if (bundle.entry.length === 0) {
      throw new Error('Bundle is empty - no resources found');
    }
  }

  extractResources(bundle: FhirBundle): {
    patients: Patient[];
    conditions: Condition[];
    observations: Observation[];
    medicationRequests: MedicationRequest[];
  } {
    const resources = {
      patients: [] as Patient[],
      conditions: [] as Condition[],
      observations: [] as Observation[],
      medicationRequests: [] as MedicationRequest[],
    };

    for (const entry of bundle.entry || []) {
      const resource = entry.resource;
      if (!resource?.resourceType) {
        continue;
      }

      switch (resource.resourceType) {
        case 'Patient':
          resources.patients.push(this.mapPatient(resource));
          break;
        case 'Condition':
          resources.conditions.push(this.mapCondition(resource));
          break;
        case 'Observation':
          resources.observations.push(this.mapObservation(resource));
          break;
        case 'MedicationRequest':
          resources.medicationRequests.push(
            this.mapMedicationRequest(resource),
          );
          break;
      }
    }

    return resources;
  }

  private mapPatient(resource: any): Patient {
    return {
      resourceType: 'Patient',
      id: resource.id,
      name: resource.name,
      birthDate: resource.birthDate,
      gender: resource.gender,
      identifier: resource.identifier,
      telecom: resource.telecom,
      address: resource.address,
    } as any;
  }

  private mapCondition(resource: any): Condition {
    return {
      resourceType: 'Condition',
      id: resource.id,
      clinicalStatus: resource.clinicalStatus,
      verificationStatus: resource.verificationStatus,
      code: resource.code,
      subject: resource.subject,
      onsetDateTime: resource.onsetDateTime,
      onsetPeriod: resource.onsetPeriod,
      onsetAge: resource.onsetAge,
      recordedDate: resource.recordedDate,
      recorder: resource.recorder,
      asserter: resource.asserter,
    } as any;
  }

  private mapObservation(resource: any): Observation {
    return {
      resourceType: 'Observation',
      id: resource.id,
      status: resource.status,
      code: resource.code,
      subject: resource.subject,
      effectiveDateTime: resource.effectiveDateTime,
      effectivePeriod: resource.effectivePeriod,
      valueQuantity: resource.valueQuantity,
      valueString: resource.valueString,
      valueCodeableConcept: resource.valueCodeableConcept,
      component: resource.component,
      issued: resource.issued,
      performer: resource.performer,
    } as any;
  }

  private mapMedicationRequest(resource: any): MedicationRequest {
    return {
      resourceType: 'MedicationRequest',
      id: resource.id,
      status: resource.status,
      intent: resource.intent,
      category: resource.category,
      priority: resource.priority,
      medicationCodeableConcept: resource.medicationCodeableConcept,
      medicationReference: resource.medicationReference,
      subject: resource.subject,
      encounter: resource.encounter,
      authoredOn: resource.authoredOn,
      requester: resource.requester,
      reasonCode: resource.reasonCode,
      reasonReference: resource.reasonReference,
      dosageInstruction: resource.dosageInstruction,
      dispenseRequest: resource.dispenseRequest,
      substitution: resource.substitution,
    } as any;
  }

  async loadResourcesIntoService(resources: {
    patients: Patient[];
    conditions: Condition[];
    observations: Observation[];
    medicationRequests: MedicationRequest[];
  }): Promise<void> {
    logger.info(
      'FileUploadComponent: loadResourcesIntoService called with resources:',
      resources,
    );
    logger.info(
      'FileUploadComponent: Number of observations:',
      resources.observations.length,
    );

    // For now, we'll focus on the first patient if available
    if (resources.patients.length > 0) {
      const patient: Patient = resources.patients[0]!;
      logger.info(
        'FileUploadComponent: Setting offline mode for patient:',
        patient,
      );

      // Update the FHIR client context with the uploaded patient and resources
      this.fhirClient.setOfflineMode({
        patient,
        conditions: resources.conditions,
        observations: resources.observations,
        medicationRequests: resources.medicationRequests,
      });

      logger.info('FileUploadComponent: Offline mode set successfully');
    } else {
      throw new Error('No Patient resources found in the bundle');
    }
  }

  resetUpload(): void {
    this.selectedFile = null;
    this.uploadStatus = {
      isUploading: false,
      progress: 0,
      error: null,
      success: false,
      fileName: null,
      extractedResources: {
        patients: [],
        conditions: [],
        observations: [],
        medicationRequests: [],
      },
    };
  }

  navigateToAuth(): void {
    window.location.href = '/smart-launch';
  }

  async loadExampleData(patientId: string): Promise<void> {
    try {
      this.uploadStatus.isUploading = true;
      this.uploadStatus.progress = 0;
      this.uploadStatus.error = null;

      // Determine which example file to load
      let fileName: string;
      if (patientId === 'johnsmith') {
        fileName = '/examples/fhir-bundles/patients/fhir_bundle_johnsmith.json';
      } else if (patientId === 'maria') {
        fileName =
          '/examples/fhir-bundles/patients/fhir_bundle_maria_johnson.json';
      } else {
        throw new Error('Unknown patient ID');
      }

      this.uploadStatus.progress = 25;

      // Fetch the example bundle
      const response = await fetch(fileName);
      if (!response.ok) {
        throw new Error(`Failed to load example data: ${response.statusText}`);
      }

      this.uploadStatus.progress = 50;

      const bundleText = await response.text();
      const bundle: FhirBundle = JSON.parse(bundleText);

      this.uploadStatus.progress = 75;

      // Validate and process the bundle
      this.validateBundle(bundle);
      const extractedResources = this.extractResources(bundle);

      // Load into service
      await this.loadResourcesIntoService(extractedResources);

      this.uploadStatus.progress = 100;
      this.uploadStatus.isUploading = false;
      this.uploadStatus.success = true;
      this.uploadStatus.fileName = `${patientId}_example_data.json`;
      this.uploadStatus.extractedResources = extractedResources;

      logger.info(`Successfully loaded example data for patient: ${patientId}`);
    } catch (error) {
      logger.error('Error loading example data:', error);
      this.uploadStatus.isUploading = false;
      this.uploadStatus.error = `Failed to load example data: ${error}`;
    }
  }
}
