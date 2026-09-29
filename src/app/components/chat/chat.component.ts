import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import DOMPurify from 'dompurify';
import { firstValueFrom } from 'rxjs';
import { TaskCreationRequest } from '../../models/fhir-task.interface';
import {
  FhirBundle,
  FhirClientService,
} from '../../services/fhir-client.service';
import { TaskManagementService } from '../../services/task-management.service';
import { compressFhirBundleClient } from '../../utils/fhir-compressor';
import { logger } from '../../utils/logger';
import {
  CreateTaskDialogComponent,
  TaskDialogData,
} from '../create-task-dialog/create-task-dialog.component';

export interface SuggestedAction {
  id: string;
  title: string;
  description: string;
  priority: 'routine';
  evidenceReferences?: string[];
  category: 'diagnostic' | 'therapeutic' | 'monitoring' | 'preventive';
}

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  isLoading?: boolean;
  suggestedActions?: SuggestedAction[];
  showSuggestedActions?: boolean;
  suggestedActionStates?: Map<string, 'pending' | 'added'>;
  provider?: string;
  model?: string;
  evidenceReferences?: string[];
}

export interface ChatRequest {
  query: string;
  context: string;
  patientData?: FhirBundle | Record<string, unknown> | null;
  compressedData?: string;
  conversationHistory?: ChatMessage[];
  sourceReferences?: string[];
}

interface ProviderDisclosure {
  provider: string;
  model: string | null;
  destination: string;
  processingBoundary: string;
  configured: boolean;
}

interface ProviderStatusResponse {
  llmConfigured: boolean;
  preferredProvider?: string;
  providers?: Record<string, ProviderDisclosure>;
}

export interface ChatResponse {
  success: boolean;
  summary: string;
  llmUsed: boolean;
  context: string;
  timestamp: string;
  query?: string;
  error?: string;
  suggestedActions?: SuggestedAction[];
  evidenceReferences?: string[];
  isStructuredResponse?: boolean;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements OnInit {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  currentMessage = '';
  isLoading = false;
  providerStatusLoading = true;
  providerDisclosure: ProviderDisclosure | null = null;

  constructor(
    private http: HttpClient,
    private fhirClientService: FhirClientService,
    private taskManagementService: TaskManagementService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {
    // Add a welcome message
    this.addMessage(
      "Hello! I'm your clinical AI assistant. I can help analyze patient data and answer questions about the current patient's conditions, medications, and observations. What would you like to know?",
      false,
    );
  }

  ngOnInit(): void {
    void this.loadProviderStatus();
  }

  private async loadProviderStatus(): Promise<void> {
    if (!this.providerStatusLoading || this.providerDisclosure) {
      return;
    }
    try {
      const status = await firstValueFrom(
        this.http.get<ProviderStatusResponse>('/api/llm/status'),
      );
      const selected = status.preferredProvider
        ? status.providers?.[status.preferredProvider]
        : undefined;
      this.providerDisclosure = selected || null;
    } catch {
      this.providerDisclosure = null;
    } finally {
      this.providerStatusLoading = false;
    }
  }

  /**
   * Send a message to the chat
   */
  async sendMessage(event?: KeyboardEvent): Promise<void> {
    if (event?.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
    } else if (event) {
      return;
    }

    const messageText = this.currentMessage.trim();
    if (!messageText || this.isLoading) {
      return;
    }

    this.addMessage(messageText, true);
    this.currentMessage = '';
    const loadingMessageId = this.addLoadingMessage();
    this.isLoading = true;

    try {
      const patientData = await this.gatherPatientContext();
      const sourceReferences = this.extractSourceReferences(patientData);
      let chatRequest: ChatRequest;
      if (patientData?.resourceType === 'Bundle') {
        const compressed = compressFhirBundleClient(patientData);
        chatRequest = {
          query: messageText,
          context: 'clinical_chat',
          compressedData: compressed.compressedData,
          conversationHistory: this.getConversationHistory(),
          sourceReferences,
        };
      } else {
        chatRequest = {
          query: messageText,
          context: 'clinical_chat',
          patientData,
          conversationHistory: this.getConversationHistory(),
          sourceReferences,
        };
      }

      const completed = await this.streamChatResponse(
        loadingMessageId,
        chatRequest,
      );
      if (!completed) {
        this.updateLoadingMessage(
          loadingMessageId,
          'No complete answer was returned. The app did not retry the request through another endpoint. Review the source record before trying again.',
        );
      }
    } catch {
      this.updateLoadingMessage(
        loadingMessageId,
        'The request could not be completed. No automatic retry was made. Review the source record before trying again.',
      );
    } finally {
      this.isLoading = false;
      this.scrollToBottom();
    }
  }

  /**
   * Stream one request to the provider disclosed to the user.
   * Returning false never triggers a second request with the same patient data.
   */
  private async streamChatResponse(
    loadingMessageId: string,
    chatRequest: ChatRequest,
  ): Promise<boolean> {
    try {
      const response = await fetch('/api/llm/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(chatRequest),
      });

      if (!response.ok || !response.body) {
        return false;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let provider = this.providerDisclosure?.provider;

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        let currentEvent = 'message';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }
          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim();
            continue;
          }
          if (!trimmed.startsWith('data:')) {
            continue;
          }

          try {
            const data = JSON.parse(trimmed.slice(5).trim()) as {
              provider?: string;
              text?: string;
              summary?: string;
              evidenceReferences?: string[];
              suggestedActions?: SuggestedAction[];
              message?: string;
            };
            if (currentEvent === 'start' && data.provider) {
              provider = data.provider;
            } else if (currentEvent === 'done') {
              this.updateLoadingMessage(
                loadingMessageId,
                data.summary || 'No response received',
                data.suggestedActions,
                data.evidenceReferences,
                provider,
              );
              return true;
            } else if (currentEvent === 'error') {
              this.updateLoadingMessage(
                loadingMessageId,
                'The configured model provider did not complete the request. No complete answer is available.',
                undefined,
                undefined,
                provider,
              );
              return true;
            }
          } catch {
            // Ignore malformed transport frames; incomplete output is never treated as complete.
          }
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Clear all chat messages
   */
  clearChat(): void {
    this.messages = [];
    // Add welcome message back
    this.addMessage(
      'Chat cleared. How can I help you analyze the patient data?',
      false,
    );
  }

  /**
   * Add a regular message to the chat
   */
  private addMessage(content: string, isUser: boolean): string {
    const sanitizedContent = isUser ? content : this.sanitizeResponse(content);
    const message: ChatMessage = {
      id: this.generateMessageId(),
      content: sanitizedContent,
      isUser: isUser,
      timestamp: new Date(),
      isLoading: false,
    };

    this.messages.push(message);
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
    return message.id;
  }

  /**
   * Add a loading message placeholder
   */
  private addLoadingMessage(): string {
    const message: ChatMessage = {
      id: this.generateMessageId(),
      content: '',
      isUser: false,
      timestamp: new Date(),
      isLoading: true,
    };

    this.messages.push(message);
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
    return message.id;
  }

  /**
   * Update a loading message with the actual response
   */
  private updateLoadingMessage(
    messageId: string,
    content: string,
    suggestedActions?: SuggestedAction[],
    evidenceReferences?: string[],
    provider?: string,
  ): void {
    const messageIndex = this.messages.findIndex(
      (message) => message.id === messageId,
    );
    const existingMessage = this.messages[messageIndex];
    if (!existingMessage) {
      return;
    }

    const updatedMessage: ChatMessage = {
      id: existingMessage.id,
      content: this.sanitizeResponse(content),
      isUser: false,
      timestamp: existingMessage.timestamp,
      isLoading: false,
      showSuggestedActions: Boolean(suggestedActions?.length),
      ...(provider ? { provider } : {}),
      ...(this.providerDisclosure?.model
        ? { model: this.providerDisclosure.model }
        : {}),
      evidenceReferences: evidenceReferences || [],
    };

    if (suggestedActions?.length) {
      updatedMessage.suggestedActions = suggestedActions;
      updatedMessage.suggestedActionStates = new Map(
        suggestedActions.map((action) => [action.id, 'pending']),
      );
    }

    this.messages[messageIndex] = updatedMessage;
    this.cdr.markForCheck();
  }

  /**
   * Sanitize AI response while preserving formatting
   */
  private sanitizeResponse(content: string): string {
    // Convert markdown-style formatting to HTML if needed
    const formattedContent = content
      // Convert double line breaks to paragraph breaks
      .replace(/\n\n/g, '</p><p>')
      // Convert single line breaks to <br> tags
      .replace(/\n/g, '<br>')
      // Convert markdown-style bullets to HTML lists
      .replace(/^[•\-*]\s+(.*)$/gm, '<li>$1</li>')
      // Wrap in paragraphs if not already wrapped
      .replace(/^(?!<[^>]+>)(.+)$/gm, '<p>$1</p>')
      // Clean up multiple paragraph tags
      .replace(/<\/p><p>/g, '</p>\n<p>')
      // Wrap list items in ul tags
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      // Clean up nested ul tags
      .replace(/<\/ul>\s*<ul>/g, '');

    // Configure DOMPurify to allow formatting tags
    const config = {
      ALLOWED_TAGS: [
        'p',
        'br',
        'ul',
        'ol',
        'li',
        'strong',
        'em',
        'b',
        'i',
        'code',
        'pre',
        'blockquote',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
      ],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    };

    return DOMPurify.sanitize(formattedContent, config);
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Scroll chat to bottom
   */
  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (error) {
      logger.warn('Could not scroll to bottom:', error);
    }
  }

  private extractSourceReferences(patientData: FhirBundle | null): string[] {
    const references: string[] = [];
    for (const entry of patientData?.entry || []) {
      const resource = entry.resource;
      if (
        typeof resource?.resourceType === 'string' &&
        typeof resource.id === 'string' &&
        resource.id.length > 0
      ) {
        references.push(`${resource.resourceType}/${resource.id}`);
      }
      if (references.length === 100) break;
    }
    return references;
  }

  /**
   * Gather comprehensive patient context for the LLM
   */
  private async gatherPatientContext(): Promise<FhirBundle | null> {
    const context = this.fhirClientService.getCurrentContext();
    logger.debug('Current FHIR context retrieved');

    if (!context.authenticated || !context.patient) {
      logger.debug('Not authenticated or no patient available');
      return null;
    }

    try {
      // Build a comprehensive FHIR bundle with all available patient data
      logger.debug('Building comprehensive FHIR bundle...');
      const fhirBundle =
        await this.fhirClientService.buildComprehensiveFhirBundle();
      logger.debug('Successfully built FHIR bundle');
      return fhirBundle;
    } catch (error) {
      logger.error('Could not build the clinical context bundle');
      // Fallback to basic patient data if bundle building fails
      logger.debug('Falling back to basic patient data');
      return {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            resource: context.patient,
          },
        ],
      };
    }
  }

  /**
   * Check if we can send messages
   */
  canSendMessage(): boolean {
    return (
      !this.isLoading &&
      !this.providerStatusLoading &&
      this.currentMessage.trim().length > 0
    );
  }

  /**
   * Track function for ngFor to improve performance
   */
  trackMessage(_index: number, message: ChatMessage): string {
    return message.id;
  }

  /**
   * Get conversation history for context (exclude loading messages and limit to recent messages)
   */
  private getConversationHistory(): ChatMessage[] {
    // Filter out loading messages and limit to last 10 messages for context efficiency
    const nonLoadingMessages = this.messages.filter((msg) => !msg.isLoading);
    return nonLoadingMessages.slice(-10);
  }

  /**
   * Open create task dialog for a suggested action from regular chat
   */
  async openSuggestedActionDialog(
    message: ChatMessage,
    action: SuggestedAction,
  ): Promise<void> {
    const dialogData: TaskDialogData = {
      title: action.title,
      description: action.description,
      priority: action.priority,
    };

    const dialogRef = this.dialog.open(CreateTaskDialogComponent, {
      width: '500px',
      data: dialogData,
    });

    try {
      const result = await firstValueFrom(dialogRef.afterClosed());
      if (result) {
        // Create the task with the data from the dialog
        const taskRequest: TaskCreationRequest = {
          ...result,
          source: 'clinical_chat',
        };

        await this.taskManagementService.createTask(taskRequest);

        // Update the suggested action state to 'added'
        if (message.suggestedActionStates) {
          message.suggestedActionStates.set(action.id, 'added');
        }

        logger.info('Demo task created from a reviewed suggestion');
      }
    } catch (error) {
      logger.error('Reviewed suggestion could not be added as a demo task');
    }
  }

  /**
   * Get the state of a specific suggested action
   */
  getSuggestedActionState(
    message: ChatMessage,
    actionId: string,
  ): 'pending' | 'added' {
    return message.suggestedActionStates?.get(actionId) || 'pending';
  }

  /**
   * Get suggested action count for display
   */
  getSuggestedActionCount(message: ChatMessage): number {
    return message.suggestedActions?.length || 0;
  }
}
