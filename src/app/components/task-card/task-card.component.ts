import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { FHIRTask } from '../../models/fhir-task.interface';
import { TaskCommentsComponent } from '../task-comments/task-comments.component';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatChipsModule,
    MatExpansionModule,
    TaskCommentsComponent,
  ],
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.scss',
})
export class TaskCardComponent {
  @Input() task!: FHIRTask;
  @Input() showCarePlanInfo = false;
  @Input() showComments = false; // New input to control comment visibility

  @Output() statusToggle = new EventEmitter<string>();
  @Output() editTask = new EventEmitter<FHIRTask>();
  @Output() deleteTask = new EventEmitter<string>();

  constructor() {}

  onStatusToggle(): void {
    // Open edit dialog to allow user to add comment when changing status
    this.editTask.emit(this.task);
  }

  onEditClick(): void {
    this.editTask.emit(this.task);
  }

  onDeleteClick(): void {
    this.deleteTask.emit(this.task.id);
  }

  onCommentAdded(event: { task: FHIRTask; comment: any }): void {
    // Task has been updated with new comment, emit update event
    this.editTask.emit(event.task);
  }

  onCommentError(error: string): void {
    // Handle comment error - could emit to parent or log
    console.error('Comment error:', error);
  }

  getStatusIcon(): string {
    switch (this.task.status) {
      case 'requested':
        return 'radio_button_unchecked';
      case 'in-progress':
        return 'pending';
      case 'completed':
        return 'check_circle';
      case 'cancelled':
        return 'cancel';
      default:
        return 'help';
    }
  }

  getStatusColor(): string {
    switch (this.task.status) {
      case 'requested':
        return '';
      case 'in-progress':
        return 'accent';
      case 'completed':
        return 'primary';
      case 'cancelled':
        return 'warn';
      default:
        return '';
    }
  }

  getPriorityColor(): string {
    switch (this.task.priority) {
      case 'stat':
        return 'warn';
      case 'asap':
        return 'warn';
      case 'urgent':
        return 'accent';
      case 'routine':
        return 'primary';
      default:
        return '';
    }
  }

  getPriorityIcon(): string {
    switch (this.task.priority) {
      case 'stat':
        return 'priority_high';
      case 'asap':
        return 'priority_high';
      case 'urgent':
        return 'warning';
      case 'routine':
        return 'low_priority';
      default:
        return 'help';
    }
  }

  formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  }

  hasDescription(): boolean {
    return !!(this.task.description && this.task.description.trim().length > 0);
  }

  hasFocus(): boolean {
    return !!this.task.focus?.reference;
  }

  getFocusDisplay(): string {
    if (!this.task.focus) return '';
    return this.task.focus.display || this.task.focus.reference;
  }

  getStatusDisplay(): string {
    switch (this.task.status) {
      case 'requested':
        return 'Requested';
      case 'in-progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  }

  getPriorityDisplay(): string {
    switch (this.task.priority) {
      case 'stat':
        return 'STAT';
      case 'asap':
        return 'ASAP';
      case 'urgent':
        return 'Urgent';
      case 'routine':
        return 'Routine';
      default:
        return 'Normal';
    }
  }

  getCarePlanReference(): string {
    if (!this.task.basedOn?.[0]?.reference) return '';
    const ref = this.task.basedOn[0].reference;
    // Extract just the ID part after the slash
    const parts = ref.split('/');
    return parts.length > 1 ? parts[1] || ref : ref;
  }

  hasComments(): boolean {
    return !!(this.task.note && this.task.note.length > 0);
  }

  getCommentCount(): number {
    return this.task.note?.length || 0;
  }

  toggleComments(): void {
    this.showComments = !this.showComments;
  }
}
