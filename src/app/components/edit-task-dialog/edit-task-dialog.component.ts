import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { FHIRTask } from '../../models/fhir-task.interface';

export interface EditTaskDialogData {
  task: FHIRTask;
}

export interface EditTaskDialogResult {
  title?: string;
  description?: string;
  priority?: FHIRTask['priority'];
  status?: FHIRTask['status'];
  comment?: string;
}

@Component({
  selector: 'app-edit-task-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
  ],
  templateUrl: './edit-task-dialog.component.html',
  styleUrl: './edit-task-dialog.component.scss',
})
export class EditTaskDialogComponent {
  // Form data
  title: string;
  description: string;
  priority: FHIRTask['priority'];
  status: FHIRTask['status'];
  newComment: string = '';

  // Options for dropdowns
  statusOptions: { value: FHIRTask['status']; label: string; icon: string }[] = [
    { value: 'requested', label: 'Requested', icon: 'radio_button_unchecked' },
    { value: 'in-progress', label: 'In Progress', icon: 'hourglass_empty' },
    { value: 'completed', label: 'Completed', icon: 'check_circle' },
    { value: 'cancelled', label: 'Cancelled', icon: 'cancel' },
  ];

  priorityOptions: { value: FHIRTask['priority']; label: string; icon: string; color: string }[] = [
    { value: 'routine', label: 'Routine', icon: 'low_priority', color: 'primary' },
    { value: 'urgent', label: 'Urgent', icon: 'priority_high', color: 'accent' },
    { value: 'asap', label: 'ASAP', icon: 'warning', color: 'warn' },
    { value: 'stat', label: 'STAT', icon: 'error', color: 'warn' },
  ];

  constructor(
    public dialogRef: MatDialogRef<EditTaskDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EditTaskDialogData,
  ) {
    // Initialize form with current task values
    this.title = data.task.code.text;
    this.description = data.task.description || '';
    this.priority = data.task.priority || 'routine';
    this.status = data.task.status;
  }

  /**
   * Handle dialog cancellation
   */
  onCancel(): void {
    this.dialogRef.close();
  }

  /**
   * Handle dialog confirmation
   */
  onSave(): void {
    const result: EditTaskDialogResult = {};
    
    // Only include changed values
    if (this.title !== this.data.task.code.text) {
      result.title = this.title.trim();
    }
    
    if (this.description !== (this.data.task.description || '')) {
      result.description = this.description.trim();
    }
    
    if (this.priority !== this.data.task.priority) {
      result.priority = this.priority;
    }
    
    if (this.status !== this.data.task.status) {
      result.status = this.status;
    }
    
    // Include comment if provided
    if (this.newComment && this.newComment.trim()) {
      result.comment = this.newComment.trim();
    }

    this.dialogRef.close(result);
  }

  /**
   * Check if the form has any changes
   */
  hasChanges(): boolean {
    return (
      this.title !== this.data.task.code.text ||
      this.description !== (this.data.task.description || '') ||
      this.priority !== this.data.task.priority ||
      this.status !== this.data.task.status
    );
  }

  /**
   * Check if the form is valid
   */
  isValid(): boolean {
    return this.title.trim().length > 0;
  }

  /**
   * Get priority option by value
   */
  getPriorityOption(priority: FHIRTask['priority']) {
    return this.priorityOptions.find(option => option.value === priority);
  }

  /**
   * Get status option by value
   */
  getStatusOption(status: FHIRTask['status']) {
    return this.statusOptions.find(option => option.value === status);
  }
}