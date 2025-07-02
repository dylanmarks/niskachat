import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

// Import FHIR client
declare global {
  interface Window {
    FHIR: any;
  }
}

export interface Patient {
  id: string;
  name?: Array<{
    family?: string;
    given?: string[];
    use?: string;
  }>;
  birthDate?: string;
  gender?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    };
  }>;
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
  address?: Array<{
    use?: string;
    text?: string;
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
}

export interface FhirContext {
  patient?: Patient;
  clientId?: string;
  scope?: string;
  serverUrl?: string;
  tokenResponse?: any;
  authenticated: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class FhirClientService {
  private contextSubject = new BehaviorSubject<FhirContext>({
    authenticated: false,
  });
  private fhirClient: any = null;

  public context$ = this.contextSubject.asObservable();

  constructor() {
    this.loadFhirClient();
  }

  /**
   * Load FHIR client library dynamically
   */
  private async loadFhirClient(): Promise<void> {
    try {
      // Load fhirclient from CDN if not already loaded
      if (!window.FHIR) {
        await this.loadScript(
          'https://cdn.jsdelivr.net/npm/fhirclient@2.5.3/build/lib.min.js',
        );
      }
    } catch (error) {
      console.error('Failed to load FHIR client library:', error);
    }
  }

  /**
   * Helper to load external scripts
   */
  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Initialize SMART launch (for EHR context)
   */
  async initializeSmartLaunch(iss?: string, clientId?: string): Promise<void> {
    try {
      if (!window.FHIR) {
        throw new Error('FHIR client library not loaded');
      }

      const client = await window.FHIR.oauth2.init({
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
      if (!window.FHIR) {
        throw new Error('FHIR client library not loaded');
      }

      const client = await window.FHIR.oauth2.ready();
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
   * Check if FHIR client is ready
   */
  isClientReady(): boolean {
    return !!window.FHIR && !!this.fhirClient;
  }
}
