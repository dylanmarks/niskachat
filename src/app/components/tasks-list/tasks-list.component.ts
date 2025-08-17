import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { FHIRCarePlan, FHIRTask, TaskCreationRequest } from '../../models/fhir-task.interface';
import { FhirClientService } from '../../services/fhir-client.service';
import { TaskManagementService } from '../../services/task-management.service';
import { TaskCardComponent } from '../task-card/task-card.component';
import { EditTaskDialogComponent, EditTaskDialogData, EditTaskDialogResult } from '../edit-task-dialog/edit-task-dialog.component';
import { CreateTaskDialogComponent } from '../create-task-dialog/create-task-dialog.component';

@Component({
  selector: 'app-tasks-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TaskCardComponent
  ],
  templateUrl: './tasks-list.component.html',
  styleUrl: './tasks-list.component.scss'
})
export class TasksListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  taskGroups: { carePlan: FHIRCarePlan | null; tasks: FHIRTask[] }[] = [];
  taskStats = { total: 0, requested: 0, inProgress: 0, completed: 0 };

  constructor(
    private taskService: TaskManagementService,
    private dialog: MatDialog,
    private fhirClientService: FhirClientService
  ) {}

  ngOnInit(): void {
    // Subscribe to task updates
    this.taskService.tasks$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateTaskData();
    });

    // Subscribe to care plan updates
    this.taskService.carePlans$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateTaskData();
    });

    // Initial data load
    this.updateTaskData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateTaskData(): void {
    this.taskGroups = this.taskService.getTasksGroupedByCarePlan();
    this.taskStats = this.taskService.getTaskStats();
  }

  onTaskStatusToggle(taskId: string): void {
    this.taskService.toggleTaskStatus(taskId);
  }

  onEditTask(task: FHIRTask): void {
    const dialogData: EditTaskDialogData = { task };
    
    const dialogRef = this.dialog.open(EditTaskDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: dialogData,
      disableClose: false,
      autoFocus: true,
    });

    dialogRef.afterClosed().subscribe(async (result: EditTaskDialogResult | undefined) => {
      if (result && Object.keys(result).length > 0) {
        // Separate comment from other updates
        const { comment, ...taskUpdates } = result;
        
        // Update the task first if there are task field changes
        if (Object.keys(taskUpdates).length > 0) {
          const updateRequest = {
            id: task.id,
            ...taskUpdates,
          };
          
          const updatedTask = this.taskService.updateTask(updateRequest);
          if (!updatedTask) {
            console.error('Failed to update task');
            return;
          }
        }
        
        // Add comment if provided
        if (comment && comment.trim()) {
          try {
            const taskWithComment = await this.taskService.appendComment(task.id, comment.trim());
            if (taskWithComment) {
              console.log('Task updated with comment successfully:', taskWithComment);
            } else {
              console.error('Failed to add comment to task');
            }
          } catch (error) {
            console.error('Error adding comment:', error);
          }
        }
      }
    });
  }

  onDeleteTask(taskId: string): void {
    if (confirm('Are you sure you want to delete this task?')) {
      this.taskService.deleteTask(taskId);
    }
  }

  onCreateNewTask(): void {
    const dialogRef = this.dialog.open(CreateTaskDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      disableClose: false,
      autoFocus: true,
    });

    dialogRef.afterClosed().subscribe((taskRequest: TaskCreationRequest | undefined) => {
      if (taskRequest) {
        // Get current patient reference
        const context = this.fhirClientService.getCurrentContext();
        if (context.patient) {
          taskRequest.patientReference = `Patient/${context.patient.id}`;
        }
        
        // Create task via backend API
        this.taskService.createTask(taskRequest).then(createdTask => {
          if (createdTask) {
            console.log('Task created successfully:', createdTask);
          } else {
            console.error('Failed to create task');
          }
        }).catch(error => {
          console.error('Error creating task:', error);
          // You could add a snackbar or toast notification here
        });
      }
    });
  }

  getCarePlanTitle(carePlan: FHIRCarePlan | null): string {
    return carePlan ? carePlan.title : 'Unassigned Tasks';
  }

  getCarePlanIcon(carePlan: FHIRCarePlan | null): string {
    return carePlan ? 'folder_shared' : 'folder_open';
  }

  getCompletionPercentage(): number {
    if (this.taskStats.total === 0) return 0;
    return Math.round((this.taskStats.completed / this.taskStats.total) * 100);
  }

  hasAnyTasks(): boolean {
    return this.taskStats.total > 0;
  }

  getCarePlanStatusColor(carePlan: FHIRCarePlan | null): string {
    if (!carePlan) return '';
    
    switch (carePlan.status) {
      case 'active': return 'primary';
      case 'completed': return 'accent';
      case 'draft': return 'warn';
      default: return '';
    }
  }

  formatCarePlanDate(carePlan: FHIRCarePlan | null): string {
    if (!carePlan?.created) return '';
    
    try {
      return new Date(carePlan.created).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }

  getCarePlanStatusIcon(status: string): string {
    switch (status) {
      case 'active': return 'play_circle';
      case 'completed': return 'check_circle';
      case 'draft': return 'edit';
      case 'on-hold': return 'pause_circle';
      case 'revoked': return 'cancel';
      default: return 'help';
    }
  }

  getCarePlanStatusDisplay(status: string): string {
    switch (status) {
      case 'active': return 'Active';
      case 'completed': return 'Completed';
      case 'draft': return 'Draft';
      case 'on-hold': return 'On Hold';
      case 'revoked': return 'Revoked';
      default: return 'Unknown';
    }
  }

  getGroupCompletionPercentage(tasks: FHIRTask[]): number {
    if (tasks.length === 0) return 0;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    return Math.round((completedTasks / tasks.length) * 100);
  }

  getCompletedTasksCount(tasks: FHIRTask[]): number {
    return tasks.filter(t => t.status === 'completed').length;
  }

  trackTaskGroup(index: number, group: { carePlan: FHIRCarePlan | null; tasks: FHIRTask[] }): string {
    return group.carePlan?.id || `unassigned-${index}`;
  }

  trackTask(_index: number, task: FHIRTask): string {
    return task.id;
  }
}