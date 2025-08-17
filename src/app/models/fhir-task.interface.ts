// FHIR R4 Task Resource (Minimal Implementation for Clinical Task Management)
// Based on PRD requirements and FHIR R4 specification

export interface FHIRTask {
  resourceType: 'Task';
  id: string;
  intent: 'proposal' | 'order' | 'original-order';
  status: 'requested' | 'in-progress' | 'completed' | 'cancelled';
  priority?: 'routine' | 'urgent' | 'asap' | 'stat' | undefined;
  code: {
    text: string; // Primary task description
    coding?: {
      system?: string;
      code?: string;
      display?: string;
    }[];
  };
  description?: string | undefined; // Detailed clinical rationale
  for: {
    reference: string; // Patient reference
    display?: string;
  };
  authoredOn: string; // ISO 8601 timestamp
  basedOn?: {
    reference: string; // CarePlan reference
  }[];
  focus?:
    | {
        reference: string; // Related FHIR resource (Condition, Observation, etc.)
        display?: string;
      }
    | undefined;
  note?: TaskNote[]; // FHIR R4 Annotation array for comments
  version?: number; // For optimistic concurrency
  // Demo-specific extensions for session-only implementation
  _source?: 'clinical_chat' | 'manual' | undefined;
  _sessionId?: string | undefined;
}

// FHIR R4 TaskNote interface (maps to FHIR Annotation)
export interface TaskNote {
  authorReference?: {
    reference: string; // "Practitioner/123" or "PractitionerRole/456"
    type: 'Practitioner' | 'PractitionerRole';
    display?: string;
  };
  authorString?: string; // Fallback for internal users
  time: string; // ISO 8601 timestamp
  text: string; // Comment content (1-1000 chars)
}

// FHIR R4 CarePlan Resource (Minimal Implementation)
export interface FHIRCarePlan {
  resourceType: 'CarePlan';
  id: string;
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed';
  intent: 'proposal' | 'plan' | 'order';
  title: string;
  subject: {
    reference: string; // Patient reference
    display?: string;
  };
  created: string; // ISO 8601 timestamp
  activity?: {
    reference: {
      reference: string; // Task reference
    };
  }[];
  note?: {
    text: string;
  }[];
  // Demo-specific extensions for session-only implementation
  _sessionId?: string;
}

// Legacy interface mapping for backward compatibility
export interface TaskItem extends Partial<FHIRTask> {
  // Maps to code.text
  title: string;
  // Maps to FHIR status enum
  category?:
    | 'diagnostic'
    | 'therapeutic'
    | 'monitoring'
    | 'administrative'
    | 'education';
  estimatedTime?: number; // minutes (non-FHIR extension)
}

// Task creation request interface
export interface TaskCreationRequest {
  title: string;
  description?: string;
  priority?: FHIRTask['priority'];
  category?: TaskItem['category'];
  patientReference: string;
  source: 'clinical_chat' | 'manual';
  initialComment?: string; // Optional initial comment
  relatedResource?: {
    reference: string;
    display?: string;
  };
}

// Task update request interface
export interface TaskUpdateRequest {
  id: string;
  status?: FHIRTask['status'];
  title?: string;
  description?: string;
  priority?: FHIRTask['priority'];
}

// Comment append request interface
export interface CommentAppendRequest {
  text: string;
  taskId: string;
}

// Task response from LLM with CarePlan context
export interface TaskGenerationResponse {
  summary?: string; // Clinical overview/rationale
  carePlan: FHIRCarePlan;
  tasks: FHIRTask[];
  source: 'clinical_chat' | 'manual';
  sessionId?: string;
}
