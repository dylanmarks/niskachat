import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, ViewChild } from '@angular/core';
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
import {
  FHIRTask,
  TaskCreationRequest,
  TaskGenerationResponse,
} from '../../models/fhir-task.interface';
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
  priority: 'routine' | 'urgent' | 'asap' | 'stat';
  category: 'diagnostic' | 'therapeutic' | 'monitoring' | 'preventive';
}

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  isLoading?: boolean;
  taskGeneration?: TaskGenerationResponse;
  suggestedActions?: SuggestedAction[];
  showTaskActions?: boolean;
  showSuggestedActions?: boolean;
  actionStates?: Map<string, 'pending' | 'added'>; // Track state of individual actions
  suggestedActionStates?: Map<string, 'pending' | 'added'>; // Track state of suggested actions
}

export interface ChatRequest {
  query: string;
  context: string;
  patientData?: FhirBundle | Record<string, unknown> | null;
  compressedData?: string;
  conversationHistory?: ChatMessage[];
}

export interface ChatResponse {
  success: boolean;
  summary: string;
  llmUsed: boolean;
  context: string;
  timestamp: string;
  query?: string;
  error?: string;
  taskGeneration?: TaskGenerationResponse;
  suggestedActions?: SuggestedAction[];
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
export class ChatComponent {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  currentMessage = '';
  isLoading = false;

  constructor(
    private http: HttpClient,
    private fhirClientService: FhirClientService,
    private taskManagementService: TaskManagementService,
    private dialog: MatDialog,
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

      // Compress FHIR bundle client-side to reduce payload size
      let chatRequest: ChatRequest;
      if (patientData && patientData.resourceType === 'Bundle') {
        const compressed = compressFhirBundleClient(patientData);
        logger.debug('Compressed FHIR bundle', {
          originalSize: compressed.originalSize,
          compressedSize: compressed.compressedSize,
          compressionRatio: compressed.compressionRatio,
        });

        chatRequest = {
          query: messageText,
          context: 'clinical_chat',
          compressedData: compressed.compressedData,
          conversationHistory: this.getConversationHistory(),
        };
      } else {
        chatRequest = {
          query: messageText,
          context: 'clinical_chat',
          patientData: patientData,
          conversationHistory: this.getConversationHistory(),
        };
      }

      logger.debug('Sending chat request', { phi: true });

      // Call the backend
      const response = await firstValueFrom(
        this.http.post<ChatResponse>('/api/llm', chatRequest),
      );

      // Replace loading message with response
      this.updateLoadingMessage(
        loadingMessageId,
        response?.summary || 'No response received',
        response?.taskGeneration,
        response?.suggestedActions,
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
    taskGeneration?: TaskGenerationResponse,
    suggestedActions?: SuggestedAction[],
  ): void {
    const messageIndex = this.messages.findIndex((m) => m.id === messageId);
    if (messageIndex !== -1 && this.messages[messageIndex]) {
      const existingMessage = this.messages[messageIndex];

      logger.debug('Updating message with content', {
        messageId,
        contentStart: content.substring(0, 200),
        contentLength: content.length,
        hasSuggestedActions: !!suggestedActions,
        hasTaskGeneration: !!taskGeneration,
        suggestedActionsCount: suggestedActions?.length || 0,
      });

      // Temporary debug log to console (will be visible in browser dev tools)
      console.log('CHAT DEBUG - Raw content received:', {
        content: content.substring(0, 500),
        startsWithBrace: content.trim().startsWith('{'),
        includesResponse: content.includes('"response"'),
        hasActions: !!suggestedActions,
        hasTaskGen: !!taskGeneration,
      });

      // ALWAYS try to parse JSON content, even if we have some actions
      // This ensures we catch cases where backend partially parsed or failed
      if (content.trim().startsWith('{') || content.includes('"response"')) {
        logger.warn('Detected JSON content in response, attempting to parse');
        const parsedContent = this.tryParseJsonResponse(content);
        if (parsedContent) {
          logger.info(
            'Successfully parsed JSON content in updateLoadingMessage',
            {
              originalContentLength: content.length,
              extractedResponseLength: parsedContent.response.length,
              extractedSuggestedActions:
                parsedContent.suggestedActions?.length || 0,
              extractedTaskGeneration: !!parsedContent.taskGeneration,
            },
          );
          content = parsedContent.response;
          // Override with parsed actions if we found them
          if (
            parsedContent.suggestedActions &&
            parsedContent.suggestedActions.length > 0
          ) {
            suggestedActions = parsedContent.suggestedActions;
          }
          if (parsedContent.taskGeneration) {
            taskGeneration = parsedContent.taskGeneration;
          }
        }
      }

      const updatedMessage: ChatMessage = {
        id: existingMessage.id,
        content: this.sanitizeResponse(content),
        isUser: existingMessage.isUser,
        timestamp: existingMessage.timestamp,
        isLoading: false,
        showTaskActions:
          !!taskGeneration &&
          taskGeneration.tasks &&
          taskGeneration.tasks.length > 0,
        showSuggestedActions:
          !!suggestedActions && suggestedActions.length > 0 && !taskGeneration,
      };

      // Only set taskGeneration if it's defined
      if (taskGeneration) {
        updatedMessage.taskGeneration = taskGeneration;
        // Initialize action states for each task
        updatedMessage.actionStates = new Map();
        taskGeneration.tasks.forEach((task) => {
          updatedMessage.actionStates!.set(task.id, 'pending');
        });
      }

      // Only set suggestedActions if it's defined
      if (suggestedActions) {
        updatedMessage.suggestedActions = suggestedActions;
        // Initialize suggested action states for each action
        updatedMessage.suggestedActionStates = new Map();
        suggestedActions.forEach((action) => {
          updatedMessage.suggestedActionStates!.set(action.id, 'pending');
        });
      }

      this.messages[messageIndex] = updatedMessage;
    }
  }

  /**
   * Sanitize AI response while preserving formatting
   */
  private sanitizeResponse(content: string): string {
    // Check if content looks like JSON that wasn't properly parsed
    const trimmedContent = content.trim();
    if (
      (trimmedContent.startsWith('{') &&
        (trimmedContent.includes('"response"') ||
          trimmedContent.includes('"suggestedActions"'))) ||
      (trimmedContent.includes('```json') &&
        (trimmedContent.includes('"response"') ||
          trimmedContent.includes('"suggestedActions"')))
    ) {
      logger.warn(
        'Detected unparsed JSON response, attempting to extract content',
        {
          contentStart: trimmedContent.substring(0, 200),
          contentLength: trimmedContent.length,
        },
      );

      try {
        // Try to extract JSON from code blocks first
        let jsonText = trimmedContent;
        const jsonMatch = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(
          trimmedContent,
        );
        if (jsonMatch?.[1]) {
          jsonText = jsonMatch[1].trim();
          logger.debug('Extracted JSON from code block');
        }

        // Try to fix common JSON truncation issues before parsing
        if (!jsonText.endsWith('}')) {
          const openBraces = (jsonText.match(/\{/g) || []).length;
          const closeBraces = (jsonText.match(/\}/g) || []).length;
          const missingBraces = openBraces - closeBraces;

          if (missingBraces > 0) {
            jsonText += '}'.repeat(missingBraces);
            logger.debug('Fixed missing closing braces:', missingBraces);
          }
        }

        // Parse the JSON and extract the response field
        const parsed = JSON.parse(jsonText);
        if (parsed?.response && typeof parsed.response === 'string') {
          logger.info('Successfully extracted response from unparsed JSON', {
            responseLength: parsed.response.length,
            hasSuggestedActions: !!parsed.suggestedActions,
            hasCarePlan: !!parsed.carePlan,
          });
          // Use the extracted response and continue with normal processing
          content = parsed.response;
        }
      } catch (error) {
        logger.warn('Failed to parse JSON content, using original text', {
          error: (error as Error).message,
          contentLength: trimmedContent.length,
        });
      }
    }

    // Last resort: if content still looks like JSON, try a simple extraction
    if (content.trim().startsWith('{') && content.includes('"response"')) {
      try {
        const simpleMatch = /"response"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/.exec(
          content,
        );
        if (simpleMatch?.[1]) {
          logger.warn('Used simple regex extraction for JSON response');
          content = simpleMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
        }
      } catch (error) {
        logger.debug('Simple regex extraction failed', error);
      }
    }

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

  /**
   * Get conversation history for context (exclude loading messages and limit to recent messages)
   */
  private getConversationHistory(): ChatMessage[] {
    // Filter out loading messages and limit to last 10 messages for context efficiency
    const nonLoadingMessages = this.messages.filter((msg) => !msg.isLoading);
    return nonLoadingMessages.slice(-10);
  }

  /**
   * Open create task dialog for a specific suggested action
   */
  async openTaskDialog(message: ChatMessage, task: FHIRTask): Promise<void> {
    const dialogData: TaskDialogData = {
      title: task.code.text,
      description: task.description || '',
      priority: task.priority || 'routine',
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
          patientReference: task.for.reference,
          relatedResource: task.focus,
        };

        // Ensure the care plan exists before creating the task
        if (message.taskGeneration?.carePlan) {
          const existingCarePlans = this.taskManagementService.getCarePlans();
          const carePlanExists = existingCarePlans.some(
            (cp) => cp.id === message.taskGeneration!.carePlan.id,
          );

          if (!carePlanExists) {
            // Add the care plan to the service
            this.taskManagementService.addTasksFromGeneration({
              carePlan: message.taskGeneration.carePlan,
              tasks: [],
              source: 'clinical_chat',
              sessionId: this.taskManagementService.getCurrentSessionId(),
            });
          }
        }

        const createdTask =
          await this.taskManagementService.createTask(taskRequest);

        // Link the task to the care plan if available
        if (message.taskGeneration?.carePlan && createdTask) {
          createdTask.basedOn = [
            {
              reference: `CarePlan/${message.taskGeneration.carePlan.id}`,
            },
          ];
          // Update the task with the care plan reference
          this.taskManagementService.updateTask({
            id: createdTask.id,
            ...taskRequest,
          });
        }

        // Update the action state to 'added'
        if (message.actionStates) {
          message.actionStates.set(task.id, 'added');
        }

        logger.info('Added individual task from NBA suggestion', {
          taskId: task.id,
          title: taskRequest.title,
          carePlanId: message.taskGeneration?.carePlan?.id,
        });
      }
    } catch (error) {
      logger.error('Error in task dialog:', error);
    }
  }

  /**
   * Get the state of a specific action
   */
  getActionState(message: ChatMessage, taskId: string): 'pending' | 'added' {
    return message.actionStates?.get(taskId) || 'pending';
  }

  /**
   * Get task count for display
   */
  getTaskCount(message: ChatMessage): number {
    return message.taskGeneration?.tasks?.length || 0;
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

        logger.info('Added task from suggested action', {
          actionId: action.id,
          title: taskRequest.title,
          category: action.category,
        });
      }
    } catch (error) {
      logger.error('Error in suggested action dialog:', error);
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

  /**
   * Try to parse JSON response content to extract actions and task generation
   * This is used as a fallback when the backend parsing fails
   */
  private tryParseJsonResponse(content: string): {
    response: string;
    suggestedActions?: SuggestedAction[];
    taskGeneration?: TaskGenerationResponse;
  } | null {
    try {
      const trimmedContent = content.trim();
      let jsonText = trimmedContent;

      logger.debug('Attempting to parse JSON response', {
        contentStart: trimmedContent.substring(0, 200),
        contentLength: trimmedContent.length,
        startsWithBrace: trimmedContent.startsWith('{'),
      });

      // Handle content wrapped in markdown code blocks
      const jsonMatch = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(trimmedContent);
      if (jsonMatch?.[1]) {
        jsonText = jsonMatch[1].trim();
        logger.debug('Extracted JSON from markdown code block');
      } else if (!trimmedContent.startsWith('{')) {
        // If it doesn't start with { and no code block, probably not JSON
        logger.debug('Content does not appear to be JSON');
        return null;
      }

      // Try to fix common JSON truncation issues and malformed JSON
      let needsRepair = false;

      // Fix missing closing braces
      if (jsonText && !jsonText.endsWith('}')) {
        const openBraces = (jsonText.match(/\{/g) || []).length;
        const closeBraces = (jsonText.match(/\}/g) || []).length;
        const missingBraces = openBraces - closeBraces;

        if (missingBraces > 0) {
          jsonText += '}'.repeat(missingBraces);
          logger.debug('Fixed JSON with missing closing braces', {
            count: missingBraces,
          });
          needsRepair = true;
        }
      }

      // Fix incomplete arrays - more comprehensive approach
      if (jsonText.includes('"suggestedActions": [')) {
        // Check if array is properly closed
        const actionsStartIndex = jsonText.indexOf('"suggestedActions": [');
        if (actionsStartIndex !== -1) {
          const afterActions = jsonText.substring(
            actionsStartIndex + '"suggestedActions": ['.length,
          );
          const nextFieldIndex = afterActions.search(/,\s*"[^"]+"\s*:/);
          const arrayEndIndex = afterActions.indexOf(']');

          // If we find another field before the array ends, or no array end at all
          if (
            (nextFieldIndex !== -1 &&
              (arrayEndIndex === -1 || nextFieldIndex < arrayEndIndex)) ||
            arrayEndIndex === -1
          ) {
            // Find insertion point (before next field or end of object)
            let insertionPoint;
            if (nextFieldIndex !== -1) {
              insertionPoint =
                actionsStartIndex +
                '"suggestedActions": ['.length +
                nextFieldIndex;
              // Remove trailing comma if exists
              if (jsonText.charAt(insertionPoint - 1) === ',') {
                jsonText =
                  jsonText.substring(0, insertionPoint - 1) +
                  ']' +
                  jsonText.substring(insertionPoint);
              } else {
                jsonText =
                  jsonText.substring(0, insertionPoint) +
                  ']' +
                  jsonText.substring(insertionPoint);
              }
            } else {
              // Insert before final closing brace
              const lastBraceIndex = jsonText.lastIndexOf('}');
              if (lastBraceIndex !== -1) {
                if (jsonText.charAt(lastBraceIndex - 1) === ',') {
                  jsonText =
                    jsonText.substring(0, lastBraceIndex - 1) +
                    ']' +
                    jsonText.substring(lastBraceIndex);
                } else {
                  jsonText =
                    jsonText.substring(0, lastBraceIndex) +
                    ']' +
                    jsonText.substring(lastBraceIndex);
                }
              }
            }
            logger.debug('Fixed incomplete suggestedActions array');
            needsRepair = true;
          }
        }
      }

      // Similar fix for tasks array
      if (jsonText.includes('"tasks": [')) {
        const tasksStartIndex = jsonText.indexOf('"tasks": [');
        if (tasksStartIndex !== -1) {
          const afterTasks = jsonText.substring(
            tasksStartIndex + '"tasks": ['.length,
          );
          const nextFieldIndex = afterTasks.search(/,\s*"[^"]+"\s*:/);
          const arrayEndIndex = afterTasks.indexOf(']');

          if (
            (nextFieldIndex !== -1 &&
              (arrayEndIndex === -1 || nextFieldIndex < arrayEndIndex)) ||
            arrayEndIndex === -1
          ) {
            let insertionPoint;
            if (nextFieldIndex !== -1) {
              insertionPoint =
                tasksStartIndex + '"tasks": ['.length + nextFieldIndex;
              if (jsonText.charAt(insertionPoint - 1) === ',') {
                jsonText =
                  jsonText.substring(0, insertionPoint - 1) +
                  ']' +
                  jsonText.substring(insertionPoint);
              } else {
                jsonText =
                  jsonText.substring(0, insertionPoint) +
                  ']' +
                  jsonText.substring(insertionPoint);
              }
            } else {
              const lastBraceIndex = jsonText.lastIndexOf('}');
              if (lastBraceIndex !== -1) {
                if (jsonText.charAt(lastBraceIndex - 1) === ',') {
                  jsonText =
                    jsonText.substring(0, lastBraceIndex - 1) +
                    ']' +
                    jsonText.substring(lastBraceIndex);
                } else {
                  jsonText =
                    jsonText.substring(0, lastBraceIndex) +
                    ']' +
                    jsonText.substring(lastBraceIndex);
                }
              }
            }
            logger.debug('Fixed incomplete tasks array');
            needsRepair = true;
          }
        }
      }

      if (needsRepair) {
        logger.debug('Repaired JSON structure', {
          originalLength: trimmedContent.length,
          repairedLength: jsonText.length,
        });
      }

      const parsed = JSON.parse(jsonText);

      // Validate structure
      if (!parsed?.response || typeof parsed.response !== 'string') {
        logger.debug(
          'Invalid JSON structure - missing or invalid response field',
        );
        return null;
      }

      const result: {
        response: string;
        suggestedActions?: SuggestedAction[];
        taskGeneration?: TaskGenerationResponse;
      } = {
        response: parsed.response,
      };

      // Extract suggested actions if present
      if (parsed.suggestedActions && Array.isArray(parsed.suggestedActions)) {
        const validActions = parsed.suggestedActions.filter(
          (action: any) =>
            action.id &&
            action.title &&
            action.description &&
            action.priority &&
            action.category,
        );
        if (validActions.length > 0) {
          result.suggestedActions = validActions;
          logger.debug('Extracted suggested actions', {
            count: validActions.length,
          });
        }
      }

      // Extract task generation if present (comprehensive actions)
      if (parsed.carePlan && parsed.tasks && Array.isArray(parsed.tasks)) {
        const carePlan = parsed.carePlan;
        if (
          carePlan.resourceType === 'CarePlan' &&
          carePlan.id &&
          carePlan.title
        ) {
          const validTasks = parsed.tasks.filter(
            (task: any) =>
              task.resourceType === 'Task' && task.id && task.code?.text,
          );

          if (validTasks.length > 0) {
            result.taskGeneration = {
              summary: parsed.response,
              carePlan: carePlan,
              tasks: validTasks,
              source: 'clinical_chat',
            };
            logger.debug('Extracted task generation', {
              carePlanId: carePlan.id,
              taskCount: validTasks.length,
            });
          }
        }
      }

      logger.info('Successfully parsed JSON response on frontend', {
        responseLength: result.response.length,
        hasSuggestedActions: !!result.suggestedActions,
        suggestedActionsCount: result.suggestedActions?.length || 0,
        hasTaskGeneration: !!result.taskGeneration,
        taskCount: result.taskGeneration?.tasks?.length || 0,
      });

      return result;
    } catch (error) {
      logger.warn('Failed to parse JSON response on frontend', {
        error: (error as Error).message,
        contentStart: content.substring(0, 100),
      });
      return null;
    }
  }
}
