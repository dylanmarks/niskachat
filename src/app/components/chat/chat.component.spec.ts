/* eslint-disable @typescript-eslint/dot-notation */
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';

import { FhirClientService, Patient } from '../../services/fhir-client.service';
import { ChatComponent, ChatMessage, ChatRequest } from './chat.component';

describe('ChatComponent', () => {
  let component: ChatComponent;
  let fixture: ComponentFixture<ChatComponent>;
  let httpMock: HttpTestingController;
  let fhirClientService: jasmine.SpyObj<FhirClientService>;

  beforeEach(async () => {
    spyOn(window, 'fetch').and.resolveTo(
      new Response(null, { status: 404, statusText: 'Not Found' }),
    );
    const fhirClientSpy = jasmine.createSpyObj('FhirClientService', [
      'getCurrentContext',
      'buildComprehensiveFhirBundle',
    ]) as jasmine.SpyObj<FhirClientService>;

    await TestBed.configureTestingModule({
      imports: [ChatComponent, FormsModule],
      providers: [
        { provide: FhirClientService, useValue: fhirClientSpy },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    component.providerStatusLoading = false;
    component.providerDisclosure = {
      provider: 'ollama',
      model: 'llama3.1:8b',
      destination: 'http://127.0.0.1:11434',
      processingBoundary:
        'Ollama-compatible endpoint; confirm where that endpoint runs',
      configured: true,
    };
    httpMock = TestBed.inject(HttpTestingController);
    fhirClientService = fhirClientSpy;
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
      expect(newMessage?.content).toBe('<p>AI response</p>');
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
      expect(updatedMessage?.content).toBe('<p>Updated content</p>');
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
          resourceType: 'Patient',
          id: 'test-patient',
          name: [{ given: ['John'], family: 'Doe' }],
        },
      });
      fhirClientService.buildComprehensiveFhirBundle.and.resolveTo({
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            resource: {
              resourceType: 'Patient' as const,
              id: 'test-patient',
              name: [{ given: ['John'], family: 'Doe' }],
            } as Patient,
          },
        ],
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

    it('sends one request to the disclosed provider and displays validated evidence', async () => {
      component.currentMessage = 'What are the patient conditions?';
      const initialCount = component.messages.length;
      const responseEvent = {
        summary: 'The record includes a patient resource.',
        provider: 'ollama',
        suggestedActions: [],
        evidenceReferences: ['Patient/test-patient'],
      };
      const fetchSpy = window.fetch as jasmine.Spy;
      fetchSpy.and.resolveTo(
        new Response(
          `event: done\ndata: ${JSON.stringify(responseEvent)}\n\n`,
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        ),
      );

      await component.sendMessage();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.calls.mostRecent().args[0]).toBe('/api/llm/stream');
      const requestBody = JSON.parse(
        (fetchSpy.calls.mostRecent().args[1] as RequestInit).body as string,
      ) as ChatRequest;
      expect(requestBody.query).toBe('What are the patient conditions?');
      expect(requestBody.context).toBe('clinical_chat');
      expect(requestBody.compressedData).toBeDefined();
      expect(requestBody.sourceReferences).toContain('Patient/test-patient');
      expect(httpMock.match('/api/llm').length).toBe(0);

      expect(component.messages.length).toBe(initialCount + 2);
      expect(component.messages[initialCount]?.isUser).toBe(true);
      expect(component.messages[initialCount + 1]?.content).toBe(
        '<p>The record includes a patient resource.</p>',
      );
      expect(component.messages[initialCount + 1]?.evidenceReferences).toEqual([
        'Patient/test-patient',
      ]);
      expect(component.isLoading).toBe(false);
    });

    it('sends on the user action without a separate disclosure confirmation', async () => {
      component.currentMessage = 'Summarize the current record';
      const fetchSpy = window.fetch as jasmine.Spy;
      fetchSpy.and.resolveTo(
        new Response(
          `event: done\ndata: ${JSON.stringify({
            summary: 'A source-linked summary.',
            evidenceReferences: ['Patient/test-patient'],
          })}\n\n`,
          { status: 200 },
        ),
      );
      await component.sendMessage();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(component.currentMessage).toBe('');
    });

    it('does not retry through another endpoint when the stream request fails', async () => {
      component.currentMessage = 'Test message';
      const fetchSpy = window.fetch as jasmine.Spy;
      fetchSpy.and.resolveTo(new Response('Unavailable', { status: 503 }));

      await component.sendMessage();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(httpMock.match('/api/llm').length).toBe(0);
      expect(component.messages.at(-1)?.content).toContain(
        'No complete answer was returned',
      );
      expect(component.isLoading).toBe(false);
    });

    it('does not block a send when provider status could not be loaded', async () => {
      component.providerDisclosure = null;
      component.currentMessage = 'Summarize this synthetic record';
      const fetchSpy = window.fetch as jasmine.Spy;
      fetchSpy.and.resolveTo(
        new Response(
          `event: done\ndata: ${JSON.stringify({ summary: 'Synthetic summary.' })}\n\n`,
          { status: 200 },
        ),
      );

      await component.sendMessage();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.calls.mostRecent().args[0]).toBe('/api/llm/stream');
    });

    it('handles a network failure without exposing provider error details', async () => {
      component.currentMessage = 'Test message';
      const fetchSpy = window.fetch as jasmine.Spy;
      fetchSpy.and.callFake(() =>
        Promise.reject(new Error('private provider detail')),
      );

      await component.sendMessage();

      expect(component.messages.at(-1)?.content).toContain(
        'did not retry the request through another endpoint',
      );
      expect(component.messages.at(-1)?.content).not.toContain(
        'private provider detail',
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

      const fetchSpy = window.fetch as jasmine.Spy;
      fetchSpy.and.resolveTo(
        new Response(
          `event: done\ndata: ${JSON.stringify({ summary: 'Response' })}\n\n`,
          { status: 200 },
        ),
      );
      await component.sendMessage(enterEvent);

      expect(enterEvent.preventDefault).toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
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
      expect(window.fetch).not.toHaveBeenCalled();
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
        '<p>Chat cleared. How can I help you analyze the patient data?</p>',
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
    it('should gather patient context when authenticated', async () => {
      const mockContext = {
        authenticated: true,
        patient: {
          resourceType: 'Patient' as const,
          id: 'test-patient',
          name: [{ given: ['John'], family: 'Doe' }],
          birthDate: '1980-01-01',
        },
      };

      fhirClientService.getCurrentContext.and.returnValue(mockContext);
      // Mock the buildComprehensiveFhirBundle method to return a FHIR bundle
      fhirClientService.buildComprehensiveFhirBundle.and.resolveTo({
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            resource: mockContext.patient,
          },
        ],
      });

      const context = await component['gatherPatientContext']();

      expect(context).toBeDefined();
      expect(context).not.toBeNull();
      if (context) {
        expect(context.resourceType).toBe('Bundle');
        expect(context.entry).toBeDefined();
        expect(context.entry?.[0]?.resource).toEqual(mockContext.patient);
      }
    });

    it('should return null when not authenticated', async () => {
      fhirClientService.getCurrentContext.and.returnValue({
        authenticated: false,
      });

      const context = await component['gatherPatientContext']();

      expect(context).toBeNull();
    });

    it('should return null when no patient', async () => {
      fhirClientService.getCurrentContext.and.returnValue({
        authenticated: true,
        patient: undefined as unknown as Patient,
      });

      const context = await component['gatherPatientContext']();

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

    it('should render chat container', () => {
      const container = fixture.debugElement.query(By.css('.chat-container'));
      expect(container).toBeTruthy();
    });

    it('should render clear button', () => {
      const clearButton = fixture.debugElement.query(By.css('.clear-button'));

      expect(clearButton).toBeTruthy();
      expect(clearButton.nativeElement.getAttribute('aria-label')).toBe(
        'Clear chat history',
      );
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
