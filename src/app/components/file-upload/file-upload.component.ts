import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subject, takeUntil } from 'rxjs';
import {
  AllergyIntolerance,
  Condition,
  FhirClientService,
  FhirContext,
  FhirMedicationRequest,
  Immunization,
  MedicationRequest,
  Observation,
  Patient,
  Procedure,
} from '../../services/fhir-client.service';
import { logger } from '../../utils/logger';

// Define local interfaces for FHIR resources
interface FhirResource {
  resourceType: string;
  id?: string;
}

interface FhirBundleEntry {
  fullUrl?: string;
  resource?: FhirResource;
}

interface FhirBundle {
  resourceType: string;
  id?: string;
  type?: string;
  total?: number;
  entry?: FhirBundleEntry[];
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
    allergyIntolerances: AllergyIntolerance[];
    immunizations: Immunization[];
    procedures: Procedure[];
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
      allergyIntolerances: [],
      immunizations: [],
      procedures: [],
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
      this.loadResourcesIntoService(extractedResources);
      this.uploadStatus.progress = 100;

      // Success!
      this.uploadStatus.extractedResources = extractedResources;
      this.uploadStatus.success = true;
      this.uploadStatus.isUploading = false;
    } catch (error) {
      logger.error('Error processing FHIR bundle:', error);
      this.uploadStatus.error = `Failed to process file: ${error instanceof Error ? error.message : String(error)}`;
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
    allergyIntolerances: AllergyIntolerance[];
    immunizations: Immunization[];
    procedures: Procedure[];
  } {
    const resources = {
      patients: [] as Patient[],
      conditions: [] as Condition[],
      observations: [] as Observation[],
      medicationRequests: [] as MedicationRequest[],
      allergyIntolerances: [] as AllergyIntolerance[],
      immunizations: [] as Immunization[],
      procedures: [] as Procedure[],
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
        case 'AllergyIntolerance':
          resources.allergyIntolerances.push(
            this.mapAllergyIntolerance(resource),
          );
          break;
        case 'Immunization':
          resources.immunizations.push(this.mapImmunization(resource));
          break;
        case 'Procedure':
          resources.procedures.push(this.mapProcedure(resource));
          break;
      }
    }

    return resources;
  }

  private mapPatient(resource: FhirResource): Patient {
    const patientResource = resource as Patient;
    const mapped: Patient = {
      resourceType: 'Patient',
      id: patientResource.id || '',
    };
    if (patientResource.name) mapped.name = patientResource.name;
    if (patientResource.birthDate) mapped.birthDate = patientResource.birthDate;
    if (patientResource.gender) mapped.gender = patientResource.gender;
    if (patientResource.identifier)
      mapped.identifier = patientResource.identifier;
    if (patientResource.telecom) mapped.telecom = patientResource.telecom;
    if (patientResource.address) mapped.address = patientResource.address;
    return mapped;
  }

  private mapCondition(resource: FhirResource): Condition {
    const conditionResource = resource as Condition;
    const mapped: Condition = {
      resourceType: 'Condition',
      id: conditionResource.id || '',
    };
    if (conditionResource.clinicalStatus)
      mapped.clinicalStatus = conditionResource.clinicalStatus;
    if (conditionResource.verificationStatus)
      mapped.verificationStatus = conditionResource.verificationStatus;
    if (conditionResource.code) mapped.code = conditionResource.code;
    if (conditionResource.subject) mapped.subject = conditionResource.subject;
    if (conditionResource.onsetDateTime)
      mapped.onsetDateTime = conditionResource.onsetDateTime;
    if (conditionResource.onsetPeriod)
      mapped.onsetPeriod = conditionResource.onsetPeriod;
    if (conditionResource.onsetAge)
      mapped.onsetAge = conditionResource.onsetAge;
    if (conditionResource.recordedDate)
      mapped.recordedDate = conditionResource.recordedDate;
    if (conditionResource.recorder)
      mapped.recorder = conditionResource.recorder;
    if (conditionResource.asserter)
      mapped.asserter = conditionResource.asserter;
    return mapped;
  }

  private mapObservation(resource: FhirResource): Observation {
    const observationResource = resource as Observation;
    const mapped: Observation = {
      resourceType: 'Observation',
      id: observationResource.id || '',
    };
    if (observationResource.status) mapped.status = observationResource.status;
    if (observationResource.code) mapped.code = observationResource.code;
    if (observationResource.subject)
      mapped.subject = observationResource.subject;
    if (observationResource.effectiveDateTime)
      mapped.effectiveDateTime = observationResource.effectiveDateTime;
    if (observationResource.effectivePeriod)
      mapped.effectivePeriod = observationResource.effectivePeriod;
    if (observationResource.valueQuantity)
      mapped.valueQuantity = observationResource.valueQuantity;
    if (observationResource.valueString)
      mapped.valueString = observationResource.valueString;
    if (observationResource.valueCodeableConcept)
      mapped.valueCodeableConcept = observationResource.valueCodeableConcept;
    if (observationResource.component)
      mapped.component = observationResource.component;
    if (observationResource.issued) mapped.issued = observationResource.issued;
    if (observationResource.performer)
      mapped.performer = observationResource.performer;
    return mapped;
  }

  private mapMedicationRequest(resource: FhirResource): MedicationRequest {
    const medicationResource = resource as unknown as FhirMedicationRequest;
    const mapped: MedicationRequest = {
      resourceType: 'MedicationRequest',
      id: medicationResource.id ?? '',
    };

    if (medicationResource.status) mapped.status = medicationResource.status;
    if (medicationResource.intent) mapped.intent = medicationResource.intent;
    if (medicationResource.category)
      mapped.category = medicationResource.category;
    if (medicationResource.priority)
      mapped.priority = medicationResource.priority;
    if (medicationResource.medicationCodeableConcept)
      mapped.medicationCodeableConcept =
        medicationResource.medicationCodeableConcept;
    if (medicationResource.medicationReference)
      mapped.medicationReference = medicationResource.medicationReference;
    if (medicationResource.subject) mapped.subject = medicationResource.subject;
    if (medicationResource.encounter)
      mapped.encounter = medicationResource.encounter;
    if (medicationResource.authoredOn)
      mapped.authoredOn = medicationResource.authoredOn;
    if (medicationResource.requester)
      mapped.requester = medicationResource.requester;
    if (medicationResource.reasonCode)
      mapped.reasonCode = medicationResource.reasonCode;
    if (medicationResource.reasonReference)
      mapped.reasonReference = medicationResource.reasonReference;
    if (medicationResource.dosageInstruction)
      mapped.dosageInstruction = medicationResource.dosageInstruction;
    if (medicationResource.dispenseRequest)
      mapped.dispenseRequest = medicationResource.dispenseRequest;
    if (medicationResource.substitution)
      mapped.substitution = medicationResource.substitution;

    return mapped;
  }

  private mapAllergyIntolerance(resource: FhirResource): AllergyIntolerance {
    const allergyResource = resource as unknown as AllergyIntolerance;
    const mapped: AllergyIntolerance = {
      resourceType: 'AllergyIntolerance',
      id: allergyResource.id ?? '',
    };

    if (allergyResource.clinicalStatus)
      mapped.clinicalStatus = allergyResource.clinicalStatus;
    if (allergyResource.verificationStatus)
      mapped.verificationStatus = allergyResource.verificationStatus;
    if (allergyResource.type) mapped.type = allergyResource.type;
    if (allergyResource.category) mapped.category = allergyResource.category;
    if (allergyResource.criticality)
      mapped.criticality = allergyResource.criticality;
    if (allergyResource.code) mapped.code = allergyResource.code;
    if (allergyResource.patient) mapped.patient = allergyResource.patient;
    if (allergyResource.onsetDateTime)
      mapped.onsetDateTime = allergyResource.onsetDateTime;
    if (allergyResource.onsetAge) mapped.onsetAge = allergyResource.onsetAge;
    if (allergyResource.onsetPeriod)
      mapped.onsetPeriod = allergyResource.onsetPeriod;
    if (allergyResource.onsetRange)
      mapped.onsetRange = allergyResource.onsetRange;
    if (allergyResource.onsetString)
      mapped.onsetString = allergyResource.onsetString;
    if (allergyResource.recordedDate)
      mapped.recordedDate = allergyResource.recordedDate;
    if (allergyResource.recorder) mapped.recorder = allergyResource.recorder;
    if (allergyResource.asserter) mapped.asserter = allergyResource.asserter;
    if (allergyResource.lastOccurrence)
      mapped.lastOccurrence = allergyResource.lastOccurrence;
    if (allergyResource.note) mapped.note = allergyResource.note;
    if (allergyResource.reaction) mapped.reaction = allergyResource.reaction;

    return mapped;
  }

  private mapImmunization(resource: FhirResource): Immunization {
    const immunizationResource = resource as unknown as Immunization;
    const mapped: Immunization = {
      resourceType: 'Immunization',
      id: immunizationResource.id ?? '',
      status: immunizationResource.status ?? 'unknown',
      vaccineCode: immunizationResource.vaccineCode ?? { coding: [] },
      patient: immunizationResource.patient ?? { reference: '' },
    };

    if (immunizationResource.occurrenceDateTime)
      mapped.occurrenceDateTime = immunizationResource.occurrenceDateTime;
    if (immunizationResource.occurrenceString)
      mapped.occurrenceString = immunizationResource.occurrenceString;
    if (immunizationResource.recorded)
      mapped.recorded = immunizationResource.recorded;
    if (immunizationResource.primarySource !== undefined)
      mapped.primarySource = immunizationResource.primarySource;
    if (immunizationResource.reportOrigin)
      mapped.reportOrigin = immunizationResource.reportOrigin;
    if (immunizationResource.location)
      mapped.location = immunizationResource.location;
    if (immunizationResource.manufacturer)
      mapped.manufacturer = immunizationResource.manufacturer;
    if (immunizationResource.lotNumber)
      mapped.lotNumber = immunizationResource.lotNumber;
    if (immunizationResource.expirationDate)
      mapped.expirationDate = immunizationResource.expirationDate;
    if (immunizationResource.site) mapped.site = immunizationResource.site;
    if (immunizationResource.route) mapped.route = immunizationResource.route;
    if (immunizationResource.doseQuantity)
      mapped.doseQuantity = immunizationResource.doseQuantity;
    if (immunizationResource.performer)
      mapped.performer = immunizationResource.performer;
    if (immunizationResource.note) mapped.note = immunizationResource.note;
    if (immunizationResource.reasonCode)
      mapped.reasonCode = immunizationResource.reasonCode;
    if (immunizationResource.reasonReference)
      mapped.reasonReference = immunizationResource.reasonReference;
    if (immunizationResource.isSubpotent !== undefined)
      mapped.isSubpotent = immunizationResource.isSubpotent;
    if (immunizationResource.subpotentReason)
      mapped.subpotentReason = immunizationResource.subpotentReason;
    if (immunizationResource.education)
      mapped.education = immunizationResource.education;
    if (immunizationResource.programEligibility)
      mapped.programEligibility = immunizationResource.programEligibility;
    if (immunizationResource.fundingSource)
      mapped.fundingSource = immunizationResource.fundingSource;
    if (immunizationResource.reaction)
      mapped.reaction = immunizationResource.reaction;
    if (immunizationResource.protocolApplied)
      mapped.protocolApplied = immunizationResource.protocolApplied;

    return mapped;
  }

  private mapProcedure(resource: FhirResource): Procedure {
    const procedureResource = resource as unknown as Procedure;
    const mapped: Procedure = {
      resourceType: 'Procedure',
      id: procedureResource.id ?? '',
      status: procedureResource.status ?? 'unknown',
      subject: procedureResource.subject ?? { reference: '' },
    };

    if (procedureResource.code) mapped.code = procedureResource.code;
    if (procedureResource.category)
      mapped.category = procedureResource.category;
    if (procedureResource.performedDateTime)
      mapped.performedDateTime = procedureResource.performedDateTime;
    if (procedureResource.performedPeriod)
      mapped.performedPeriod = procedureResource.performedPeriod;
    if (procedureResource.performedString)
      mapped.performedString = procedureResource.performedString;
    if (procedureResource.performedAge)
      mapped.performedAge = procedureResource.performedAge;
    if (procedureResource.performedRange)
      mapped.performedRange = procedureResource.performedRange;
    if (procedureResource.recorder)
      mapped.recorder = procedureResource.recorder;
    if (procedureResource.asserter)
      mapped.asserter = procedureResource.asserter;
    if (procedureResource.performer)
      mapped.performer = procedureResource.performer;
    if (procedureResource.location)
      mapped.location = procedureResource.location;
    if (procedureResource.reasonCode)
      mapped.reasonCode = procedureResource.reasonCode;
    if (procedureResource.reasonReference)
      mapped.reasonReference = procedureResource.reasonReference;
    if (procedureResource.bodySite)
      mapped.bodySite = procedureResource.bodySite;
    if (procedureResource.outcome) mapped.outcome = procedureResource.outcome;
    if (procedureResource.report) mapped.report = procedureResource.report;
    if (procedureResource.complication)
      mapped.complication = procedureResource.complication;
    if (procedureResource.complicationDetail)
      mapped.complicationDetail = procedureResource.complicationDetail;
    if (procedureResource.followUp)
      mapped.followUp = procedureResource.followUp;
    if (procedureResource.note) mapped.note = procedureResource.note;
    if (procedureResource.focalDevice)
      mapped.focalDevice = procedureResource.focalDevice;
    if (procedureResource.usedReference)
      mapped.usedReference = procedureResource.usedReference;
    if (procedureResource.usedCode)
      mapped.usedCode = procedureResource.usedCode;

    return mapped;
  }

  loadResourcesIntoService(resources: {
    patients: Patient[];
    conditions: Condition[];
    observations: Observation[];
    medicationRequests: MedicationRequest[];
    allergyIntolerances: AllergyIntolerance[];
    immunizations: Immunization[];
    procedures: Procedure[];
  }): void {
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
      const patient = resources.patients[0];
      if (!patient) {
        throw new Error('First patient resource is undefined');
      }
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
        allergyIntolerances: resources.allergyIntolerances,
        immunizations: resources.immunizations,
        procedures: resources.procedures,
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
        allergyIntolerances: [],
        immunizations: [],
        procedures: [],
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
      const bundle: FhirBundle = JSON.parse(bundleText) as FhirBundle;

      this.uploadStatus.progress = 75;

      // Validate and process the bundle
      this.validateBundle(bundle);
      const extractedResources = this.extractResources(bundle);

      // Load into service
      this.loadResourcesIntoService(extractedResources);

      this.uploadStatus.progress = 100;
      this.uploadStatus.isUploading = false;
      this.uploadStatus.success = true;
      this.uploadStatus.fileName = `${patientId}_example_data.json`;
      this.uploadStatus.extractedResources = extractedResources;

      logger.info(`Successfully loaded example data for patient: ${patientId}`);
    } catch (error) {
      logger.error('Error loading example data:', error);
      this.uploadStatus.isUploading = false;
      this.uploadStatus.error = `Failed to load example data: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
