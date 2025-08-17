import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  FHIRTask,
  TaskCreationRequest,
} from '../../models/fhir-task.interface';

export interface TaskDialogData {
  title?: string;
  description?: string;
  priority?: FHIRTask['priority'];
  initialComment?: string;
}

@Component({
  selector: 'app-create-task-dialog',
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
  templateUrl: './create-task-dialog.component.html',
  styleUrl: './create-task-dialog.component.scss',
})
export class CreateTaskDialogComponent {
  // Form data
  title = '';
  description = '';
  priority: FHIRTask['priority'] = 'routine';
  initialComment = '';

  // Options for dropdowns
  priorityOptions: {
    value: FHIRTask['priority'];
    label: string;
    icon: string;
    color: string;
  }[] = [
    {
      value: 'routine',
      label: 'Routine',
      icon: 'low_priority',
      color: 'primary',
    },
    {
      value: 'urgent',
      label: 'Urgent',
      icon: 'priority_high',
      color: 'accent',
    },
    { value: 'asap', label: 'ASAP', icon: 'warning', color: 'warn' },
    { value: 'stat', label: 'STAT', icon: 'error', color: 'warn' },
  ];

  constructor(
    public dialogRef: MatDialogRef<CreateTaskDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TaskDialogData | null,
  ) {
    // Initialize form with provided data
    if (data) {
      this.title = data.title || '';
      this.description = data.description || '';
      this.priority = data.priority || 'routine';
      this.initialComment = data.initialComment || '';
    }
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
  onCreate(): void {
    if (!this.isValid()) {
      return;
    }

    const taskRequest: TaskCreationRequest = {
      title: this.title.trim(),
      priority: this.priority,
      patientReference: 'Patient/current', // Will be updated by service
      source: 'manual',
    };

    // Only add description if it has content
    if (this.description.trim()) {
      taskRequest.description = this.description.trim();
    }

    // Only add initial comment if it has content
    if (this.initialComment.trim()) {
      taskRequest.initialComment = this.initialComment.trim();
    }

    this.dialogRef.close(taskRequest);
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
    return this.priorityOptions.find((option) => option.value === priority);
  }
}
