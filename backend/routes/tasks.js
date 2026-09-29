import express from "express";
import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger.js";

const router = express.Router();

// This is deliberately a demo repository, not a FHIR repository. Keeping each
// session in a separate store prevents records loaded in one browser session
// from being exposed to another while making the persistence boundary explicit.
const taskStores = new Map();
const VALID_PRIORITIES = new Set(["routine", "urgent", "asap", "stat"]);

function getTaskStore(req) {
  // Assigning a store identifier makes the otherwise-empty Express session
  // persistent when saveUninitialized is disabled.
  if (!req.session.taskStoreId) {
    req.session.taskStoreId = uuidv4();
  }

  let store = taskStores.get(req.session.taskStoreId);
  if (!store) {
    store = new Map();
    taskStores.set(req.session.taskStoreId, store);
  }
  return store;
}

function validateRequiredString(value, fieldName, maxLength) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { valid: false, error: `${fieldName} is required` };
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} cannot exceed ${maxLength} characters`,
    };
  }
  return { valid: true, value: normalized };
}

function validateCommentText(text) {
  return validateRequiredString(text, "Comment text", 1000);
}

function createTaskNote(text, authorInfo) {
  const note = { time: new Date().toISOString(), text };

  // Annotation.author[x] is a choice element: emit a reference or a string,
  // never both.
  if (authorInfo.reference) {
    note.authorReference = {
      reference: authorInfo.reference,
      type: authorInfo.type || "Practitioner",
      ...(authorInfo.display ? { display: authorInfo.display } : {}),
    };
  } else {
    note.authorString = authorInfo.display || "Demo user";
  }
  return note;
}

function getCurrentUserInfo(req) {
  if (req.session?.user) {
    return {
      reference: req.session.user.reference,
      type: req.session.user.type || "Practitioner",
      display: req.session.user.display || "Current user",
    };
  }
  return { display: "Demo user" };
}

function parseIfMatch(value) {
  if (!value) return null;
  const match = /^(?:W\/)?"?(\d+)"?$/.exec(value.trim());
  return match ? match[1] : null;
}

function setVersionEtag(res, task) {
  res.set("ETag", `W/"${task.meta.versionId}"`);
}

// POST /api/tasks - create a session-scoped FHIR R4 Task.
router.post("/", (req, res) => {
  try {
    const { title, description, priority, patientReference, initialComment } =
      req.body;
    const validTitle = validateRequiredString(title, "Title", 200);
    const validPatient = validateRequiredString(
      patientReference,
      "Patient reference",
      500,
    );

    if (!validTitle.valid || !validPatient.valid) {
      return res.status(400).json({
        error: "Invalid task",
        details: [validTitle.error, validPatient.error].filter(Boolean),
      });
    }
    if (priority !== undefined && !VALID_PRIORITIES.has(priority)) {
      return res.status(400).json({
        error: "Invalid task",
        details: "Priority must be one of routine, urgent, asap, or stat",
      });
    }

    let normalizedDescription;
    if (description !== undefined && description !== null) {
      if (typeof description !== "string" || description.length > 2000) {
        return res.status(400).json({
          error: "Invalid task",
          details: "Description must be a string of at most 2000 characters",
        });
      }
      normalizedDescription = description.trim();
    }

    let normalizedComment;
    if (initialComment !== undefined) {
      const validation = validateCommentText(initialComment);
      if (!validation.valid) {
        return res.status(400).json({
          error: "Invalid initial comment",
          details: validation.error,
        });
      }
      normalizedComment = validation.value;
    }

    const now = new Date().toISOString();
    const task = {
      resourceType: "Task",
      id: uuidv4(),
      meta: { versionId: "1", lastUpdated: now },
      intent: "order",
      status: "requested",
      priority: priority || "routine",
      code: { text: validTitle.value },
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      for: { reference: validPatient.value },
      authoredOn: now,
      ...(normalizedComment
        ? { note: [createTaskNote(normalizedComment, getCurrentUserInfo(req))] }
        : {}),
    };

    getTaskStore(req).set(task.id, task);
    setVersionEtag(res, task);
    logger.info("Demo task created");
    return res.status(201).json({ success: true, task });
  } catch (error) {
    logger.error("Demo task creation failed:", error?.name || "UnknownError");
    return res.status(500).json({ error: "Failed to create task" });
  }
});

// POST /api/tasks/:id/comments - append a FHIR Annotation to Task.note.
router.post("/:id/comments", (req, res) => {
  try {
    const store = getTaskStore(req);
    const task = store.get(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const validation = validateCommentText(req.body.text);
    if (!validation.valid) {
      return res
        .status(400)
        .json({ error: "Invalid comment", details: validation.error });
    }

    const requestedVersion = parseIfMatch(req.headers["if-match"]);
    if (req.headers["if-match"] && requestedVersion !== task.meta.versionId) {
      return res.status(412).json({
        error: "Version conflict",
        currentVersion: task.meta.versionId,
      });
    }

    const nextVersion = String(Number(task.meta.versionId) + 1);
    const updatedTask = {
      ...task,
      meta: {
        ...task.meta,
        versionId: nextVersion,
        lastUpdated: new Date().toISOString(),
      },
      note: [
        ...(task.note || []),
        createTaskNote(validation.value, getCurrentUserInfo(req)),
      ],
    };

    store.set(task.id, updatedTask);
    setVersionEtag(res, updatedTask);
    logger.info("Demo task comment appended");
    return res.status(200).json({ success: true, task: updatedTask });
  } catch (error) {
    logger.error("Demo task comment failed:", error?.name || "UnknownError");
    return res.status(500).json({ error: "Failed to add comment" });
  }
});

router.get("/:id/comments", (req, res) => {
  const task = getTaskStore(req).get(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  const comments = [...(task.note || [])].sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
  );
  setVersionEtag(res, task);
  return res.json({ taskId: task.id, comments, count: comments.length });
});

router.get("/:id", (req, res) => {
  const task = getTaskStore(req).get(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  setVersionEtag(res, task);
  return res.json({ success: true, task });
});

router.get("/", (req, res) => {
  const tasks = Array.from(getTaskStore(req).values());
  return res.json({ success: true, tasks, count: tasks.length });
});

export default router;
