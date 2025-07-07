import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import {
  FhirClientService,
  FhirContext,
} from '../../services/fhir-client.service';
import { SmartLaunchComponent } from './smart-launch.component';

describe('SmartLaunchComponent', () => {
  let component: SmartLaunchComponent;
  let fixture: ComponentFixture<SmartLaunchComponent>;
  let mockFhirClient: jasmine.SpyObj<FhirClientService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let contextSubject: BehaviorSubject<FhirContext>;

  beforeEach(async () => {
    // Create context subject for mocking
    contextSubject = new BehaviorSubject<FhirContext>({ authenticated: false });

    // Create spies
    mockFhirClient = jasmine.createSpyObj(
      'FhirClientService',
      ['handleOAuth2Ready', 'initializeSmartLaunch', 'clearSession'],
      {
        context$: contextSubject.asObservable(),
      },
    );

    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [SmartLaunchComponent],
      providers: [
        { provide: FhirClientService, useValue: mockFhirClient },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SmartLaunchComponent);
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
    expect(component.context).toEqual({ authenticated: false });
  });

  it('should subscribe to context changes', () => {
    fixture.detectChanges();

    const newContext: FhirContext = {
      authenticated: true,
      patient: {
        id: 'test-123',
        name: [{ family: 'Doe', given: ['John'] }],
      },
    };

    contextSubject.next(newContext);

    expect(component.context).toEqual(newContext);
    expect(component.isLoading).toBeFalse();
  });

  describe('handleCallback', () => {
    it('should handle successful callback', async () => {
      mockFhirClient.handleOAuth2Ready.and.resolveTo();

      await component.handleCallback();

      expect(mockFhirClient.handleOAuth2Ready).toHaveBeenCalled();
      expect(component.statusMessage).toBe('Authentication successful!');
      expect(component.errorMessage).toBe('');
    });

    it('should handle callback failure', async () => {
      const error = new Error('Auth failed');
      mockFhirClient.handleOAuth2Ready.and.rejectWith(error);

      await component.handleCallback();

      expect(component.errorMessage).toContain('Authentication failed');
      expect(component.isLoading).toBeFalse();
    });
  });

  describe('handleStandaloneLaunch', () => {
    it('should handle successful standalone launch', async () => {
      mockFhirClient.initializeSmartLaunch.and.resolveTo();

      await component.handleStandaloneLaunch();

      expect(mockFhirClient.initializeSmartLaunch).toHaveBeenCalledWith();
      expect(component.errorMessage).toBe('');
    });

    it('should handle standalone launch failure', async () => {
      const error = new Error('Launch failed');
      mockFhirClient.initializeSmartLaunch.and.rejectWith(error);

      await component.handleStandaloneLaunch();

      expect(component.errorMessage).toContain('Standalone launch failed');
      expect(component.isLoading).toBeFalse();
    });
  });

  describe('Navigation', () => {
    it('should navigate to test mode', () => {
      component.navigateToTestMode();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/test-mode']);
    });
  });

  describe('retry', () => {
    it('should clear session and reset state', () => {
      component.errorMessage = 'Some error';
      component.context = { authenticated: true };

      component.retry();

      expect(component.errorMessage).toBe('');
      expect(component.context).toBeNull();
      expect(mockFhirClient.clearSession).toHaveBeenCalled();
    });
  });

  describe('Auto-launch detection', () => {
    beforeEach(() => {
      // Reset location
      delete (window as any).location;
      (window as any).location = {
        pathname: '/',
        search: '',
      };
    });

    it('should detect callback URL', () => {
      (window as any).location.pathname = '/callback';
      spyOn(component, 'handleCallback');

      fixture.detectChanges();

      expect(component.handleCallback).toHaveBeenCalled();
    });

    it('should detect EHR launch parameters', () => {
      (window as any).location.search =
        '?launch=test-launch&iss=https://test.fhir.org';
      spyOn(component, 'handleEhrLaunch');

      fixture.detectChanges();

      expect(component.handleEhrLaunch).toHaveBeenCalled();
    });
  });
});
