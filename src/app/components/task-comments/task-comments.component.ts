import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CommentAppendRequest,
  FHIRTask,
  TaskNote,
} from '../../models/fhir-task.interface';
import { logger } from '../../utils/logger';

@Component({
  selector: 'app-task-comments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatExpansionModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  templateUrl: './task-comments.component.html',
  styleUrl: './task-comments.component.scss',
})
export class TaskCommentsComponent {
  @Input() task!: FHIRTask;
  @Input() showExpanded = false;
  @Output() commentAdded = new EventEmitter<{
    task: FHIRTask;
    comment: TaskNote;
  }>();
  @Output() commentError = new EventEmitter<string>();

  @ViewChild('commentInput') commentInput!: ElementRef<HTMLTextAreaElement>;

  newComment = '';
  isSubmitting = false;
  showAllComments = false;
  pendingComment: TaskNote | null = null;

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
  ) {}

  get comments(): TaskNote[] {
    return this.task.note || [];
  }

  get visibleComments(): TaskNote[] {
    if (this.showAllComments || this.comments.length <= 2) {
      return this.comments;
    }
    return this.comments.slice(0, 2);
  }

  get hasMoreComments(): boolean {
    return this.comments.length > 2;
  }

  get commentCount(): number {
    return this.comments.length;
  }

  toggleComments(): void {
    this.showAllComments = !this.showAllComments;
  }

  async addComment(): Promise<void> {
    if (!this.newComment.trim() || this.isSubmitting) {
      return;
    }

    const commentText = this.newComment.trim();

    // Optimistic update
    this.pendingComment = {
      authorString: 'Current User',
      time: new Date().toISOString(),
      text: commentText,
    };

    // Clear input immediately for better UX
    this.newComment = '';
    this.isSubmitting = true;

    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean; task: FHIRTask; message: string }>(
          `${environment.apiBaseUrl}/api/tasks/${this.task.id}/comments`,
          { text: commentText } as CommentAppendRequest,
          { headers: { 'If-Match': this.task.version?.toString() || '1' } },
        ),
      );

      if (response.success) {
        // Update task with server response
        if (response.task.note) {
          this.task.note = response.task.note;
        }
        if (response.task.version) {
          this.task.version = response.task.version;
        }

        // Clear pending comment
        this.pendingComment = null;

        // Emit success event
        this.commentAdded.emit({
          task: this.task,
          comment: this.pendingComment!,
        });

        // Show success message
        this.snackBar.open('Comment added successfully', 'Close', {
          duration: 3000,
        });
      } else {
        throw new Error(response.message || 'Failed to add comment');
      }
    } catch (error) {
      // Rollback optimistic update
      this.newComment = commentText;
      this.pendingComment = null;

      // Show error message
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to add comment';
      this.snackBar.open(errorMessage, 'Close', { duration: 5000 });

      // Emit error event
      this.commentError.emit(errorMessage);

      logger.error('Failed to add comment:', error);
    } finally {
      this.isSubmitting = false;
    }
  }

  formatCommentTime(time: string): string {
    const date = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  getAuthorDisplay(comment: TaskNote): string {
    if (comment.authorReference?.display) {
      return comment.authorReference.display;
    }
    if (comment.authorReference?.reference) {
      const parts = comment.authorReference.reference.split('/');
      return parts.length > 1 && parts[1]
        ? parts[1]
        : comment.authorReference.reference;
    }
    return comment.authorString || 'Unknown User';
  }

  isCommentPending(comment: TaskNote): boolean {
    return this.pendingComment === comment;
  }

  trackByComment(_index: number, comment: TaskNote): string {
    return comment.time + comment.text;
  }

  onEnterKey(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey) {
      // Shift+Enter: allow new line
      return;
    } else {
      // Enter: submit comment
      keyboardEvent.preventDefault();
      this.addComment();
    }
  }
}
