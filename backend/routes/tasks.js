import express from "express";
import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger.js";

const router = express.Router();

// In-memory storage for demo purposes (replace with FHIR server in production)
const tasks = new Map();
const taskVersions = new Map();

// Helper function to validate comment text
function validateCommentText(text) {
  if (!text || typeof text !== "string") {
    return { valid: false, error: "Comment text is required" };
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Comment text cannot be empty" };
  }

  if (trimmed.length > 1000) {
    return {
      valid: false,
      error: "Comment text cannot exceed 1000 characters",
    };
  }

  return { valid: true, text: trimmed };
}

// Helper function to create TaskNote (maps to FHIR Annotation)
function createTaskNote(text, authorInfo) {
  return {
    authorReference: authorInfo.reference
      ? {
          reference: authorInfo.reference,
          type: authorInfo.type || "Practitioner",
          display: authorInfo.display,
        }
      : undefined,
    authorString: authorInfo.display || "Unknown User",
    time: new Date().toISOString(),
    text: text,
  };
}

// Helper function to get current user info from session
function getCurrentUserInfo(req) {
  // For demo purposes, use session or mock user
  // In production, this would come from SMART on FHIR context
  if (req.session && req.session.user) {
    return {
      reference: req.session.user.reference,
      type: req.session.user.type || "Practitioner",
      display: req.session.user.display || "Current User",
    };
  }

  // Fallback for development/testing
  return {
    display: "Demo User",
    type: "Practitioner",
  };
}

// POST /api/tasks - Create new task with optional initial comment
router.post("/", (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      patientReference,
      source,
      initialComment,
    } = req.body;

    // Validate required fields
    if (!title || !patientReference) {
      return res.status(400).json({
        error: "Missing required fields",
        details: {
          title: !title ? "Title is required" : undefined,
          patientReference: !patientReference
            ? "Patient reference is required"
            : undefined,
        },
      });
    }

    // Validate initial comment if provided
    if (initialComment !== undefined) {
      const commentValidation = validateCommentText(initialComment);
      if (!commentValidation.valid) {
        return res.status(400).json({
          error: "Invalid initial comment",
          details: commentValidation.error,
        });
      }
    }

    // Create new task
    const taskId = uuidv4();
    const version = 1;

    const newTask = {
      resourceType: "Task",
      id: taskId,
      intent: "order",
      status: "requested",
      priority: priority || "routine",
      code: {
        text: title.trim(),
      },
      description: description?.trim(),
      for: {
        reference: patientReference,
      },
      authoredOn: new Date().toISOString(),
      _source: source || "manual",
      _sessionId: req.sessionID || "demo-session",
      version: version,
    };

    // Add initial comment if provided
    if (initialComment) {
      const userInfo = getCurrentUserInfo(req);
      newTask.note = [createTaskNote(initialComment, userInfo)];
    }

    // Store task
    tasks.set(taskId, newTask);
    taskVersions.set(taskId, version);

    logger.info("Task created successfully", {
      taskId,
      title: newTask.code.text,
      hasInitialComment: !!initialComment,
      sessionId: req.sessionID,
    });

    res.status(201).json({
      success: true,
      task: newTask,
      message: "Task created successfully",
    });
  } catch (error) {
    logger.error("Error creating task", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to create task",
    });
  }
});

// POST /api/tasks/:id/comments - Append comment to existing task
router.post("/:id/comments", (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const ifMatch = req.headers["if-match"];

    // Validate task exists
    const task = tasks.get(id);
    if (!task) {
      return res.status(404).json({
        error: "Task not found",
        message: `Task with ID ${id} does not exist`,
      });
    }

    // Validate comment text
    const commentValidation = validateCommentText(text);
    if (!commentValidation.valid) {
      return res.status(400).json({
        error: "Invalid comment",
        details: commentValidation.error,
      });
    }

    // Check optimistic concurrency
    const currentVersion = taskVersions.get(id);
    if (ifMatch && parseInt(ifMatch) !== currentVersion) {
      return res.status(409).json({
        error: "Version conflict",
        message: "Task has been modified by another user",
        currentVersion,
        requestedVersion: ifMatch,
      });
    }

    // Get current user info
    const userInfo = getCurrentUserInfo(req);

    // Create new comment
    const newComment = createTaskNote(commentValidation.text, userInfo);

    // Append comment to task
    if (!task.note) {
      task.note = [];
    }
    task.note.push(newComment);

    // Increment version
    const newVersion = currentVersion + 1;
    task.version = newVersion;
    taskVersions.set(id, newVersion);

    // Update task
    tasks.set(id, task);

    logger.info("Comment appended to task", {
      taskId: id,
      commentAuthor: userInfo.display,
      commentLength: commentValidation.text.length,
      newVersion,
      sessionId: req.sessionID,
    });

    res.status(200).json({
      success: true,
      task: {
        id: task.id,
        note: task.note,
        version: task.version,
      },
      message: "Comment added successfully",
    });
  } catch (error) {
    logger.error("Error appending comment", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to add comment",
    });
  }
});

// GET /api/tasks/:id/comments - Get all comments for a task
router.get("/:id/comments", (req, res) => {
  try {
    const { id } = req.params;

    // Validate task exists
    const task = tasks.get(id);
    if (!task) {
      return res.status(404).json({
        error: "Task not found",
        message: `Task with ID ${id} does not exist`,
      });
    }

    // Return comments sorted by time (newest first)
    const comments = (task.note || []).sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
    );

    res.status(200).json({
      success: true,
      taskId: id,
      comments,
      count: comments.length,
    });
  } catch (error) {
    logger.error("Error retrieving comments", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to retrieve comments",
    });
  }
});

// GET /api/tasks/:id - Get task by ID
router.get("/:id", (req, res) => {
  try {
    const { id } = req.params;

    const task = tasks.get(id);
    if (!task) {
      return res.status(404).json({
        error: "Task not found",
        message: `Task with ID ${id} does not exist`,
      });
    }

    res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    logger.error("Error retrieving task", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to retrieve task",
    });
  }
});

// GET /api/tasks - Get all tasks
router.get("/", (req, res) => {
  try {
    const allTasks = Array.from(tasks.values());

    res.status(200).json({
      success: true,
      tasks: allTasks,
      count: allTasks.length,
    });
  } catch (error) {
    logger.error("Error retrieving tasks", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to retrieve tasks",
    });
  }
});

export default router;

