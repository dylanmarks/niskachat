/* eslint-disable @typescript-eslint/dot-notation */
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';

import { FhirClientService, Patient } from '../../services/fhir-client.service';
import {
  ChatComponent,
  ChatMessage,
  ChatRequest,
  ChatResponse,
} from './chat.component';

describe('ChatComponent', () => {
  let component: ChatComponent;
  let fixture: ComponentFixture<ChatComponent>;
  let httpMock: HttpTestingController;
  let fhirClientService: jasmine.SpyObj<FhirClientService>;

  beforeEach(async () => {
    const fhirClientSpy = jasmine.createSpyObj('FhirClientService', [
      'getCurrentContext',
    ]);

    await TestBed.configureTestingModule({
      imports: [ChatComponent, HttpClientTestingModule, FormsModule],
      providers: [{ provide: FhirClientService, useValue: fhirClientSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fhirClientService = TestBed.inject(
      FhirClientService,
    ) as jasmine.SpyObj<FhirClientService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with welcome message', () => {
      expect(component.messages.length).toBe(1);
      expect(component.messages[0]?.isUser).toBe(false);
      expect(component.messages[0]?.content).toContain(
        "Hello! I'm your clinical AI assistant",
      );
    });

    it('should initialize with empty current message', () => {
      expect(component.currentMessage).toBe('');
    });

    it('should initialize with loading state false', () => {
      expect(component.isLoading).toBe(false);
    });
  });

  describe('Message Management', () => {
    it('should generate unique message IDs', () => {
      const id1 = component['generateMessageId']();
      const id2 = component['generateMessageId']();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^msg_\d+_[a-z0-9]+$/);
    });

    it('should add user message correctly', () => {
      const initialCount = component.messages.length;
      const messageId = component['addMessage']('Test message', true);

      expect(component.messages.length).toBe(initialCount + 1);
      const newMessage = component.messages[component.messages.length - 1];
      expect(newMessage).toBeDefined();
      expect(newMessage?.id).toBe(messageId);
      expect(newMessage?.content).toBe('Test message');
      expect(newMessage?.isUser).toBe(true);
      expect(newMessage?.isLoading).toBe(false);
    });

    it('should add AI message correctly', () => {
      const initialCount = component.messages.length;
      const messageId = component['addMessage']('AI response', false);

      expect(component.messages.length).toBe(initialCount + 1);
      const newMessage = component.messages[component.messages.length - 1];
      expect(newMessage).toBeDefined();
      expect(newMessage?.id).toBe(messageId);
      expect(newMessage?.content).toBe('AI response');
      expect(newMessage?.isUser).toBe(false);
      expect(newMessage?.isLoading).toBe(false);
    });

    it('should add loading message correctly', () => {
      const initialCount = component.messages.length;
      const messageId = component['addLoadingMessage']();

      expect(component.messages.length).toBe(initialCount + 1);
      const newMessage = component.messages[component.messages.length - 1];
      expect(newMessage).toBeDefined();
      expect(newMessage?.id).toBe(messageId);
      expect(newMessage?.content).toBe('');
      expect(newMessage?.isUser).toBe(false);
      expect(newMessage?.isLoading).toBe(true);
    });

    it('should update loading message correctly', () => {
      const messageId = component['addLoadingMessage']();
      const messageIndex = component.messages.findIndex(
        (m) => m.id === messageId,
      );

      component['updateLoadingMessage'](messageId, 'Updated content');

      const updatedMessage = component.messages[messageIndex];
      expect(updatedMessage).toBeDefined();
      expect(updatedMessage?.content).toBe('Updated content');
      expect(updatedMessage?.isLoading).toBe(false);
    });

    it('should handle updating non-existent message gracefully', () => {
      const originalLength = component.messages.length;

      component['updateLoadingMessage']('non-existent-id', 'Content');

      expect(component.messages.length).toBe(originalLength);
    });
  });

  describe('Message Sending', () => {
    beforeEach(() => {
      // Set up FHIR client mock
      fhirClientService.getCurrentContext.and.returnValue({
        authenticated: true,
        patient: {
          id: 'test-patient',
          name: [{ given: ['John'], family: 'Doe' }],
        },
      });
    });

    it('should not send empty message', async () => {
      component.currentMessage = '';
      const initialCount = component.messages.length;

      await component.sendMessage();

      expect(component.messages.length).toBe(initialCount);
    });

    it('should not send message when loading', async () => {
      component.currentMessage = 'Test message';
      component.isLoading = true;
      const initialCount = component.messages.length;

      await component.sendMessage();

      expect(component.messages.length).toBe(initialCount);
    });

    it('should send message successfully', async () => {
      component.currentMessage = 'What are the patient conditions?';
      const initialCount = component.messages.length;

      const sendPromise = component.sendMessage();

      // Verify request
      const req = httpMock.expectOne('/llm');
      expect(req.request.method).toBe('POST');

      const requestBody = req.request.body as ChatRequest;
      expect(requestBody.query).toBe('What are the patient conditions?');
      expect(requestBody.context).toBe('clinical_chat');
      expect(requestBody.patientData).toBeDefined();

      // Mock response
      const mockResponse: ChatResponse = {
        success: true,
        summary: 'Patient has hypertension and diabetes.',
        llmUsed: false,
        context: 'clinical_chat',
        timestamp: new Date().toISOString(),
      };
      req.flush(mockResponse);

      await sendPromise;

      // Verify messages
      expect(component.messages.length).toBe(initialCount + 2); // user + AI
      expect(component.messages[initialCount]!.content).toBe(
        'What are the patient conditions?',
      );
      expect(component.messages[initialCount]!.isUser).toBe(true);
      expect(component.messages[initialCount + 1]!.content).toBe(
        'Patient has hypertension and diabetes.',
      );
      expect(component.messages[initialCount + 1]!.isUser).toBe(false);

      // Verify state
      expect(component.currentMessage).toBe('');
      expect(component.isLoading).toBe(false);
    });

    it('should handle server error', async () => {
      component.currentMessage = 'Test message';
      const initialCount = component.messages.length;

      const sendPromise = component.sendMessage();

      const req = httpMock.expectOne('/api/llm');
      req.flush('Server error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      await sendPromise;

      // Verify error message
      expect(component.messages.length).toBe(initialCount + 2);
      expect(component.messages[initialCount + 1]!.content).toBe(
        'Server error occurred. Please try again later.',
      );
      expect(component.isLoading).toBe(false);
    });

    it('should handle network error', async () => {
      component.currentMessage = 'Test message';
      const initialCount = component.messages.length;

      const sendPromise = component.sendMessage();

      const req = httpMock.expectOne('/api/llm');
      req.flush('', { status: 0, statusText: 'Network Error' });

      await sendPromise;

      // Verify error message
      expect(component.messages.length).toBe(initialCount + 2);
      expect(component.messages[initialCount + 1]!.content).toBe(
        'Unable to connect to the server. Please check your connection.',
      );
      expect(component.isLoading).toBe(false);
    });

    it('should handle Enter key without Shift', async () => {
      component.currentMessage = 'Test message';
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: false,
      });
      spyOn(enterEvent, 'preventDefault');

      const sendPromise = component.sendMessage(enterEvent);

      expect(enterEvent.preventDefault).toHaveBeenCalled();

      const req = httpMock.expectOne('/api/llm');
      req.flush({ summary: 'Response' });

      await sendPromise;
    });

    it('should allow Shift+Enter without sending', async () => {
      component.currentMessage = 'Test message';
      const shiftEnterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
      });
      const initialCount = component.messages.length;

      await component.sendMessage(shiftEnterEvent);

      expect(component.messages.length).toBe(initialCount);
      httpMock.expectNone('/api/llm');
    });
  });

  describe('Chat Controls', () => {
    it('should clear chat correctly', () => {
      // Add some messages first
      component['addMessage']('User message', true);
      component['addMessage']('AI message', false);

      expect(component.messages.length).toBeGreaterThan(1);

      component.clearChat();

      expect(component.messages.length).toBe(1);
      expect(component.messages[0]!.content).toBe(
        'Chat cleared. How can I help you analyze the patient data?',
      );
      expect(component.messages[0]!.isUser).toBe(false);
    });

    it('should determine if message can be sent', () => {
      // Empty message
      component.currentMessage = '';
      component.isLoading = false;
      expect(component.canSendMessage()).toBe(false);

      // Whitespace only
      component.currentMessage = '   ';
      expect(component.canSendMessage()).toBe(false);

      // Valid message but loading
      component.currentMessage = 'Valid message';
      component.isLoading = true;
      expect(component.canSendMessage()).toBe(false);

      // Valid message and not loading
      component.currentMessage = 'Valid message';
      component.isLoading = false;
      expect(component.canSendMessage()).toBe(true);
    });
  });

  describe('FHIR Context Integration', () => {
    it('should gather patient context when authenticated', () => {
      const mockContext = {
        authenticated: true,
        patient: {
          id: 'test-patient',
          name: [{ given: ['John'], family: 'Doe' }],
          birthDate: '1980-01-01',
        },
      };

      fhirClientService.getCurrentContext.and.returnValue(mockContext);

      const context = component['gatherPatientContext']();

      expect(context).toBeDefined();
      expect(context.patient).toEqual(mockContext.patient);
    });

    it('should return null when not authenticated', () => {
      fhirClientService.getCurrentContext.and.returnValue({
        authenticated: false,
      });

      const context = component['gatherPatientContext']();

      expect(context).toBeNull();
    });

    it('should return null when no patient', () => {
      fhirClientService.getCurrentContext.and.returnValue({
        authenticated: true,
        patient: undefined as unknown as Patient,
      });

      const context = component['gatherPatientContext']();

      expect(context).toBeNull();
    });
  });

  describe('Track Function', () => {
    it('should track messages by ID', () => {
      const message: ChatMessage = {
        id: 'test-id',
        content: 'Test message',
        isUser: true,
        timestamp: new Date(),
      };

      const result = component.trackMessage(0, message);

      expect(result).toBe('test-id');
    });
  });

  describe('Template Integration', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should render chat header', () => {
      const header = fixture.debugElement.query(By.css('.chat-header'));
      expect(header).toBeTruthy();

      const title = header.query(By.css('h3'));
      expect(title.nativeElement.textContent).toBe('Clinical AI Assistant');
    });

    it('should render clear button', () => {
      const clearButton = fixture.debugElement.query(By.css('.clear-button'));
      expect(clearButton).toBeTruthy();
      expect(clearButton.nativeElement.textContent.trim()).toContain('Clear');
    });

    it('should render messages area', () => {
      const messagesArea = fixture.debugElement.query(By.css('.chat-messages'));
      expect(messagesArea).toBeTruthy();
    });

    it('should render input area', () => {
      const inputArea = fixture.debugElement.query(By.css('.chat-input-area'));
      expect(inputArea).toBeTruthy();

      const textarea = inputArea.query(By.css('textarea'));
      expect(textarea).toBeTruthy();

      const sendButton = inputArea.query(By.css('.send-button'));
      expect(sendButton).toBeTruthy();
    });

    it('should display welcome message', () => {
      const messageElements = fixture.debugElement.queryAll(
        By.css('.message-wrapper'),
      );
      expect(messageElements.length).toBe(1);

      const welcomeMessage = messageElements[0]!;
      expect(welcomeMessage.classes['ai-message']).toBe(true);
    });

    it('should disable send button when cannot send', () => {
      component.currentMessage = '';
      fixture.detectChanges();

      const sendButton = fixture.debugElement.query(By.css('.send-button'));
      expect(sendButton.nativeElement.disabled).toBe(true);
    });

    it('should enable send button when can send', () => {
      component.currentMessage = 'Test message';
      fixture.detectChanges();

      const sendButton = fixture.debugElement.query(By.css('.send-button'));
      expect(sendButton.nativeElement.disabled).toBe(false);
    });
  });
});
