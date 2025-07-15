import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import {
  FhirBundle,
  FhirClientService,
} from '../../services/fhir-client.service';
import { logger } from '../../utils/logger';

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  isLoading?: boolean;
}

export interface ChatRequest {
  query: string;
  context: string;
  patientData?: FhirBundle | Record<string, unknown> | null;
}

export interface ChatResponse {
  success: boolean;
  summary: string;
  llmUsed: boolean;
  context: string;
  timestamp: string;
  query?: string;
  error?: string;
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
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  currentMessage = '';
  isLoading = false;

  constructor(
    private http: HttpClient,
    private fhirClientService: FhirClientService,
  ) {
    // Add a welcome message
    this.addMessage(
      "Hello! I'm your clinical AI assistant. I can help analyze patient data and answer questions about the current patient's conditions, medications, and observations. What would you like to know?",
      false,
    );
  }

  /**
   * Send a message to the chat
   */
  async sendMessage(event?: KeyboardEvent): Promise<void> {
    // Handle Enter key (but allow Shift+Enter for new lines)
    if (event && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
    } else if (event) {
      return; // Allow other key events to pass through
    }

    const messageText = this.currentMessage.trim();
    if (!messageText || this.isLoading) {
      return;
    }

    // Add user message
    this.addMessage(messageText, true);

    // Clear input
    this.currentMessage = '';

    // Add loading message
    const loadingMessageId = this.addLoadingMessage();

    // Set loading state
    this.isLoading = true;

    try {
      // Get current patient data for context
      const patientData = await this.gatherPatientContext();
      logger.debug('Gathered patient data');

      // Prepare request
      const chatRequest: ChatRequest = {
        query: messageText,
        context: 'clinical_chat',
        patientData: patientData,
      };

      logger.debug('Sending chat request', { phi: true });

      // Call the backend
      const response = await firstValueFrom(
        this.http.post<ChatResponse>('/api/llm', chatRequest),
      );

      // Replace loading message with response
      this.updateLoadingMessage(
        loadingMessageId,
        response?.summary || 'No response received',
      );
    } catch (error: unknown) {
      logger.error('Chat error:', error);

      // Handle different types of errors
      let errorMessage = 'Sorry, I encountered an error. Please try again.';

      if (error instanceof HttpErrorResponse) {
        if (error.status === 0) {
          errorMessage =
            'Unable to connect to the server. Please check your connection.';
        } else if (error.status >= 500) {
          errorMessage = 'Server error occurred. Please try again later.';
        } else if (error.error?.message) {
          errorMessage = `Error: ${error.error.message}`;
        }
      }

      this.updateLoadingMessage(loadingMessageId, errorMessage);
    } finally {
      this.isLoading = false;
      this.scrollToBottom();
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
    const message: ChatMessage = {
      id: this.generateMessageId(),
      content: content,
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
  private updateLoadingMessage(messageId: string, content: string): void {
    const messageIndex = this.messages.findIndex((m) => m.id === messageId);
    if (messageIndex !== -1 && this.messages[messageIndex]) {
      const existingMessage = this.messages[messageIndex];
      this.messages[messageIndex] = {
        id: existingMessage.id,
        content: content,
        isUser: existingMessage.isUser,
        timestamp: existingMessage.timestamp,
        isLoading: false,
      };
    }
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
      logger.error('Error gathering patient context:', error);
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
    return !this.isLoading && this.currentMessage.trim().length > 0;
  }

  /**
   * Track function for ngFor to improve performance
   */
  trackMessage(_index: number, message: ChatMessage): string {
    return message.id;
  }
}
