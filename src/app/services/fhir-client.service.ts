import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

// Import FHIR client
import { oauth2 } from 'fhirclient';

export interface Patient {
  id: string;
  name?: {
    family?: string;
    given?: string[];
    use?: string;
  }[];
  birthDate?: string;
  gender?: string;
  identifier?: {
    system?: string;
    value?: string;
    type?: {
      coding?: {
        system?: string;
        code?: string;
        display?: string;
      }[];
    };
  }[];
  telecom?: {
    system?: string;
    value?: string;
    use?: string;
  }[];
  address?: {
    use?: string;
    text?: string;
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }[];
}

export interface Condition {
  id: string;
  clinicalStatus?: {
    coding?: {
      system?: string;
      code?: string;
      display?: string;
    }[];
  };
  verificationStatus?: {
    coding?: {
      system?: string;
      code?: string;
      display?: string;
    }[];
  };
  code?: {
    coding?: {
      system?: string;
      code?: string;
      display?: string;
    }[];
    text?: string;
  };
  subject?: {
    reference?: string;
    display?: string;
  };
  onsetDateTime?: string;
  onsetPeriod?: {
    start?: string;
    end?: string;
  };
  onsetAge?: {
    value?: number;
    unit?: string;
  };
  recordedDate?: string;
  recorder?: {
    reference?: string;
    display?: string;
  };
  asserter?: {
    reference?: string;
    display?: string;
  };
}

export interface Observation {
  id: string;
  status?: string;
  code?: {
    coding?: {
      system?: string;
      code?: string;
      display?: string;
    }[];
    text?: string;
  };
  subject?: {
    reference?: string;
    display?: string;
  };
  effectiveDateTime?: string;
  effectivePeriod?: {
    start?: string;
    end?: string;
  };
  valueQuantity?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  valueString?: string;
  valueCodeableConcept?: {
    coding?: {
      system?: string;
      code?: string;
      display?: string;
    }[];
    text?: string;
  };
  component?: {
    code?: {
      coding?: {
        system?: string;
        code?: string;
        display?: string;
      }[];
      text?: string;
    };
    valueQuantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    valueString?: string;
    valueCodeableConcept?: {
      coding?: {
        system?: string;
        code?: string;
        display?: string;
      }[];
      text?: string;
    };
  }[];
  issued?: string;
  performer?: {
    reference?: string;
    display?: string;
  }[];
}

export interface MedicationRequest {
  id: string;
  status?: string;
  intent?: string;
  category?: {
    coding?: {
      system?: string;
      code?: string;
      display?: string;
    }[];
    text?: string;
  }[];
  priority?: string;
  medicationCodeableConcept?: {
    coding?: {
      system?: string;
      code?: string;
      display?: string;
    }[];
    text?: string;
  };
  medicationReference?: {
    reference?: string;
    display?: string;
  };
  subject?: {
    reference?: string;
    display?: string;
  };
  encounter?: {
    reference?: string;
    display?: string;
  };
  authoredOn?: string;
  requester?: {
    reference?: string;
    display?: string;
  };
  reasonCode?: {
    coding?: {
      system?: string;
      code?: string;
      display?: string;
    }[];
    text?: string;
  }[];
  reasonReference?: {
    reference?: string;
    display?: string;
  }[];
  dosageInstruction?: {
    text?: string;
    timing?: {
      repeat?: {
        frequency?: number;
        period?: number;
        periodUnit?: string;
      };
    };
    route?: {
      coding?: {
        system?: string;
        code?: string;
        display?: string;
      }[];
      text?: string;
    };
    doseAndRate?: {
      doseQuantity?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
      doseRange?: {
        low?: {
          value?: number;
          unit?: string;
          system?: string;
          code?: string;
        };
        high?: {
          value?: number;
          unit?: string;
          system?: string;
          code?: string;
        };
      };
    }[];
  }[];
  dispenseRequest?: {
    numberOfRepeatsAllowed?: number;
    quantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    expectedSupplyDuration?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
  };
  substitution?: {
    allowedBoolean?: boolean;
    allowedCodeableConcept?: {
      coding?: {
        system?: string;
        code?: string;
        display?: string;
      }[];
      text?: string;
    };
    reason?: {
      coding?: {
        system?: string;
        code?: string;
        display?: string;
      }[];
      text?: string;
    };
  };
}

export interface FhirContext {
  patient?: Patient;
  clientId?: string;
  scope?: string;
  serverUrl?: string;
  tokenResponse?: any;
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
  private fhirClient: any = null;
  private offlineData: OfflineModeData | null = null;

  public context$ = this.contextSubject.asObservable();

  constructor() {
    this.loadFhirClient();
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
        iss: iss || 'https://launch.smarthealthit.org/v/r4/fhir',
        clientId: clientId || 'your-client-id',
        scope: 'openid profile patient/*.read',
        redirectUri: window.location.origin + '/callback',
      });

      this.fhirClient = client;
      await this.loadPatientContext();
    } catch (error) {
      console.error('SMART launch initialization failed:', error);
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
      console.error('OAuth2 ready failed:', error);
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

      const context: FhirContext = {
        patient: this.mapFhirPatient(patient),
        clientId: this.fhirClient.getClientId?.() || 'unknown',
        scope: this.fhirClient.getScope?.() || 'unknown',
        serverUrl: this.fhirClient.getServerUrl?.() || 'unknown',
        tokenResponse: this.fhirClient.getState?.('tokenResponse'),
        authenticated: true,
      };

      this.contextSubject.next(context);
    } catch (error) {
      console.error('Failed to load patient context:', error);
      this.contextSubject.next({ authenticated: false });
      throw error;
    }
  }

  /**
   * Map FHIR Patient resource to our interface
   */
  private mapFhirPatient(fhirPatient: any): Patient {
    return {
      id: fhirPatient.id,
      name: fhirPatient.name,
      birthDate: fhirPatient.birthDate,
      gender: fhirPatient.gender,
      identifier: fhirPatient.identifier,
      telecom: fhirPatient.telecom,
      address: fhirPatient.address,
    };
  }

  /**
   * Get patient by ID
   */
  getPatient(patientId?: string): Observable<Patient> {
    return from(this.getPatientAsync(patientId)).pipe(
      map((patient) => this.mapFhirPatient(patient)),
      catchError((error) => {
        console.error('Error fetching patient:', error);
        return throwError(() => error);
      }),
    );
  }

  private async getPatientAsync(patientId?: string): Promise<any> {
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
  search(
    resourceType: string,
    params: Record<string, any> = {},
  ): Observable<any> {
    return from(this.searchAsync(resourceType, params)).pipe(
      catchError((error) => {
        console.error(`Error searching ${resourceType}:`, error);
        return throwError(() => error);
      }),
    );
  }

  private async searchAsync(
    resourceType: string,
    params: Record<string, any>,
  ): Promise<any> {
    if (!this.fhirClient) {
      throw new Error('FHIR client not initialized');
    }

    const query = new URLSearchParams(params).toString();
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
  getConditions(params: Record<string, any> = {}): Observable<Condition[]> {
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
          return statusFilter.includes(clinicalStatus);
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
            .map((entry: any) => entry.resource)
            .filter((condition: any) => condition)
            .map((condition: any) => this.mapFhirCondition(condition));
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error fetching conditions:', error);
        return throwError(() => error);
      }),
    );
  }

  /**
   * Map FHIR Condition resource to our interface
   */
  private mapFhirCondition(fhirCondition: any): Condition {
    return {
      id: fhirCondition.id,
      clinicalStatus: fhirCondition.clinicalStatus,
      verificationStatus: fhirCondition.verificationStatus,
      code: fhirCondition.code,
      subject: fhirCondition.subject,
      onsetDateTime: fhirCondition.onsetDateTime,
      onsetPeriod: fhirCondition.onsetPeriod,
      onsetAge: fhirCondition.onsetAge,
      recordedDate: fhirCondition.recordedDate,
      recorder: fhirCondition.recorder,
      asserter: fhirCondition.asserter,
    };
  }

  /**
   * Get observations for current patient
   */
  getObservations(params: Record<string, any> = {}): Observable<Observation[]> {
    console.log(
      'FhirClientService: getObservations called with params:',
      params,
    );

    const currentPatient = this.getCurrentPatient();
    console.log('FhirClientService: Current patient:', currentPatient);

    if (!currentPatient) {
      console.log('FhirClientService: No current patient, returning error');
      return throwError(() => new Error('No current patient'));
    }

    // If in offline mode, return offline data
    if (this.isOfflineMode() && this.offlineData) {
      console.log(
        'FhirClientService: In offline mode, returning offline observations',
      );
      console.log(
        'FhirClientService: Number of offline observations:',
        this.offlineData.observations.length,
      );

      let observations = this.offlineData.observations;

      // Apply basic filtering based on code parameter (LOINC codes)
      if (params['code']) {
        const codeFilter = params['code'].split(',');
        observations = observations.filter((observation) => {
          const codes =
            observation.code?.coding?.map((coding) => coding.code) || [];
          return codes.some((code) => codeFilter.includes(code));
        });
      }

      console.log(
        'FhirClientService: Returning filtered observations:',
        observations.length,
      );
      return of(observations);
    }

    console.log(
      'FhirClientService: Not in offline mode, attempting online search',
    );
    const searchParams = {
      patient: currentPatient.id,
      ...params,
    };

    return this.search('Observation', searchParams).pipe(
      map((bundle) => {
        if (bundle?.entry) {
          return bundle.entry
            .map((entry: any) => entry.resource)
            .filter((observation: any) => observation)
            .map((observation: any) => this.mapFhirObservation(observation));
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error fetching observations:', error);
        return throwError(() => error);
      }),
    );
  }

  /**
   * Map FHIR Observation resource to our interface
   */
  private mapFhirObservation(fhirObservation: any): Observation {
    return {
      id: fhirObservation.id,
      status: fhirObservation.status,
      code: fhirObservation.code,
      subject: fhirObservation.subject,
      effectiveDateTime: fhirObservation.effectiveDateTime,
      effectivePeriod: fhirObservation.effectivePeriod,
      valueQuantity: fhirObservation.valueQuantity,
      valueString: fhirObservation.valueString,
      valueCodeableConcept: fhirObservation.valueCodeableConcept,
      component: fhirObservation.component,
      issued: fhirObservation.issued,
      performer: fhirObservation.performer,
    };
  }

  /**
   * Get medication requests for current patient
   */
  getMedicationRequests(
    params: Record<string, any> = {},
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
          return statusFilter.includes(medRequest.status);
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
            .map((entry: any) => entry.resource)
            .filter((medicationRequest: any) => medicationRequest)
            .map((medicationRequest: any) =>
              this.mapFhirMedicationRequest(medicationRequest),
            );
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error fetching medication requests:', error);
        return throwError(() => error);
      }),
    );
  }

  /**
   * Map FHIR MedicationRequest resource to our interface
   */
  private mapFhirMedicationRequest(
    fhirMedicationRequest: any,
  ): MedicationRequest {
    return {
      id: fhirMedicationRequest.id,
      status: fhirMedicationRequest.status,
      intent: fhirMedicationRequest.intent,
      category: fhirMedicationRequest.category,
      priority: fhirMedicationRequest.priority,
      medicationCodeableConcept:
        fhirMedicationRequest.medicationCodeableConcept,
      medicationReference: fhirMedicationRequest.medicationReference,
      subject: fhirMedicationRequest.subject,
      encounter: fhirMedicationRequest.encounter,
      authoredOn: fhirMedicationRequest.authoredOn,
      requester: fhirMedicationRequest.requester,
      reasonCode: fhirMedicationRequest.reasonCode,
      reasonReference: fhirMedicationRequest.reasonReference,
      dosageInstruction: fhirMedicationRequest.dosageInstruction,
      dispenseRequest: fhirMedicationRequest.dispenseRequest,
      substitution: fhirMedicationRequest.substitution,
    };
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
    console.log('FhirClientService: setOfflineMode called with data:', data);
    console.log(
      'FhirClientService: Number of observations in offline data:',
      data.observations.length,
    );

    this.offlineData = data;
    const newContext = {
      patient: data.patient,
      authenticated: true,
      isOfflineMode: true,
    };

    console.log('FhirClientService: Setting context to:', newContext);
    this.contextSubject.next(newContext);
    console.log('FhirClientService: Context updated successfully');
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
    return this.contextSubject.value.isOfflineMode || false;
  }
}
