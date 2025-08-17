import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  FHIRCarePlan,
  FHIRTask,
  TaskCreationRequest,
  TaskGenerationResponse,
  TaskUpdateRequest,
} from '../models/fhir-task.interface';

@Injectable({
  providedIn: 'root',
})
export class TaskManagementService {
  private tasksSubject = new BehaviorSubject<FHIRTask[]>([]);
  private carePlansSubject = new BehaviorSubject<FHIRCarePlan[]>([]);
  private currentSessionId = this.generateSessionId();

  constructor(private http: HttpClient) {}

  // Observable streams
  tasks$ = this.tasksSubject.asObservable();
  carePlans$ = this.carePlansSubject.asObservable();

  // Getter methods
  getTasks(): FHIRTask[] {
    return this.tasksSubject.value;
  }

  getCarePlans(): FHIRCarePlan[] {
    return this.carePlansSubject.value;
  }

  /**
   * Create a new task via backend API
   */
  async createTask(request: TaskCreationRequest): Promise<FHIRTask> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean; task: FHIRTask; message: string }>(
          `${environment.apiBaseUrl}/api/tasks`,
          request,
        ),
      );

      if (response.success) {
        // Add the new task to our local state
        this.addTask(response.task);
        return response.task;
      } else {
        throw new Error(response.message || 'Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  /**
   * Get tasks grouped by CarePlan
   */
  getTasksGroupedByCarePlan(): {
    carePlan: FHIRCarePlan | null;
    tasks: FHIRTask[];
  }[] {
    const tasks = this.getTasks();
    const carePlans = this.getCarePlans();
    const groups: { carePlan: FHIRCarePlan | null; tasks: FHIRTask[] }[] = [];

    // Group tasks by CarePlan
    const tasksByCarePlan = new Map<string, FHIRTask[]>();
    const unassignedTasks: FHIRTask[] = [];

    tasks.forEach((task) => {
      if (task.basedOn && task.basedOn.length > 0) {
        const carePlanReference = task.basedOn[0]?.reference;
        if (carePlanReference) {
          const carePlanId = carePlanReference.split('/')[1];
          if (carePlanId) {
            if (!tasksByCarePlan.has(carePlanId)) {
              tasksByCarePlan.set(carePlanId, []);
            }
            tasksByCarePlan.get(carePlanId)!.push(task);
          } else {
            unassignedTasks.push(task);
          }
        } else {
          unassignedTasks.push(task);
        }
      } else {
        unassignedTasks.push(task);
      }
    });

    // Add groups for each CarePlan
    carePlans.forEach((carePlan) => {
      const planTasks = tasksByCarePlan.get(carePlan.id) || [];
      groups.push({ carePlan, tasks: planTasks });
    });

    // Add unassigned tasks group if any
    if (unassignedTasks.length > 0) {
      groups.push({ carePlan: null, tasks: unassignedTasks });
    }

    return groups;
  }

  /**
   * Update an existing task
   */
  updateTask(request: TaskUpdateRequest): FHIRTask | null {
    const tasks = this.getTasks();
    const taskIndex = tasks.findIndex((t) => t.id === request.id);

    if (taskIndex === -1) {
      return null;
    }

    const originalTask = tasks[taskIndex]!;
    const updatedTask: FHIRTask = {
      resourceType: originalTask.resourceType,
      id: originalTask.id,
      intent: originalTask.intent,
      status: request.status || originalTask.status,
      code: {
        text: request.title || originalTask.code.text,
      },
      for: originalTask.for,
      authoredOn: originalTask.authoredOn,
      _source: originalTask._source,
      _sessionId: originalTask._sessionId,
    };

    // Handle priority
    if (request.priority !== undefined) {
      updatedTask.priority = request.priority;
    } else if (originalTask.priority !== undefined) {
      updatedTask.priority = originalTask.priority;
    }

    // Handle description
    if (request.description !== undefined) {
      updatedTask.description = request.description;
    } else if (originalTask.description) {
      updatedTask.description = originalTask.description;
    }

    // Handle basedOn
    if (originalTask.basedOn) {
      updatedTask.basedOn = originalTask.basedOn;
    }

    // Handle focus
    if (originalTask.focus) {
      updatedTask.focus = originalTask.focus;
    }

    // Handle notes
    if (originalTask.note) {
      updatedTask.note = originalTask.note;
    }

    // Handle version
    if (originalTask.version) {
      updatedTask.version = originalTask.version;
    }

    // Update task in array
    tasks[taskIndex] = updatedTask;
    this.tasksSubject.next([...tasks]);

    return updatedTask;
  }

  /**
   * Append a comment to an existing task via backend API
   */
  async appendComment(
    taskId: string,
    commentText: string,
  ): Promise<FHIRTask | null> {
    try {
      const task = this.getTasks().find((t) => t.id === taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      const response = await firstValueFrom(
        this.http.post<{ success: boolean; task: FHIRTask; message: string }>(
          `${environment.apiBaseUrl}/api/tasks/${taskId}/comments`,
          { text: commentText },
          { headers: { 'If-Match': task.version?.toString() || '1' } },
        ),
      );

      if (response.success) {
        // Update the task in our local state
        this.updateTaskInLocalState(response.task);
        return response.task;
      } else {
        throw new Error(response.message || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error appending comment:', error);
      throw error;
    }
  }

  /**
   * Delete a task
   */
  deleteTask(taskId: string): boolean {
    const tasks = this.getTasks();
    const taskIndex = tasks.findIndex((t) => t.id === taskId);

    if (taskIndex === -1) {
      return false;
    }

    tasks.splice(taskIndex, 1);
    this.tasksSubject.next([...tasks]);
    return true;
  }

  /**
   * Add a CarePlan
   */
  addCarePlan(carePlan: FHIRCarePlan): void {
    const currentCarePlans = this.getCarePlans();
    this.carePlansSubject.next([...currentCarePlans, carePlan]);
  }

  /**
   * Add tasks from LLM generation (Next Best Action)
   */
  addTasksFromGeneration(response: TaskGenerationResponse): void {
    // Add CarePlan if it doesn't exist
    const existingCarePlans = this.getCarePlans();
    const carePlanExists = existingCarePlans.some(
      (cp) => cp.id === response.carePlan.id,
    );

    if (!carePlanExists) {
      this.carePlansSubject.next([...existingCarePlans, response.carePlan]);
    }

    // Add tasks
    const existingTasks = this.getTasks();
    const newTasks = response.tasks.filter(
      (task) => !existingTasks.some((existing) => existing.id === task.id),
    );

    if (newTasks.length > 0) {
      this.tasksSubject.next([...existingTasks, ...newTasks]);
    }
  }

  /**
   * Clear all tasks and care plans (for new patient or session)
   */
  clearAll(): void {
    this.tasksSubject.next([]);
    this.carePlansSubject.next([]);
    this.currentSessionId = this.generateSessionId();
  }

  /**
   * Toggle task status between requested/in-progress/completed
   */
  toggleTaskStatus(taskId: string): FHIRTask | null {
    const task = this.getTasks().find((t) => t.id === taskId);
    if (!task) return null;

    let newStatus: FHIRTask['status'];
    switch (task.status) {
      case 'requested':
        newStatus = 'in-progress';
        break;
      case 'in-progress':
        newStatus = 'completed';
        break;
      case 'completed':
        newStatus = 'requested';
        break;
      default:
        newStatus = 'requested';
    }

    return this.updateTask({ id: taskId, status: newStatus });
  }

  /**
   * Get task statistics
   */
  getTaskStats(): {
    total: number;
    requested: number;
    inProgress: number;
    completed: number;
  } {
    const tasks = this.getTasks();
    return {
      total: tasks.length,
      requested: tasks.filter((t) => t.status === 'requested').length,
      inProgress: tasks.filter((t) => t.status === 'in-progress').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
    };
  }

  /**
   * Private helper methods
   */
  private addTask(task: FHIRTask): void {
    const currentTasks = this.getTasks();
    this.tasksSubject.next([...currentTasks, task]);
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string {
    return this.currentSessionId;
  }

  /**
   * Update task in local state
   */
  private updateTaskInLocalState(updatedTask: FHIRTask): void {
    const tasks = this.getTasks();
    const taskIndex = tasks.findIndex((t) => t.id === updatedTask.id);

    if (taskIndex !== -1) {
      tasks[taskIndex] = updatedTask;
      this.tasksSubject.next([...tasks]);
    }
  }
}
