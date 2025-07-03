import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import {
  Condition,
  FhirClientService,
  FhirContext,
  MedicationRequest,
  Observation,
  Patient,
} from '../../services/fhir-client.service';

interface FhirBundle {
  resourceType: string;
  id?: string;
  type?: string;
  total?: number;
  entry?: Array<{
    fullUrl?: string;
    resource?: any;
  }>;
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
  imports: [CommonModule],
  template: `
    <div class="file-upload-container">
      <div class="upload-header">
        <h2>📁 Upload FHIR Bundle</h2>
        <p class="upload-subtitle">
          Upload a FHIR Bundle JSON file to view patient data offline
        </p>
      </div>

      <!-- Upload Area -->
      <div
        class="upload-zone"
        [class.drag-over]="isDragOver"
        [class.has-file]="uploadStatus.fileName"
        (click)="fileInput.click()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
      >
        <input
          #fileInput
          type="file"
          accept=".json"
          (change)="onFileSelected($event)"
          style="display: none"
        />

        <!-- Default State -->
        <div
          *ngIf="!uploadStatus.fileName && !uploadStatus.isUploading"
          class="upload-prompt"
        >
          <div class="upload-icon">📁</div>
          <h3>Drag & Drop FHIR Bundle Here</h3>
          <p>
            or
            <span class="browse-link">browse files</span>
          </p>
          <small>Supports .json files up to 10MB</small>
        </div>

        <!-- File Selected -->
        <div
          *ngIf="uploadStatus.fileName && !uploadStatus.isUploading"
          class="file-info"
        >
          <div class="file-icon">📄</div>
          <h3>{{ uploadStatus.fileName }}</h3>
          <p>Ready to process</p>
          <button
            class="process-button"
            (click)="processFile(); $event.stopPropagation()"
          >
            Process Bundle
          </button>
        </div>

        <!-- Processing -->
        <div *ngIf="uploadStatus.isUploading" class="processing-state">
          <div class="spinner"></div>
          <h3>Processing FHIR Bundle...</h3>
          <div class="progress-bar">
            <div
              class="progress-fill"
              [style.width.%]="uploadStatus.progress"
            ></div>
          </div>
          <p>{{ uploadStatus.progress }}% complete</p>
        </div>
      </div>

      <!-- Error State -->
      <div *ngIf="uploadStatus.error" class="error-card">
        <div class="error-icon">⚠️</div>
        <h3>Upload Error</h3>
        <p>{{ uploadStatus.error }}</p>
        <button
          class="retry-button"
          (click)="resetUpload(); $event.stopPropagation()"
        >
          Try Again
        </button>
      </div>

      <!-- Success State -->
      <div *ngIf="uploadStatus.success" class="success-card">
        <div class="success-icon">✅</div>
        <h3>Bundle Processed Successfully!</h3>
        <p>{{ uploadStatus.fileName }} has been processed.</p>

        <div class="extracted-resources">
          <h4>Extracted Resources:</h4>
          <div class="resource-counts">
            <div
              class="resource-count"
              *ngIf="uploadStatus.extractedResources.patients.length > 0"
            >
              <span class="count">
                {{ uploadStatus.extractedResources.patients.length }}
              </span>
              <span class="label">Patient(s)</span>
            </div>
            <div
              class="resource-count"
              *ngIf="uploadStatus.extractedResources.conditions.length > 0"
            >
              <span class="count">
                {{ uploadStatus.extractedResources.conditions.length }}
              </span>
              <span class="label">Condition(s)</span>
            </div>
            <div
              class="resource-count"
              *ngIf="uploadStatus.extractedResources.observations.length > 0"
            >
              <span class="count">
                {{ uploadStatus.extractedResources.observations.length }}
              </span>
              <span class="label">Observation(s)</span>
            </div>
            <div
              class="resource-count"
              *ngIf="
                uploadStatus.extractedResources.medicationRequests.length > 0
              "
            >
              <span class="count">
                {{ uploadStatus.extractedResources.medicationRequests.length }}
              </span>
              <span class="label">Medication(s)</span>
            </div>
          </div>
        </div>

        <button
          class="new-upload-button"
          (click)="resetUpload(); $event.stopPropagation()"
        >
          Upload Another Bundle
        </button>
      </div>

      <!-- Current Context Info -->
      <div *ngIf="context && !context.patient" class="context-info">
        <div class="info-icon">ℹ️</div>
        <p>
          <strong>Offline Mode:</strong>
          Upload a FHIR Bundle to view patient data without connecting to a FHIR
          server.
        </p>

        <!-- Example Data Buttons -->
        <div class="example-data-section">
          <h4>Or try example data:</h4>
          <div class="example-buttons">
            <button
              class="example-button"
              (click)="loadExampleData('johnsmith')"
              [disabled]="uploadStatus.isUploading"
            >
              📊 Load John Smith Data
            </button>
            <button
              class="example-button"
              (click)="loadExampleData('maria')"
              [disabled]="uploadStatus.isUploading"
            >
              📊 Load Maria Johnson Data
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .file-upload-container {
        margin: 0 auto;
        padding: 20px;
        max-width: 800px;
      }

      .upload-header {
        margin-bottom: 30px;
        text-align: center;
      }

      .upload-header h2 {
        margin: 0 0 10px 0;
        color: #333;
        font-weight: 600;
        font-size: 1.8rem;
      }

      .upload-subtitle {
        margin: 0;
        color: #666;
        font-size: 1rem;
      }

      .upload-zone {
        display: flex;
        justify-content: center;
        align-items: center;
        transition: all 0.3s ease;
        cursor: pointer;
        margin-bottom: 20px;
        border: 2px dashed #ccc;
        border-radius: 12px;
        background: #fafafa;
        padding: 40px 20px;
        min-height: 200px;
        text-align: center;
      }

      .upload-zone:hover {
        border-color: #667eea;
        background: #f0f2ff;
      }

      .upload-zone.drag-over {
        transform: scale(1.02);
        border-color: #667eea;
        background: #e8f2ff;
      }

      .upload-zone.has-file {
        border-color: #4caf50;
        background: #f1f8e9;
      }

      .upload-prompt,
      .file-info,
      .processing-state {
        width: 100%;
      }

      .upload-icon,
      .file-icon {
        margin-bottom: 15px;
        font-size: 3rem;
      }

      .upload-prompt h3,
      .file-info h3,
      .processing-state h3 {
        margin: 0 0 10px 0;
        color: #333;
        font-weight: 600;
      }

      .upload-prompt p,
      .file-info p {
        margin: 0 0 15px 0;
        color: #666;
      }

      .browse-link {
        color: #667eea;
        font-weight: 500;
      }

      .upload-prompt small {
        color: #999;
        font-size: 0.85rem;
      }

      .process-button,
      .retry-button,
      .new-upload-button {
        transition: background-color 0.2s;
        cursor: pointer;
        margin-top: 15px;
        border: none;
        border-radius: 6px;
        background: #667eea;
        padding: 12px 24px;
        color: white;
        font-weight: 500;
      }

      .process-button:hover,
      .new-upload-button:hover {
        background: #5a67d8;
      }

      .retry-button {
        background: #e53e3e;
      }

      .retry-button:hover {
        background: #c53030;
      }

      .spinner {
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #667eea;
        border-radius: 50%;
        width: 40px;
        height: 40px;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      .progress-bar {
        margin: 15px 0;
        border-radius: 4px;
        background: #e0e0e0;
        width: 100%;
        height: 8px;
        overflow: hidden;
      }

      .progress-fill {
        transition: width 0.3s ease;
        background: linear-gradient(90deg, #667eea, #764ba2);
        height: 100%;
      }

      .error-card,
      .success-card {
        margin-bottom: 20px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        border-radius: 12px;
        background: white;
        padding: 30px 20px;
        text-align: center;
      }

      .error-card {
        border-left: 4px solid #e53e3e;
      }

      .success-card {
        border-left: 4px solid #4caf50;
      }

      .error-icon,
      .success-icon {
        margin-bottom: 15px;
        font-size: 3rem;
      }

      .error-card h3,
      .success-card h3 {
        margin: 0 0 10px 0;
        color: #333;
        font-weight: 600;
      }

      .error-card p,
      .success-card p {
        margin: 0 0 20px 0;
        color: #666;
      }

      .extracted-resources {
        margin: 20px 0;
        border-radius: 8px;
        background: #f8f9fa;
        padding: 20px;
      }

      .extracted-resources h4 {
        margin: 0 0 15px 0;
        color: #333;
        font-weight: 600;
      }

      .resource-counts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 15px;
      }

      .resource-count {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        background: white;
        padding: 15px;
        text-align: center;
      }

      .resource-count .count {
        display: block;
        margin-bottom: 5px;
        color: #667eea;
        font-weight: 700;
        font-size: 1.5rem;
      }

      .resource-count .label {
        color: #666;
        font-weight: 500;
        font-size: 0.9rem;
      }

      .context-info {
        border: 1px solid #bbdefb;
        border-radius: 8px;
        background: #e3f2fd;
        padding: 15px;
        text-align: center;
      }

      .info-icon {
        margin-bottom: 10px;
        font-size: 1.5rem;
      }

      .context-info p {
        margin: 0;
        color: #1565c0;
        font-size: 0.9rem;
      }

      .example-data-section {
        margin-top: 20px;
      }

      .example-buttons {
        display: flex;
        justify-content: center;
        gap: 10px;
      }

      .example-button {
        transition: background-color 0.2s;
        cursor: pointer;
        border: none;
        border-radius: 6px;
        background: #667eea;
        padding: 12px 24px;
        color: white;
        font-weight: 500;
      }

      .example-button:hover {
        background: #5a67d8;
      }

      @media (max-width: 768px) {
        .file-upload-container {
          padding: 15px;
        }

        .upload-zone {
          padding: 30px 15px;
          min-height: 150px;
        }

        .upload-icon,
        .file-icon {
          font-size: 2.5rem;
        }

        .resource-counts {
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 10px;
        }
      }
    `,
  ],
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
      console.error('Error processing FHIR bundle:', error);
      this.uploadStatus.error = `Failed to process bundle: ${error}`;
      this.uploadStatus.isUploading = false;
      this.uploadStatus.progress = 0;
    }
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
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
      if (!resource || !resource.resourceType) {
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
      id: resource.id,
      name: resource.name,
      birthDate: resource.birthDate,
      gender: resource.gender,
      identifier: resource.identifier,
      telecom: resource.telecom,
      address: resource.address,
    };
  }

  private mapCondition(resource: any): Condition {
    return {
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
    };
  }

  private mapObservation(resource: any): Observation {
    return {
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
    };
  }

  private mapMedicationRequest(resource: any): MedicationRequest {
    return {
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
    };
  }

  async loadResourcesIntoService(resources: {
    patients: Patient[];
    conditions: Condition[];
    observations: Observation[];
    medicationRequests: MedicationRequest[];
  }): Promise<void> {
    console.log(
      'FileUploadComponent: loadResourcesIntoService called with resources:',
      resources,
    );
    console.log(
      'FileUploadComponent: Number of observations:',
      resources.observations.length,
    );

    // For now, we'll focus on the first patient if available
    if (resources.patients.length > 0) {
      const patient: Patient = resources.patients[0]!;
      console.log(
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

      console.log('FileUploadComponent: Offline mode set successfully');
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

      console.log(`Successfully loaded example data for patient: ${patientId}`);
    } catch (error) {
      console.error('Error loading example data:', error);
      this.uploadStatus.isUploading = false;
      this.uploadStatus.error = `Failed to load example data: ${error}`;
    }
  }
}
