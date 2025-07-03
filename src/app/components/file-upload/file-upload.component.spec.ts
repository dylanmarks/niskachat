import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  FhirClientService,
  FhirContext,
} from '../../services/fhir-client.service';
import { FileUploadComponent } from './file-upload.component';

describe('FileUploadComponent', () => {
  let component: FileUploadComponent;
  let fixture: ComponentFixture<FileUploadComponent>;
  let mockFhirService: jasmine.SpyObj<FhirClientService>;

  const mockContext: FhirContext = {
    authenticated: false,
    isOfflineMode: false,
  };

  const mockBundle = {
    resourceType: 'Bundle',
    id: 'test-bundle',
    type: 'collection',
    entry: [
      {
        resource: {
          resourceType: 'Patient',
          id: 'patient-1',
          name: [{ family: 'Doe', given: ['John'] }],
          birthDate: '1980-01-01',
          gender: 'male',
        },
      },
      {
        resource: {
          resourceType: 'Condition',
          id: 'condition-1',
          clinicalStatus: {
            coding: [
              {
                system:
                  'http://terminology.hl7.org/CodeSystem/condition-clinical',
                code: 'active',
              },
            ],
          },
          code: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '123456',
                display: 'Test Condition',
              },
            ],
          },
        },
      },
    ],
  };

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('FhirClientService', ['setOfflineMode']);
    spy.context$ = of(mockContext);

    await TestBed.configureTestingModule({
      imports: [CommonModule, FileUploadComponent],
      providers: [{ provide: FhirClientService, useValue: spy }],
    }).compileComponents();

    fixture = TestBed.createComponent(FileUploadComponent);
    component = fixture.componentInstance;
    mockFhirService = TestBed.inject(
      FhirClientService,
    ) as jasmine.SpyObj<FhirClientService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default upload status', () => {
    expect(component.uploadStatus.isUploading).toBe(false);
    expect(component.uploadStatus.progress).toBe(0);
    expect(component.uploadStatus.error).toBeNull();
    expect(component.uploadStatus.success).toBe(false);
    expect(component.uploadStatus.fileName).toBeNull();
  });

  describe('File Selection', () => {
    it('should accept valid JSON file', () => {
      const file = new File(['{"test": "data"}'], 'test-bundle.json', {
        type: 'application/json',
      });

      component.handleFileSelection(file);

      expect(component.uploadStatus.fileName).toBe('test-bundle.json');
      expect(component.uploadStatus.error).toBeNull();
      expect(component.selectedFile).toBe(file);
    });

    it('should reject non-JSON file', () => {
      const file = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      });

      component.handleFileSelection(file);

      expect(component.uploadStatus.error).toBe(
        'Please select a valid JSON file.',
      );
      expect(component.selectedFile).toBeNull();
    });

    it('should reject oversized file', () => {
      // Create a file larger than 10MB
      const largeContent = 'a'.repeat(11 * 1024 * 1024);
      const file = new File([largeContent], 'large-bundle.json', {
        type: 'application/json',
      });

      component.handleFileSelection(file);

      expect(component.uploadStatus.error).toBe(
        'File size must be less than 10MB.',
      );
      expect(component.selectedFile).toBeNull();
    });
  });

  describe('Bundle Validation', () => {
    it('should validate correct FHIR Bundle', () => {
      expect(() => component.validateBundle(mockBundle)).not.toThrow();
    });

    it('should reject invalid JSON', () => {
      expect(() => component.validateBundle(null as any)).toThrowError(
        'Invalid JSON format',
      );
    });

    it('should reject non-Bundle resource', () => {
      const invalidBundle = { resourceType: 'Patient', id: 'test' };
      expect(() => component.validateBundle(invalidBundle)).toThrowError(
        'File is not a FHIR Bundle resource',
      );
    });

    it('should reject bundle without entries', () => {
      const emptyBundle = { resourceType: 'Bundle', id: 'test' };
      expect(() => component.validateBundle(emptyBundle)).toThrowError(
        'Bundle must contain an entry array',
      );
    });

    it('should reject bundle with empty entries', () => {
      const emptyBundle = { resourceType: 'Bundle', id: 'test', entry: [] };
      expect(() => component.validateBundle(emptyBundle)).toThrowError(
        'Bundle is empty - no resources found',
      );
    });
  });

  describe('Resource Extraction', () => {
    it('should extract Patient resources correctly', () => {
      const resources = component.extractResources(mockBundle);

      expect(resources.patients.length).toBe(1);
      expect(resources.patients[0]?.id).toBe('patient-1');
      expect(resources.patients[0]?.name?.[0]?.family).toBe('Doe');
    });

    it('should extract Condition resources correctly', () => {
      const resources = component.extractResources(mockBundle);

      expect(resources.conditions.length).toBe(1);
      expect(resources.conditions[0]?.id).toBe('condition-1');
    });

    it('should handle bundle with no Patient resources', async () => {
      const bundleWithoutPatient = {
        resourceType: 'Bundle',
        entry: [
          {
            resource: {
              resourceType: 'Condition',
              id: 'condition-1',
            },
          },
        ],
      };

      const resources = component.extractResources(bundleWithoutPatient);

      try {
        await component.loadResourcesIntoService(resources);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toEqual(
          new Error('No Patient resources found in the bundle'),
        );
      }
    });
  });

  describe('File Processing', () => {
    it('should process valid bundle successfully', async () => {
      const file = new File([JSON.stringify(mockBundle)], 'test-bundle.json', {
        type: 'application/json',
      });
      component.selectedFile = file;

      await component.processFile();

      expect(component.uploadStatus.success).toBe(true);
      expect(component.uploadStatus.isUploading).toBe(false);
      expect(component.uploadStatus.progress).toBe(100);
      expect(mockFhirService.setOfflineMode).toHaveBeenCalled();
    });

    it('should handle processing errors', async () => {
      const invalidFile = new File(['invalid json'], 'invalid.json', {
        type: 'application/json',
      });
      component.selectedFile = invalidFile;

      await component.processFile();

      expect(component.uploadStatus.error).toContain(
        'Failed to process bundle:',
      );
      expect(component.uploadStatus.isUploading).toBe(false);
      expect(component.uploadStatus.success).toBe(false);
    });
  });

  describe('Drag and Drop', () => {
    it('should handle drag over event', () => {
      const event = new DragEvent('dragover');
      spyOn(event, 'preventDefault');

      component.onDragOver(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(component.isDragOver).toBe(true);
    });

    it('should handle drag leave event', () => {
      const event = new DragEvent('dragleave');
      spyOn(event, 'preventDefault');
      component.isDragOver = true;

      component.onDragLeave(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(component.isDragOver).toBe(false);
    });

    it('should handle drop event with files', () => {
      const file = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json',
      });

      const mockDataTransfer = {
        files: [file],
      } as any;

      const event = new DragEvent('drop');
      Object.defineProperty(event, 'dataTransfer', {
        value: mockDataTransfer,
        writable: false,
      });

      spyOn(event, 'preventDefault');
      spyOn(component, 'handleFileSelection');

      component.onDrop(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(component.isDragOver).toBe(false);
      expect(component.handleFileSelection).toHaveBeenCalledWith(file);
    });
  });

  describe('Reset Upload', () => {
    it('should reset upload status correctly', () => {
      // Set some state
      component.uploadStatus.success = true;
      component.uploadStatus.fileName = 'test.json';
      component.selectedFile = new File(['test'], 'test.json');

      component.resetUpload();

      expect(component.uploadStatus.success).toBe(false);
      expect(component.uploadStatus.fileName).toBeNull();
      expect(component.uploadStatus.error).toBeNull();
      expect(component.selectedFile).toBeNull();
    });
  });

  describe('Public Method Access', () => {
    it('should have public methods accessible for testing', () => {
      expect(typeof component.handleFileSelection).toBe('function');
      expect(typeof component.validateBundle).toBe('function');
      expect(typeof component.extractResources).toBe('function');
      expect(typeof component.loadResourcesIntoService).toBe('function');
    });
  });
});
