import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FhirClientService } from '../../services/fhir-client.service';

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
  patientData?: Record<string, unknown>;
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
  imports: [CommonModule, FormsModule],
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
      const patientData = this.gatherPatientContext();

      // Prepare request
      const chatRequest: ChatRequest = {
        query: messageText,
        context: 'clinical_chat',
        patientData: patientData,
      };

      // Call the backend
      const response = await this.http
        .post<ChatResponse>('/summarize', chatRequest)
        .toPromise();

      // Replace loading message with response
      this.updateLoadingMessage(
        loadingMessageId,
        response?.summary || 'No response received',
      );
    } catch (error: unknown) {
      console.error('Chat error:', error);

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
      console.warn('Could not scroll to bottom:', error);
    }
  }

  /**
   * Gather comprehensive patient context for the LLM
   */
  private gatherPatientContext(): any {
    const context = this.fhirClientService.getCurrentContext();

    if (!context.authenticated || !context.patient) {
      return null;
    }

    // Create a comprehensive patient data object
    // This will include patient demographics plus any available clinical data
    const patientData = {
      patient: context.patient,
      // Note: For now we're sending the patient data
      // In the future, we could fetch conditions, medications, observations
      // from the FHIR client service if needed
    };

    return patientData;
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
