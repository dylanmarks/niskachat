import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  firstValueFrom,
  from,
  of,
  throwError,
} from 'rxjs';
import { catchError, map } from 'rxjs/operators';

// Import FHIR client
import { oauth2 } from 'fhirclient';
import { logger } from '../utils/logger';

// FHIR Resource Base Interface
interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
  };
}

// Error interfaces for type safety
interface FhirError {
  message: string;
  status?: number;
  details?: unknown;
}

// FHIR Bundle Interface
interface FhirBundle extends FhirResource {
  resourceType: 'Bundle';
  type: string;
  entry?: FhirBundleEntry[];
}

interface FhirBundleEntry {
  resource?: FhirResource;
  fullUrl?: string;
}

// FHIR Patient Resource Interface
interface FhirPatient extends FhirResource {
  resourceType: 'Patient';
  name?: FhirHumanName[];
  birthDate?: string;
  gender?: string;
  identifier?: FhirIdentifier[];
  telecom?: FhirContactPoint[];
  address?: FhirAddress[];
}

interface FhirHumanName {
  family?: string;
  given?: string[];
  use?: string;
}

interface FhirIdentifier {
  system?: string;
  value?: string;
  type?: FhirCodeableConcept;
}

interface FhirContactPoint {
  system?: string;
  value?: string;
  use?: string;
}

interface FhirAddress {
  use?: string;
  text?: string;
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

// Application Patient Interface (for our components)
export interface Patient {
  resourceType: 'Patient';
  id: string;
  name?: FhirHumanName[];
  birthDate?: string;
  gender?: string;
  identifier?: FhirIdentifier[];
  telecom?: FhirContactPoint[];
  address?: FhirAddress[];
}

// FHIR Condition Resource Interface
interface FhirCondition extends FhirResource {
  resourceType: 'Condition';
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  onsetDateTime?: string;
  onsetPeriod?: FhirPeriod;
  onsetAge?: FhirAge;
  recordedDate?: string;
  recorder?: FhirReference;
  asserter?: FhirReference;
}

interface FhirReference {
  reference?: string;
  display?: string;
}

interface FhirPeriod {
  start?: string;
  end?: string;
}

interface FhirAge {
  value?: number;
  unit?: string;
}

// Application Condition Interface (for our components)
export interface Condition {
  resourceType: 'Condition';
  id: string;
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  onsetDateTime?: string;
  onsetPeriod?: FhirPeriod;
  onsetAge?: FhirAge;
  recordedDate?: string;
  recorder?: FhirReference;
  asserter?: FhirReference;
}

// FHIR Observation Resource Interface
interface FhirObservation extends FhirResource {
  resourceType: 'Observation';
  status?: string;
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  effectiveDateTime?: string;
  effectivePeriod?: FhirPeriod;
  valueQuantity?: FhirQuantity;
  valueString?: string;
  valueCodeableConcept?: FhirCodeableConcept;
  component?: FhirObservationComponent[];
  issued?: string;
  performer?: FhirReference[];
}

interface FhirQuantity {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
}

interface FhirObservationComponent {
  code?: FhirCodeableConcept;
  valueQuantity?: FhirQuantity;
  valueString?: string;
  valueCodeableConcept?: FhirCodeableConcept;
}

// Application Observation Interface (for our components)
export interface Observation {
  resourceType: 'Observation';
  id: string;
  status?: string;
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  effectiveDateTime?: string;
  effectivePeriod?: FhirPeriod;
  valueQuantity?: FhirQuantity;
  valueString?: string;
  valueCodeableConcept?: FhirCodeableConcept;
  component?: FhirObservationComponent[];
  issued?: string;
  performer?: FhirReference[];
}

// FHIR MedicationRequest Resource Interface
interface FhirMedicationRequest extends FhirResource {
  resourceType: 'MedicationRequest';
  status?: string;
  intent?: string;
  category?: FhirCodeableConcept[];
  priority?: string;
  medicationCodeableConcept?: FhirCodeableConcept;
  medicationReference?: FhirReference;
  subject?: FhirReference;
  encounter?: FhirReference;
  authoredOn?: string;
  requester?: FhirReference;
  reasonCode?: FhirCodeableConcept[];
  reasonReference?: FhirReference[];
  dosageInstruction?: FhirDosage[];
}

interface FhirDosage {
  text?: string;
  timing?: FhirTiming;
  route?: FhirCodeableConcept;
  doseAndRate?: FhirDoseAndRate[];
}

interface FhirTiming {
  repeat?: {
    frequency?: number;
    period?: number;
    periodUnit?: string;
  };
}

interface FhirDoseAndRate {
  doseQuantity?: FhirQuantity;
  doseRange?: FhirRange;
}

interface FhirRange {
  low?: FhirQuantity;
  high?: FhirQuantity;
}

// Application MedicationRequest Interface (for our components)
export interface MedicationRequest {
  resourceType: 'MedicationRequest';
  id: string;
  status?: string;
  intent?: string;
  category?: FhirCodeableConcept[];
  priority?: string;
  medicationCodeableConcept?: FhirCodeableConcept;
  medicationReference?: FhirReference;
  subject?: FhirReference;
  encounter?: FhirReference;
  authoredOn?: string;
  requester?: FhirReference;
  reasonCode?: FhirCodeableConcept[];
  reasonReference?: FhirReference[];
  dosageInstruction?: FhirDosage[];
  dispenseRequest?: {
    quantity?: FhirQuantity;
  };
  substitution?: unknown;
}

export interface FhirContext {
  patient?: Patient;
  clientId?: string;
  scope?: string;
  serverUrl?: string;
  tokenResponse?: Record<string, unknown>;
  authenticated: boolean;
  isOfflineMode?: boolean;
}

export interface OfflineModeData {
  patient: Patient;
  conditions: Condition[];
  observations: Observation[];
  medicationRequests: MedicationRequest[];
}

@Injectable({
  providedIn: 'root',
})
export class FhirClientService {
  private contextSubject = new BehaviorSubject<FhirContext>({
    authenticated: false,
  });
  private fhirClient: {
    patient: { read: () => Promise<unknown> };
    request: (url: string) => Promise<unknown>;
    getClientId?: () => unknown;
    getScope?: () => unknown;
    getServerUrl?: () => unknown;
    getState?: (key: string) => unknown;
  } | null = null;
  private offlineData: OfflineModeData | null = null;

  public context$ = this.contextSubject.asObservable();

  constructor() {
    void this.loadFhirClient();
  }

  /**
   * Load FHIR client library dynamically
   */
  private async loadFhirClient(): Promise<void> {
    // FHIR client is already available as an import
    // No need to load from CDN
  }

  /**
   * Initialize SMART launch (for EHR context)
   */
  async initializeSmartLaunch(iss?: string, clientId?: string): Promise<void> {
    try {
      const client = await oauth2.init({
        iss: iss ?? 'https://launch.smarthealthit.org/v/r4/fhir',
        clientId: clientId ?? 'your-client-id',
        scope: 'openid profile patient/*.read',
        redirectUri: window.location.origin + '/callback',
      });

      this.fhirClient = client;
      await this.loadPatientContext();
    } catch (error) {
      logger.error('SMART launch initialization failed:', error);
      throw error;
    }
  }

  /**
   * Handle OAuth2 ready state (after redirect back from authorization server)
   */
  async handleOAuth2Ready(): Promise<void> {
    try {
      const client = await oauth2.ready();
      this.fhirClient = client;
      await this.loadPatientContext();
    } catch (error) {
      logger.error('OAuth2 ready failed:', error);
      this.contextSubject.next({ authenticated: false });
      throw error;
    }
  }

  /**
   * Load patient context from FHIR server
   */
  private async loadPatientContext(): Promise<void> {
    try {
      if (!this.fhirClient) {
        throw new Error('FHIR client not initialized');
      }

      const patient = await this.fhirClient.patient.read();

      const clientId = this.fhirClient.getClientId?.();
      const scope = this.fhirClient.getScope?.();
      const serverUrl = this.fhirClient.getServerUrl?.();
      const tokenResponse = this.fhirClient.getState?.('tokenResponse');

      const context: FhirContext = {
        patient: this.mapFhirPatient(patient),
        clientId: typeof clientId === 'string' ? clientId : 'unknown',
        scope: typeof scope === 'string' ? scope : 'unknown',
        serverUrl: typeof serverUrl === 'string' ? serverUrl : 'unknown',
        tokenResponse: tokenResponse as Record<string, unknown>,
        authenticated: true,
      };

      this.contextSubject.next(context);
    } catch (error) {
      logger.error('Failed to load patient context:', error);
      this.contextSubject.next({ authenticated: false });
      throw error;
    }
  }

  /**
   * Type guard to check if object is a FHIR Patient
   */
  private isFhirPatient(obj: unknown): obj is FhirPatient {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'resourceType' in obj &&
      (obj as Record<string, unknown>)['resourceType'] === 'Patient' &&
      'id' in obj &&
      typeof (obj as Record<string, unknown>)['id'] === 'string'
    );
  }

  /**
   * Map FHIR Patient resource to our interface
   */
  private mapFhirPatient(fhirPatient: unknown): Patient {
    if (!this.isFhirPatient(fhirPatient)) {
      throw new Error('Invalid FHIR Patient resource');
    }

    const mapped: Patient = {
      resourceType: 'Patient',
      id: fhirPatient.id ?? 'unknown',
    };
    if (fhirPatient.name) mapped.name = fhirPatient.name;
    if (fhirPatient.birthDate) mapped.birthDate = fhirPatient.birthDate;
    if (fhirPatient.gender) mapped.gender = fhirPatient.gender;
    if (fhirPatient.identifier) mapped.identifier = fhirPatient.identifier;
    if (fhirPatient.telecom) mapped.telecom = fhirPatient.telecom;
    if (fhirPatient.address) mapped.address = fhirPatient.address;
    return mapped;
  }

  /**
   * Get patient by ID
   */
  getPatient(patientId?: string): Observable<Patient> {
    return from(this.getPatientAsync(patientId)).pipe(
      map((patient) => this.mapFhirPatient(patient)),
      catchError((error: unknown) => {
        logger.error('Error fetching patient:', error);
        const fhirError: FhirError = {
          message: error instanceof Error ? error.message : 'Unknown error fetching patient',
          details: error
        };
        return throwError(() => fhirError);
      }),
    );
  }

  private async getPatientAsync(patientId?: string): Promise<unknown> {
    if (!this.fhirClient) {
      throw new Error('FHIR client not initialized');
    }

    if (patientId) {
      return await this.fhirClient.request(`Patient/${patientId}`);
    } else {
      return await this.fhirClient.patient.read();
    }
  }

  /**
   * Search for resources
   */
  /**
   * Type guard to check if object is a FHIR Bundle
   */
  private isFhirBundle(obj: unknown): obj is FhirBundle {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'resourceType' in obj &&
      (obj as Record<string, unknown>)['resourceType'] === 'Bundle'
    );
  }

  search(
    resourceType: string,
    params: Record<string, unknown> = {},
  ): Observable<FhirBundle> {
    return from(this.searchAsync(resourceType, params)).pipe(
      map((result: unknown) => {
        if (!this.isFhirBundle(result)) {
          throw new Error('Invalid FHIR Bundle response');
        }
        return result;
      }),
      catchError((error: unknown) => {
        logger.error(`Error searching ${resourceType}:`, error);
        const fhirError: FhirError = {
          message: error instanceof Error ? error.message : `Unknown error searching ${resourceType}`,
          details: error
        };
        return throwError(() => fhirError);
      }),
    );
  }

  private async searchAsync(
    resourceType: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.fhirClient) {
      throw new Error('FHIR client not initialized');
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => {
          searchParams.append(key, String(v));
        });
      } else {
        searchParams.append(key, String(value));
      }
    });
    const query = searchParams.toString();
    const url = query ? `${resourceType}?${query}` : resourceType;

    return await this.fhirClient.request(url);
  }

  /**
   * Get current authentication status
   */
  isAuthenticated(): boolean {
    return this.contextSubject.value.authenticated;
  }

  /**
   * Get current patient
   */
  getCurrentPatient(): Patient | undefined {
    return this.contextSubject.value.patient;
  }

  /**
   * Get current FHIR context
   */
  getCurrentContext(): FhirContext {
    return this.contextSubject.value;
  }

  /**
   * Clear current session
   */
  clearSession(): void {
    this.fhirClient = null;
    this.contextSubject.next({ authenticated: false });
  }

  /**
   * Get conditions for current patient
   */
  getConditions(params: Record<string, string> = {}): Observable<Condition[]> {
    const currentPatient = this.getCurrentPatient();
    if (!currentPatient) {
      return throwError(() => new Error('No current patient'));
    }

    // If in offline mode, return offline data
    if (this.isOfflineMode() && this.offlineData) {
      let conditions = this.offlineData.conditions;

      // Apply basic filtering based on status parameter
      if (params['status']) {
        const statusFilter = params['status'].split(',');
        conditions = conditions.filter((condition) => {
          const clinicalStatus = condition.clinicalStatus?.coding?.[0]?.code;
          return clinicalStatus && statusFilter.includes(clinicalStatus);
        });
      }

      return of(conditions);
    }

    const searchParams = {
      patient: currentPatient.id,
      ...params,
    };

    return this.search('Condition', searchParams).pipe(
      map((bundle) => {
        if (bundle?.entry) {
          return bundle.entry
            .map((entry: FhirBundleEntry) => entry.resource)
            .filter((condition: unknown): condition is FhirResource => !!condition)
            .map((condition: unknown) => this.mapFhirCondition(condition));
        }
        return [];
      }),
      catchError((error: unknown) => {
        logger.error('Error fetching conditions:', error);
        const fhirError: FhirError = {
          message: error instanceof Error ? error.message : 'Unknown error fetching conditions',
          details: error
        };
        return throwError(() => fhirError);
      }),
    );
  }

  /**
   * Type guard to check if object is a FHIR Condition
   */
  private isFhirCondition(obj: unknown): obj is FhirCondition {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'resourceType' in obj &&
      (obj as Record<string, unknown>)['resourceType'] === 'Condition' &&
      'id' in obj &&
      typeof (obj as Record<string, unknown>)['id'] === 'string'
    );
  }

  /**
   * Map FHIR Condition resource to our interface
   */
  private mapFhirCondition(fhirCondition: unknown): Condition {
    if (!this.isFhirCondition(fhirCondition)) {
      throw new Error('Invalid FHIR Condition resource');
    }

    const mapped: Condition = {
      resourceType: 'Condition',
      id: fhirCondition.id ?? 'unknown',
    };
    if (fhirCondition.clinicalStatus) mapped.clinicalStatus = fhirCondition.clinicalStatus;
    if (fhirCondition.verificationStatus) mapped.verificationStatus = fhirCondition.verificationStatus;
    if (fhirCondition.code) mapped.code = fhirCondition.code;
    if (fhirCondition.subject) mapped.subject = fhirCondition.subject;
    if (fhirCondition.onsetDateTime) mapped.onsetDateTime = fhirCondition.onsetDateTime;
    if (fhirCondition.onsetPeriod) mapped.onsetPeriod = fhirCondition.onsetPeriod;
    if (fhirCondition.onsetAge) mapped.onsetAge = fhirCondition.onsetAge;
    if (fhirCondition.recordedDate) mapped.recordedDate = fhirCondition.recordedDate;
    if (fhirCondition.recorder) mapped.recorder = fhirCondition.recorder;
    if (fhirCondition.asserter) mapped.asserter = fhirCondition.asserter;
    return mapped;
  }

  /**
   * Get observations for current patient
   */
  getObservations(params: Record<string, string> = {}): Observable<Observation[]> {
    const currentPatient = this.getCurrentPatient();

    if (!currentPatient) {
      return throwError(() => new Error('No current patient'));
    }

    // If in offline mode, return offline data
    if (this.isOfflineMode() && this.offlineData) {
      let observations = this.offlineData.observations;

      // Apply basic filtering based on code parameter (LOINC codes)
      if (params['code']) {
        const codeFilter = params['code'].split(',');
        observations = observations.filter((observation) => {
          const codes =
            observation.code?.coding?.map((coding) => coding.code).filter(Boolean) ?? [];
          return codes.some((code) => code && codeFilter.includes(code));
        });
      }

      return of(observations);
    }

    const searchParams = {
      patient: currentPatient.id,
      ...params,
    };

    return this.search('Observation', searchParams).pipe(
      map((bundle) => {
        if (bundle?.entry) {
          return bundle.entry
            .map((entry: FhirBundleEntry) => entry.resource)
            .filter((observation: unknown): observation is FhirResource => !!observation)
            .map((observation: unknown) => this.mapFhirObservation(observation));
        }
        return [];
      }),
      catchError((error: unknown) => {
        logger.error('Error fetching observations:', error);
        const fhirError: FhirError = {
          message: error instanceof Error ? error.message : 'Unknown error fetching observations',
          details: error
        };
        return throwError(() => fhirError);
      }),
    );
  }

  /**
   * Type guard to check if object is a FHIR Observation
   */
  private isFhirObservation(obj: unknown): obj is FhirObservation {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'resourceType' in obj &&
      (obj as Record<string, unknown>)['resourceType'] === 'Observation' &&
      'id' in obj &&
      typeof (obj as Record<string, unknown>)['id'] === 'string'
    );
  }

  /**
   * Map FHIR Observation resource to our interface
   */
  private mapFhirObservation(fhirObservation: unknown): Observation {
    if (!this.isFhirObservation(fhirObservation)) {
      throw new Error('Invalid FHIR Observation resource');
    }

    const mapped: Observation = {
      resourceType: 'Observation',
      id: fhirObservation.id ?? 'unknown',
    };
    if (fhirObservation.status) mapped.status = fhirObservation.status;
    if (fhirObservation.code) mapped.code = fhirObservation.code;
    if (fhirObservation.subject) mapped.subject = fhirObservation.subject;
    if (fhirObservation.effectiveDateTime) mapped.effectiveDateTime = fhirObservation.effectiveDateTime;
    if (fhirObservation.effectivePeriod) mapped.effectivePeriod = fhirObservation.effectivePeriod;
    if (fhirObservation.valueQuantity) mapped.valueQuantity = fhirObservation.valueQuantity;
    if (fhirObservation.valueString) mapped.valueString = fhirObservation.valueString;
    if (fhirObservation.valueCodeableConcept) mapped.valueCodeableConcept = fhirObservation.valueCodeableConcept;
    if (fhirObservation.component) mapped.component = fhirObservation.component;
    if (fhirObservation.issued) mapped.issued = fhirObservation.issued;
    if (fhirObservation.performer) mapped.performer = fhirObservation.performer;
    return mapped;
  }

  /**
   * Get medication requests for current patient
   */
  getMedicationRequests(
    params: Record<string, string> = {},
  ): Observable<MedicationRequest[]> {
    const currentPatient = this.getCurrentPatient();
    if (!currentPatient) {
      return throwError(() => new Error('No current patient'));
    }

    // If in offline mode, return offline data
    if (this.isOfflineMode() && this.offlineData) {
      let medicationRequests = this.offlineData.medicationRequests;

      // Apply basic filtering based on status parameter
      if (params['status']) {
        const statusFilter = params['status'].split(',');
        medicationRequests = medicationRequests.filter((medRequest) => {
          return medRequest.status && statusFilter.includes(medRequest.status);
        });
      }

      return of(medicationRequests);
    }

    const searchParams = {
      patient: currentPatient.id,
      ...params,
    };

    return this.search('MedicationRequest', searchParams).pipe(
      map((bundle) => {
        if (bundle?.entry) {
          return bundle.entry
            .map((entry: FhirBundleEntry) => entry.resource)
            .filter((medicationRequest: unknown): medicationRequest is FhirResource => !!medicationRequest)
            .map((medicationRequest: unknown) =>
              this.mapFhirMedicationRequest(medicationRequest),
            );
        }
        return [];
      }),
      catchError((error: unknown) => {
        logger.error('Error fetching medication requests:', error);
        const fhirError: FhirError = {
          message: error instanceof Error ? error.message : 'Unknown error fetching medication requests',
          details: error
        };
        return throwError(() => fhirError);
      }),
    );
  }

  /**
   * Type guard to check if object is a FHIR MedicationRequest
   */
  private isFhirMedicationRequest(obj: unknown): obj is FhirMedicationRequest {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'resourceType' in obj &&
      (obj as Record<string, unknown>)['resourceType'] === 'MedicationRequest' &&
      'id' in obj &&
      typeof (obj as Record<string, unknown>)['id'] === 'string'
    );
  }

  /**
   * Map FHIR MedicationRequest resource to our interface
   */
  private mapFhirMedicationRequest(
    fhirMedicationRequest: unknown,
  ): MedicationRequest {
    if (!this.isFhirMedicationRequest(fhirMedicationRequest)) {
      throw new Error('Invalid FHIR MedicationRequest resource');
    }

    const mapped: MedicationRequest = {
      resourceType: 'MedicationRequest',
      id: fhirMedicationRequest.id ?? 'unknown',
    };
    if (fhirMedicationRequest.status) mapped.status = fhirMedicationRequest.status;
    if (fhirMedicationRequest.intent) mapped.intent = fhirMedicationRequest.intent;
    if (fhirMedicationRequest.category) mapped.category = fhirMedicationRequest.category;
    if (fhirMedicationRequest.priority) mapped.priority = fhirMedicationRequest.priority;
    if (fhirMedicationRequest.medicationCodeableConcept) mapped.medicationCodeableConcept = fhirMedicationRequest.medicationCodeableConcept;
    if (fhirMedicationRequest.medicationReference) mapped.medicationReference = fhirMedicationRequest.medicationReference;
    if (fhirMedicationRequest.subject) mapped.subject = fhirMedicationRequest.subject;
    if (fhirMedicationRequest.encounter) mapped.encounter = fhirMedicationRequest.encounter;
    if (fhirMedicationRequest.authoredOn) mapped.authoredOn = fhirMedicationRequest.authoredOn;
    if (fhirMedicationRequest.requester) mapped.requester = fhirMedicationRequest.requester;
    if (fhirMedicationRequest.reasonCode) mapped.reasonCode = fhirMedicationRequest.reasonCode;
    if (fhirMedicationRequest.reasonReference) mapped.reasonReference = fhirMedicationRequest.reasonReference;
    if (fhirMedicationRequest.dosageInstruction) mapped.dosageInstruction = fhirMedicationRequest.dosageInstruction;
    // Add fields that might exist in FHIR but not in our interface
    const anyResource = fhirMedicationRequest as any;
    if (anyResource.dispenseRequest) mapped.dispenseRequest = anyResource.dispenseRequest;
    if (anyResource.substitution) mapped.substitution = anyResource.substitution;
    return mapped;
  }

  /**
   * Check if FHIR client is ready
   */
  isClientReady(): boolean {
    return this.fhirClient !== null;
  }

  /**
   * Set offline mode with uploaded FHIR Bundle data
   */
  setOfflineMode(data: OfflineModeData): void {
    this.offlineData = data;
    const newContext = {
      patient: data.patient,
      authenticated: true,
      isOfflineMode: true,
    };

    this.contextSubject.next(newContext);
  }

  /**
   * Clear offline mode and return to online mode
   */
  clearOfflineMode(): void {
    this.offlineData = null;
    this.contextSubject.next({
      authenticated: false,
      isOfflineMode: false,
    });
  }

  /**
   * Check if currently in offline mode
   */
  isOfflineMode(): boolean {
    return this.contextSubject.value.isOfflineMode ?? false;
  }

  /**
   * Build a comprehensive FHIR Bundle with all available patient data
   * This method gathers all resources for the current patient and builds a Bundle
   * @returns {Promise<FhirBundle>} Complete FHIR Bundle
   */
  async buildComprehensiveFhirBundle(): Promise<FhirBundle> {
    logger.debug('buildComprehensiveFhirBundle called');

    const currentPatient = this.getCurrentPatient();
    if (!currentPatient) {
      throw new Error('No current patient available');
    }

    logger.debug('Current patient retrieved');

    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [],
    };

    // Ensure entry array exists
    if (!bundle.entry) {
      bundle.entry = [];
    }

    try {
      // Add patient resource
      bundle.entry.push({
        resource: currentPatient,
      });

      logger.debug('Added patient resource to bundle');

      // If in offline mode, use offline data
      if (this.isOfflineMode() && this.offlineData) {
        logger.debug('Using offline data');

        // Add conditions
        logger.debug(
          'Adding conditions:',
          this.offlineData.conditions?.length || 0,
        );
        this.offlineData.conditions?.forEach((condition) => {
          bundle.entry?.push({
            resource: condition,
          });
        });

        // Add observations
        logger.debug(
          'Adding observations:',
          this.offlineData.observations?.length || 0,
        );
        this.offlineData.observations?.forEach((observation) => {
          bundle.entry?.push({
            resource: observation,
          });
        });

        // Add medication requests
        logger.debug(
          'Adding medication requests:',
          this.offlineData.medicationRequests?.length || 0,
        );
        this.offlineData.medicationRequests?.forEach((medicationRequest) => {
          bundle.entry?.push({
            resource: medicationRequest,
          });
        });
      } else {
        // Fetch all available resources using the existing methods
        try {
          const conditions = await firstValueFrom(this.getConditions());
          conditions?.forEach((condition) => {
            bundle.entry?.push({
              resource: condition,
            });
          });
        } catch (error) {
          logger.warn('Could not fetch conditions:', error);
        }

        try {
          const observations = await firstValueFrom(this.getObservations());
          observations?.forEach((observation) => {
            bundle.entry?.push({
              resource: observation,
            });
          });
        } catch (error) {
          logger.warn('Could not fetch observations:', error);
        }

        try {
          const medicationRequests = await firstValueFrom(
            this.getMedicationRequests(),
          );
          medicationRequests?.forEach((medicationRequest) => {
            bundle.entry?.push({
              resource: medicationRequest,
            });
          });
        } catch (error) {
          logger.warn('Could not fetch medication requests:', error);
        }

        // Try to fetch other common resource types that might be available
        try {
          const allergyResponse = await firstValueFrom(
            this.search('AllergyIntolerance', {
              patient: currentPatient.id,
            }),
          );
          if (allergyResponse?.entry) {
            allergyResponse.entry.forEach((entry: FhirBundleEntry) => {
              if (entry.resource) {
                bundle.entry?.push({ resource: entry.resource });
              }
            });
          }
        } catch (error) {
          logger.warn('Could not fetch allergies:', error);
        }

        try {
          const procedureResponse = await firstValueFrom(
            this.search('Procedure', {
              patient: currentPatient.id,
            }),
          );
          if (procedureResponse?.entry) {
            procedureResponse.entry.forEach((entry: FhirBundleEntry) => {
              if (entry.resource) {
                bundle.entry?.push({ resource: entry.resource });
              }
            });
          }
        } catch (error) {
          logger.warn('Could not fetch procedures:', error);
        }

        try {
          const diagnosticResponse = await firstValueFrom(
            this.search('DiagnosticReport', {
              patient: currentPatient.id,
            }),
          );
          if (diagnosticResponse?.entry) {
            diagnosticResponse.entry.forEach((entry: FhirBundleEntry) => {
              if (entry.resource) {
                bundle.entry?.push({ resource: entry.resource });
              }
            });
          }
        } catch (error) {
          logger.warn('Could not fetch diagnostic reports:', error);
        }

        try {
          const encounterResponse = await firstValueFrom(
            this.search('Encounter', {
              patient: currentPatient.id,
            }),
          );
          if (encounterResponse?.entry) {
            encounterResponse.entry.forEach((entry: FhirBundleEntry) => {
              if (entry.resource) {
                bundle.entry?.push({ resource: entry.resource });
              }
            });
          }
        } catch (error) {
          logger.warn('Could not fetch encounters:', error);
        }

        try {
          const immunizationResponse = await firstValueFrom(
            this.search('Immunization', {
              patient: currentPatient.id,
            }),
          );
          if (immunizationResponse?.entry) {
            immunizationResponse.entry.forEach((entry: FhirBundleEntry) => {
              if (entry.resource) {
                bundle.entry?.push({ resource: entry.resource });
              }
            });
          }
        } catch (error) {
          logger.warn('Could not fetch immunizations:', error);
        }
      }

      logger.debug(
        'Completed FHIR bundle with',
        bundle.entry?.length ?? 0,
        'entries',
      );
      return bundle;
    } catch (error) {
      logger.error('Error building comprehensive FHIR bundle:', error);
      throw error;
    }
  }
}
