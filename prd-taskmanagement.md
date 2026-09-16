# Product Requirements Document (PRD): Clinical Task Management System for NiskaChat

**Version**: 1.1  
**Date**: July 29, 2025  
**Project**: NiskaChat Task Management Enhancement  
**Document Type**: PRD

---

## Executive Summary

### Problem Statement

Healthcare providers using NiskaChat currently interact with clinical data through conversational AI, receiving text-based responses that require manual interpretation and action planning. This creates friction where providers must:

- Mentally parse AI recommendations into actionable steps
- Remember and track multiple clinical tasks across patient encounters
- Manually prioritize and organize clinical actions
- Lack structured follow‑up mechanisms

### Solution Overview

The Clinical Task Management System transforms LLM responses into structured, actionable workflows. When providers request analysis or use **“Next Best Action”**, the system will:

1. Generate structured tasks alongside conversational output
2. Provide a dedicated task management interface
3. Enable task tracking and prioritization based on clinical context
4. Integrate into existing FHIR data visualization

### Business Impact

- Improved clinical efficiency via structured workflows
- Enhanced patient safety with systematic task tracking
- Greater AI utility by converting insights into action
- Better care coordination through organized task lists

---

## Product Vision & Objectives

**Vision**  
Empower providers with intelligent task management that turns AI insights into clinical workflows.

**Objectives**

1. Transform conversational responses into structured tasks
2. Seamless integration within SMART on FHIR framework
3. Intuitive UI for minimal cognitive load and task control

---

## Success Criteria

- **Task Completion Rate**: >85% tasks marked complete within session
- **User Adoption**: >70% of active users use task features
- **Workflow Efficiency**: 25% reduction in decision-to-action time
- **Task Generation Accuracy**: >90% clinically relevant tasks
- **Performance**: Task generation under 2s, interface loads under 200ms
- **User Satisfaction**: >4.5/5 rating for task management

---

## Detailed Requirements

### 1. Functional Requirements

#### Task Generation from LLM (FHIR R4 Compliant)

- **REQ‑TG‑001**: Generate FHIR R4 `Task` resources from LLM output with proper `resourceType`, `id`, `intent`, and `status`
- **REQ‑TG‑002**: Set task `intent` to "order" for clinical actions, "proposal" for suggestions
- **REQ‑TG‑003**: Each task SHALL include required FHIR fields: `id`, `status`, `intent`, `code.text`, `for` (patient reference), `authoredOn`
- **REQ‑TG‑004**: Support optional FHIR fields: `description`, `priority`, `focus` (related clinical resource), `basedOn` (CarePlan reference)
- **REQ‑TG‑005**: Manual creation of tasks by providers using same FHIR structure

#### Task Management Interface (FHIR-Aligned)

- **REQ‑TM‑001**: Add "Tasks" tab beside "Records" and "Discuss" displaying FHIR Task resources
- **REQ‑TM‑002**: Support FHIR status transitions: `requested` → `in-progress` → `completed` via checkbox toggle
- **REQ‑TM‑003**: Enable editing of FHIR-compliant fields: `code.text` (title), `description`, `priority` dropdown
- **REQ‑TM‑004**: Display FHIR metadata: `authoredOn` timestamp, `for` patient reference, `basedOn` CarePlan context
- **REQ‑TM‑005**: Group tasks by `basedOn` CarePlan reference when available
- **REQ‑TM‑006**: Show `focus` resource links to related clinical data (Conditions, Observations)

#### Chat Integration

- **REQ‑CI‑001**: Display action buttons in chat for task creation
- **REQ‑CI‑002**: Enable "Add to Tasks" per individual or bulk tasks
- **REQ‑CI‑003**: Chat indicates when tasks were created

#### Clinical Context Integration

- **REQ‑CC‑001**: Integrate patient FHIR data in task generation
- **REQ‑CC‑002**: Link tasks to relevant FHIR resources
- **REQ‑CC‑003**: Prioritize tasks based on clinical indicators

---

## 1.X. Task Resource Data Model (FHIR R4, Minimal Prototype)

For this Demo Phase (session-only, in-memory), the following FHIR R4 `Task` fields are essential and should be displayed/editable in the UI.

### ⚙️ Required & Editable Fields

| Field           | Description                                    | Editable in UI?               |
| --------------- | ---------------------------------------------- | ----------------------------- |
| `id`            | Unique resource identifier (string)            | No (auto-generated)           |
| `status`        | `requested` / `in-progress` / `completed`      | ✅ Checkbox toggle            |
| `intent`        | Task intent (e.g. `proposal`, `order`)         | No (preset to "order")        |
| `code`          | Title or short description (`CodeableConcept`) | ✅ Editable text              |
| `description`   | Free-text rationale or clinical detail         | ✅ Optional editable          |
| `priority`      | `routine` / `urgent` / `asap` / `stat`         | ⚪ Optional dropdown          |
| `for` (subject) | Reference to Patient resource                  | No (bound to current patient) |

### ✅ Additional UI‑visible (non-editable) fields

- `basedOn` or `groupIdentifier` — Optional link to session or careplan context (auto-generated)
- `focus` — Reference to triggering clinical resource if available (e.g. `Condition`, `Observation`)
- `authoredOn` — Timestamp for task creation (session-only)

### 📦 Future Expansion (for later FHIR server integration)

Once full persistence is added in later phases, consider enabling support for:

- `identifier` – business-level task ID
- `requester` / `owner` – Who created or owns the task (e.g. LLM agent or practitioner)
- `executionPeriod` – Start and end timestamps
- `reasonCode` / `reasonReference` – Why the task exists
- `encounter` – Associated clinical encounter
- `note`, `input`, `output`, `relevantHistory`, `restriction` – workflow metadata for audit and automation

### 🧪 Sample Minimal Task JSON Snippet

```json
{
  "resourceType": "Task",
  "id": "task‑1234",
  "intent": "order",
  "status": "requested",
  "priority": "routine",
  "code": {
    "text": "Order CBC with differential"
  },
  "description": "Evaluate potential anemia based on fatigue and pale conjunctiva",
  "for": {
    "reference": "Patient/abc"
  },
  "authoredOn": "2025-07-29T14:12:00Z",
  "basedOn": [
    {
      "reference": "CarePlan/session‑999"
    }
  ]
}
```

---

## 📌 Phase: Next Best Action Workflow Integration

**Goal**: Convert “Next Best Action” LLM results into editable task lists in UI.

**Deliverables**

- LLM responses tagged `source: "next_best_action"`
- Chat UI shows proposed task preview with **Accept All**, **Modify**, **Dismiss**
- Backend tags session and tasks with timestamps and patient context
- Tasks appear in Tasks tab with editing capability

**Roadmap: Week 9**

- Days 1–2: Enhance LLM endpoint for NBA tasks
- Days 3–4: Chat UI preview and controls
- Day 5: Implement task editing modal

---

## 🗂️ Phase X: FHIR Demo Phase — CarePlan + Task (Session‑Only)

**Goal**: Demo FHIR‑compatible `Task[]` and wrapping `CarePlan` context without persistence.

**Deliverables**

- LLM outputs FHIR‑shaped `Task[]` plus `CarePlan` metadata (JSON)
- UI displays tasks as checkboxes grouped by CarePlan label
- Users can check/uncheck tasks (in‑memory only)
- On refresh, tasks and CarePlan vanish
- Placeholder UI/logging indicates future FHIR API integration

**Roadmap: Week 10**

- Generate FHIR‑compliant JSON in payload
- Design session‑only Tasks tab with checkboxes
- In‑memory state management, no backend storage or security concerns

**User Story**

> As a proof‑of‑concept user, I want to see Next Best Action recommendations shaped as FHIR `Task` grouped in a `CarePlan` and interact via checkboxes—so I can validate how this will map to a real FHIR store later.

**Success Criteria**

- Structured `CarePlan` + `Task[]` JSON in LLM response
- Checkbox UI functioning correctly
- All state reset on page reload
- Logs/UI indicate ready hook for future FHIR persistence

**Out of Scope**

- No real FHIR store or EHR integration
- No audit logging or PHI persistence
- No provider credentialing or security compliance in this demo

---

## 🧪 Phase X.1: SMART Sandbox Validation

**Goal**: Validate FHIR Task and CarePlan JSON structure against live SMART Health IT sandbox before full NiskaChat integration.

**Prerequisites**: Phase X completion with working FHIR-compliant JSON generation

**Deliverables**

- **SMART OAuth2 Integration**: Configure NiskaChat to authenticate with `launch.smarthealthit.org`
- **Task POST Operations**: Successfully create Task resources via HTTP POST to sandbox FHIR endpoint
- **Task PUT Operations**: Update Task status (`requested` → `in-progress` → `completed`) via HTTP PUT
- **CarePlan Linking**: Validate `basedOn` references between Tasks and CarePlan resources
- **Scope Validation**: Test with appropriate SMART scopes (`patient/Task.cu`, `patient/CarePlan.cu`)
- **Data Structure Verification**: Confirm FHIR R4 compliance using sandbox validation responses

**Roadmap: Week 10.5 (Mid-Week Addition)**

- **Day 1**: Set up SMART OAuth2 authentication flow with launcher
- **Day 2**: Implement Task POST operations with proper FHIR JSON structure
- **Day 3**: Add Task PUT operations for status updates
- **Day 4**: Test CarePlan creation and Task linking via `basedOn` references
- **Day 5**: Validate complete workflow and document any FHIR compliance issues

**User Story**

> As a development team, I want to validate our FHIR Task and CarePlan JSON structure against a live FHIR server—so I can ensure data model compliance before implementing full NiskaChat integration and catch any structural issues early.

**Success Criteria**

- ✅ **OAuth2 Authentication**: Successfully authenticate with SMART launcher using proper scopes
- ✅ **Task Creation**: POST operations create valid Task resources in sandbox
- ✅ **Task Updates**: PUT operations successfully modify Task status and fields
- ✅ **CarePlan Integration**: Tasks properly reference CarePlan via `basedOn` field
- ✅ **FHIR Validation**: Sandbox accepts all generated JSON without validation errors
- ✅ **Patient Context**: Tasks correctly reference patient via `for` field
- ✅ **Documentation**: Complete API interaction patterns documented for production use

**Technical Requirements**

- **Required SMART Scopes**: `patient/Task.cu patient/CarePlan.cu patient/Patient.read`
- **FHIR Endpoint**: `https://launch.smarthealthit.org/v/r4/fhir/`
- **Authentication**: OAuth2 with PKCE flow
- **Content-Type**: `application/fhir+json` for FHIR operations
- **Error Handling**: Proper HTTP status code handling (200, 201, 400, 401, 403)

**Risk Mitigation**

- **FHIR Validation Failures**: Have backup simplified Task structure if complex JSON fails
- **Authentication Issues**: Document alternative FHIR test servers as fallback
- **Rate Limiting**: Implement reasonable delays between API calls
- **Data Privacy**: Use only synthetic test patient data from sandbox

**Out of Scope**

- No production FHIR server integration
- No real patient data or PHI handling
- No full EHR workflow simulation
- No performance or load testing

**Post-Phase X.1 Benefits**

- **Validated Data Model**: FHIR structure proven to work with real servers
- **Reduced Risk**: Catch compliance issues before full development
- **Documentation**: Complete API patterns for production implementation
- **Confidence**: Team understands FHIR integration requirements

---

## Non-Functional Requirements

- **REQ‑NF‑001**: Task generation < 2 s
- **REQ‑NF‑002**: Task interface load < 200 ms
- **REQ‑NF‑003**: Support ≥ 50 concurrent tasks
- **REQ‑NF‑004**: Compliance-ready for HIPAA (future phase)
- **REQ‑NF‑005**: Audit logging placeholder for later
- **REQ‑NF‑007**: WCAG 2.1 AA accessible interface
- **REQ‑NF‑009**: Full support for keyboard and ARIA labels
- **REQ‑NF‑010**: Scalable architecture for horizontal load

---

## Technical Architecture

### Frontend (Angular)

```
├─ Records Tab
├─ Discuss (Chat) Tab
├─ Tasks Tab ← new
│  └─ TaskCardComponent
│     • Checkbox UI for demo tasks
└─ Chat Component with NBA preview controls
```

### Backend (Node.js/Express)

```
├─ /api/llm (enhanced)
│  • Adds task list + CarePlan metadata
├─ /api/tasks (CRUD) – placeholder for future FHIR storage
└─ Task Extraction Module
   • Parses LLM output into structured tasks
```

### Data Model (FHIR R4 Compliant)

```typescript
// FHIR R4 Task Resource (Minimal Implementation)
interface FHIRTask {
  resourceType: "Task";
  id: string;
  intent: "proposal" | "order" | "original-order";
  status: "requested" | "in-progress" | "completed" | "cancelled";
  priority?: "routine" | "urgent" | "asap" | "stat";
  code: {
    text: string; // Primary task description
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  description?: string; // Detailed clinical rationale
  for: {
    reference: string; // Patient reference
    display?: string;
  };
  authoredOn: string; // ISO 8601 timestamp
  basedOn?: Array<{
    reference: string; // CarePlan reference
  }>;
  focus?: {
    reference: string; // Related FHIR resource (Condition, Observation, etc.)
    display?: string;
  };
  // Demo-specific extensions
  _source?: "next_best_action" | "manual";
  _sessionId?: string;
}

// FHIR R4 CarePlan Resource (Minimal Implementation)
interface FHIRCarePlan {
  resourceType: "CarePlan";
  id: string;
  status: "draft" | "active" | "on-hold" | "revoked" | "completed";
  intent: "proposal" | "plan" | "order";
  title: string;
  subject: {
    reference: string; // Patient reference
    display?: string;
  };
  created: string; // ISO 8601 timestamp
  activity?: Array<{
    reference: {
      reference: string; // Task reference
    };
  }>;
  note?: Array<{
    text: string;
  }>;
  // Demo-specific extensions
  _sessionId?: string;
}

// Legacy interface mapping for backward compatibility
interface TaskItem extends Partial<FHIRTask> {
  // Maps to code.text
  title: string;
  // Maps to FHIR status enum
  category?: "diagnostic" | "therapeutic" | "monitoring" | "administrative" | "education";
  estimatedTime?: number; // minutes (non-FHIR extension)
}
```

---

## Conclusion

This PRD version 1.1 extends the NiskaChat roadmap with a dedicated Next Best Action workflow and a lightweight demo for FHIR-aligned task generation. The approach allows early user validation and iterative UX design before full FHIR integration, balancing innovation, usability testing, and future standards compliance.
