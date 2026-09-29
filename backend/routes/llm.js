import express from "express";
import { getLLMProviderFactory } from "../providers/providerFactory.js";
import {
  compressFHIRBundle,
  compressFHIRBundleForHeader,
} from "../utils/fhirBundleCompressor.js";
import logger from "../utils/logger.js";
import { getFormattedPrompt } from "../utils/promptLoader.js";
import { sanitizeInput } from "../utils/sanitize-input.js";

const router = express.Router();

// Context types for different interactions
const CONTEXT_TYPES = {
  SUMMARY: "summary",
  CLINICAL_CHAT: "clinical_chat",
};

const MAX_QUERY_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_MESSAGE_LENGTH = 12000;
const MAX_SOURCE_REFERENCES = 100;
const SOURCE_REFERENCE_PATTERN = /^[A-Z][A-Za-z0-9]+\/[A-Za-z0-9.-]{1,64}$/;

function resolveSourceReferences(clinicalData, suppliedReferences = []) {
  if (
    clinicalData?.resourceType === "Bundle" &&
    Array.isArray(clinicalData.entry)
  ) {
    return clinicalData.entry
      .map((entry) => entry?.resource)
      .filter(
        (resource) =>
          resource &&
          typeof resource.resourceType === "string" &&
          typeof resource.id === "string" &&
          SOURCE_REFERENCE_PATTERN.test(
            `${resource.resourceType}/${resource.id}`,
          ),
      )
      .map((resource) => `${resource.resourceType}/${resource.id}`)
      .slice(0, MAX_SOURCE_REFERENCES);
  }

  return suppliedReferences.slice(0, MAX_SOURCE_REFERENCES);
}

function validateRequestBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "A JSON object is required";
  }
  if (
    body.context !== undefined &&
    ![CONTEXT_TYPES.SUMMARY, CONTEXT_TYPES.CLINICAL_CHAT].includes(body.context)
  ) {
    return "Unsupported request context";
  }
  if (
    body.query !== undefined &&
    (typeof body.query !== "string" || body.query.length > MAX_QUERY_LENGTH)
  ) {
    return `Question must be a string of ${MAX_QUERY_LENGTH} characters or fewer`;
  }
  if (
    body.conversationHistory !== undefined &&
    (!Array.isArray(body.conversationHistory) ||
      body.conversationHistory.length > MAX_HISTORY_MESSAGES ||
      body.conversationHistory.some(
        (message) =>
          !message ||
          typeof message.content !== "string" ||
          message.content.length > MAX_HISTORY_MESSAGE_LENGTH ||
          typeof message.isUser !== "boolean",
      ))
  ) {
    return "Conversation history is invalid or exceeds the supported size";
  }
  if (
    body.sourceReferences !== undefined &&
    (!Array.isArray(body.sourceReferences) ||
      body.sourceReferences.length > MAX_SOURCE_REFERENCES ||
      body.sourceReferences.some(
        (reference) =>
          typeof reference !== "string" ||
          !SOURCE_REFERENCE_PATTERN.test(reference),
      ))
  ) {
    return "Source references are invalid or exceed the supported size";
  }
  return null;
}

/**
 * Extract relevant clinical data from FHIR Bundle
 */
function extractClinicalData(bundle) {
  if (!bundle || !bundle.entry || !Array.isArray(bundle.entry)) {
    return "No clinical data available";
  }

  // If bundle has no entries, it's effectively empty
  if (bundle.entry.length === 0) {
    return "No clinical data available";
  }

  const data = {
    patient: null,
    conditions: [],
    observations: [],
    medications: [],
  };

  let hasValidResources = false;

  // Extract resources from bundle
  bundle.entry.forEach((entry) => {
    if (!entry || !entry.resource || !entry.resource.resourceType) {
      return; // Skip invalid entries
    }

    const resource = entry.resource;
    hasValidResources = true;

    switch (resource.resourceType) {
      case "Patient":
        data.patient = resource;
        break;
      case "Condition":
        if (resource.clinicalStatus?.coding?.[0]?.code === "active") {
          data.conditions.push(resource);
        }
        break;
      case "Observation":
        data.observations.push(resource);
        break;
      case "MedicationRequest":
        if (resource.status === "active") {
          data.medications.push(resource);
        }
        break;
    }
  });

  // If no valid resources found, return error indicator
  if (!hasValidResources) {
    return "No clinical data available";
  }

  return data;
}

/**
 * Format clinical data for LLM prompt
 */
function formatClinicalData(data) {
  logger.debug("formatClinicalData called", {
    dataType: typeof data,
    dataKeys: data ? Object.keys(data) : null,
  });

  if (!data) {
    logger.warn("formatClinicalData received null/undefined data");
    return "No clinical data available";
  }

  let formatted = "";

  // Patient demographics
  if (data.patient) {
    const patient = data.patient;
    const name = patient.name?.[0];
    const nameStr = name ? `${name.given?.[0]} ${name.family}` : "Unknown";
    const dob = patient.birthDate || "Unknown";
    const gender = patient.gender || "Unknown";

    formatted += `Patient: ${nameStr}\n`;
    formatted += `Date of Birth: ${dob}\n`;
    formatted += `Gender: ${gender}\n\n`;
  }

  // Active conditions
  if (data.conditions.length > 0) {
    formatted += "Active Conditions:\n";
    data.conditions.forEach((condition, index) => {
      const code = condition.code?.coding?.[0];
      const display = code?.display || "Unknown condition";
      const onset =
        condition.onsetDateTime || condition.recordedDate || "Unknown date";
      formatted += `${index + 1}. ${display} (${onset})\n`;
    });
    formatted += "\n";
  }

  // Recent observations
  if (data.observations.length > 0) {
    formatted += "Recent Observations:\n";
    data.observations.slice(0, 10).forEach((obs, index) => {
      const code = obs.code?.coding?.[0];
      const display = code?.display || "Unknown observation";
      const value = obs.valueQuantity?.value || obs.valueString || "No value";
      const unit = obs.valueQuantity?.unit || "";
      const date = obs.effectiveDateTime || obs.issued || "Unknown date";
      formatted += `${index + 1}. ${display}: ${value} ${unit} (${date})\n`;
    });
    formatted += "\n";
  }

  // Current medications
  if (data.medications.length > 0) {
    formatted += "Current Medications:\n";
    data.medications.forEach((med, index) => {
      const medication = med.medicationCodeableConcept?.coding?.[0];
      const display = medication?.display || "Unknown medication";
      const dosage = med.dosageInstruction?.[0]?.text || "Dosage not specified";
      formatted += `${index + 1}. ${display} - ${dosage}\n`;
    });
    formatted += "\n";
  }

  return formatted;
}

/**
 * Format conversation history for the LLM prompt with context window budgeting
 */
function formatConversationHistory(conversationHistory) {
  if (
    !conversationHistory ||
    !Array.isArray(conversationHistory) ||
    conversationHistory.length === 0
  ) {
    return "";
  }

  // Bound history to the most recent 6 messages to protect context limits
  const recentHistory = conversationHistory
    .filter(
      (msg) =>
        !msg.isLoading &&
        typeof msg.content === "string" &&
        typeof msg.isUser === "boolean",
    )
    .slice(-6);

  // Format conversation history as a readable string, truncating long assistant responses
  const formattedHistory = recentHistory
    .map((msg) => {
      const role = msg.isUser ? "Human" : "Assistant";
      let content = msg.content.slice(0, MAX_HISTORY_MESSAGE_LENGTH);
      // Assistant responses can be very long (CarePlans/JSON); trim past turns to 400 chars
      if (!msg.isUser && content.length > 400) {
        content = `${content.substring(0, 400)}... [truncated]`;
      }
      return `${role}: ${content}`;
    })
    .join("\n");

  return formattedHistory;
}

/**
 * Generate appropriate prompt based on context type
 */
function generatePrompt(
  context,
  data,
  userQuery = null,
  conversationHistory = null,
  sourceReferences = [],
) {
  logger.debug("generatePrompt called", {
    context,
    dataType: typeof data,
    dataKeys: data ? Object.keys(data) : null,
    queryLength: typeof userQuery === "string" ? userQuery.length : 0,
  });

  switch (context) {
    case CONTEXT_TYPES.CLINICAL_CHAT: {
      // Check if we have pre-compressed data from client
      if (typeof data === "string") {
        logger.debug("Processing pre-compressed data");
        return getFormattedPrompt("clinical-chat", {
          fhirBundle: "", // Empty string for legacy compatibility
          patientData: data,
          userQuery: userQuery || "Please provide an overview of this patient.",
          conversationHistory: formatConversationHistory(conversationHistory),
          sourceReferences: sourceReferences.join("\n"),
        });
      }
      // For chat interactions, check if we have a full FHIR bundle
      else if (data && data.resourceType === "Bundle" && data.entry) {
        logger.debug("Processing FHIR bundle", { count: data.entry.length });
        // Use compressed FHIR bundle instead of full JSON for token efficiency
        const compressedData = compressFHIRBundle(data);
        return getFormattedPrompt("clinical-chat", {
          fhirBundle: "", // Empty string for legacy compatibility
          patientData: compressedData,
          userQuery: userQuery || "Please provide an overview of this patient.",
          conversationHistory: formatConversationHistory(conversationHistory),
          sourceReferences: sourceReferences.join("\n"),
        });
      } else {
        logger.debug("Processing legacy structured data");
        // Legacy handling for structured data
        let formattedData;
        if (
          data &&
          data.patient &&
          !data.conditions &&
          !data.observations &&
          !data.medications
        ) {
          // Convert minimal patient data to expected structure
          formattedData = {
            patient: data.patient,
            conditions: [],
            observations: [],
            medications: [],
          };
        } else {
          formattedData = data;
        }

        const patientData = formatClinicalData(formattedData);
        return getFormattedPrompt("clinical-chat", {
          fhirBundle: "", // Empty string for FHIR bundle
          patientData,
          userQuery: userQuery || "Please provide an overview of this patient.",
          conversationHistory: formatConversationHistory(conversationHistory),
          sourceReferences: sourceReferences.join("\n"),
        });
      }
    }

    case CONTEXT_TYPES.SUMMARY:
    default: {
      // For summaries, check if we have a full FHIR bundle
      if (data && data.resourceType === "Bundle" && data.entry) {
        // Use compressed FHIR bundle instead of extracted/formatted data for token efficiency
        const compressedData = compressFHIRBundle(data);
        return getFormattedPrompt("clinical-summary", {
          fhirData: compressedData,
          sourceReferences: sourceReferences.join("\n"),
        });
      } else {
        // Legacy handling for structured data
        const formattedData = formatClinicalData(data);
        return getFormattedPrompt("clinical-summary", {
          fhirData: formattedData,
          sourceReferences: sourceReferences.join("\n"),
        });
      }
    }
  }
}

/**
 * Call LLM provider for summarization
 * @param {string} prompt - The prompt to send to the LLM
 * @param {Object} options - Options for the LLM call
 * @returns {Promise<{response: string, provider: string}>}
 */
async function callLLM(prompt, options = {}) {
  try {
    const llmFactory = getLLMProviderFactory();
    const result = await llmFactory.generateResponse(prompt, options);
    return {
      response: result.response || "No summary generated",
      provider: result.provider,
    };
  } catch (error) {
    logger.error("LLM call failed:", error?.name || "UnknownError");
    throw error;
  }
}

/**
 * Parse a chat response and retain only the narrow, display-only suggestion shape.
 * Model-generated FHIR resources are intentionally ignored; a human-created task
 * is built by the app only after an explicit review action.
 */
export function parseClinicalChatResponse(
  llmResponse,
  allowedSourceReferences = [],
) {
  const plainText = {
    response:
      "The model response could not be validated against the expected evidence-linked format. No clinical answer or suggestions are available.",
    suggestedActions: [],
    evidenceReferences: [],
    isPlainText: true,
  };

  if (allowedSourceReferences.length === 0) {
    return plainText;
  }

  try {
    if (typeof llmResponse !== "string" || !llmResponse.trim()) {
      return plainText;
    }
    const trimmed = llmResponse.trim();
    const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    const jsonText = fencedMatch ? fencedMatch[1].trim() : trimmed;

    if (!jsonText.startsWith("{")) {
      return plainText;
    }

    const parsedResponse = JSON.parse(jsonText);
    if (
      !parsedResponse ||
      typeof parsedResponse !== "object" ||
      typeof parsedResponse.response !== "string" ||
      parsedResponse.response.length > 12000
    ) {
      return {
        ...plainText,
        response:
          "The model returned a response that did not pass validation. No suggested actions were shown.",
      };
    }

    const allowedCategories = new Set([
      "diagnostic",
      "therapeutic",
      "monitoring",
      "preventive",
    ]);
    const sourceReferenceSet = new Set(allowedSourceReferences);
    const filterReferences = (references) =>
      Array.isArray(references)
        ? [
            ...new Set(
              references.filter((reference) =>
                sourceReferenceSet.has(reference),
              ),
            ),
          ].slice(0, 20)
        : [];
    const evidenceReferences = filterReferences(
      parsedResponse.evidenceReferences,
    );
    if (allowedSourceReferences.length > 0 && evidenceReferences.length === 0) {
      return plainText;
    }

    const suggestedActions = Array.isArray(parsedResponse.suggestedActions)
      ? parsedResponse.suggestedActions
          .slice(0, 5)
          .filter(
            (action) =>
              action &&
              typeof action.id === "string" &&
              action.id.length <= 80 &&
              typeof action.title === "string" &&
              action.title.trim().length > 0 &&
              action.title.length <= 120 &&
              typeof action.description === "string" &&
              action.description.trim().length > 0 &&
              action.description.length <= 1000 &&
              allowedCategories.has(action.category) &&
              filterReferences(action.evidenceReferences).length > 0,
          )
          .map((action) => ({
            id: action.id,
            title: action.title.trim(),
            description: action.description.trim(),
            // Prioritization requires clinician judgment; model urgency is not used.
            priority: "routine",
            category: action.category,
            evidenceReferences: filterReferences(action.evidenceReferences),
          }))
      : [];

    return {
      response: parsedResponse.response.trim(),
      suggestedActions,
      evidenceReferences,
      isPlainText: false,
    };
  } catch {
    logger.warn(
      "Clinical chat response did not pass structured-output validation",
    );
    return {
      ...plainText,
      suggestedActions: [],
    };
  }
}

/**
 * Generate concise fallback summary without LLM
 */
function generateFallbackSummary(data) {
  // Generate a concise 3-sentence summary
  let patientInfo = "Patient";
  let conditionsInfo = "";
  let medicationsInfo = "";

  // Patient demographics
  if (data.patient) {
    const patient = data.patient;
    const name = patient.name?.[0];
    const nameStr = name ? `${name.given?.[0]} ${name.family}` : "Patient";

    let age = "unknown age";
    if (patient.birthDate) {
      const birthDate = new Date(patient.birthDate);
      const today = new Date();
      const ageYears = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age = `${ageYears - 1} years old`;
      } else {
        age = `${ageYears} years old`;
      }
    }

    const gender = patient.gender || "unknown gender";
    patientInfo = `${nameStr} is a ${age} ${gender}`;
  }

  // Active conditions
  if (data.conditions && data.conditions.length > 0) {
    const primaryConditions = data.conditions.slice(0, 3).map((condition) => {
      const display =
        condition.code?.coding?.[0]?.display || "unspecified condition";
      return display.toLowerCase();
    });
    conditionsInfo = ` with active conditions including ${primaryConditions.join(", ")}`;
  }

  // Current medications
  if (data.medications && data.medications.length > 0) {
    medicationsInfo = ` and is currently on ${data.medications.length} active medication${data.medications.length > 1 ? "s" : ""}`;
  }

  // Recent observations summary
  let observationsInfo = "";
  if (data.observations && data.observations.length > 0) {
    observationsInfo = ` Recent clinical observations include ${data.observations.length} recorded measurements and lab results.`;
  }

  // Build the final summary
  const summary = `${patientInfo}${conditionsInfo}${medicationsInfo}.${observationsInfo} This clinical summary was generated from structured FHIR data for healthcare provider review.`;

  return summary;
}

/**
 * Extract and validate clinicalData from request body
 */
function resolveClinicalData(body) {
  const { bundle, patientData, compressedData } = body;
  if (!bundle && !patientData && !compressedData) {
    return {
      error: "Missing patient data",
      message:
        "Please provide either a FHIR Bundle, patient data, or compressed data in the request body",
    };
  }

  let clinicalData;
  if (compressedData) {
    clinicalData = compressedData;
  } else if (bundle) {
    if (
      bundle.resourceType !== "Bundle" ||
      !Array.isArray(bundle.entry) ||
      bundle.entry.length === 0 ||
      !bundle.entry.some((entry) => entry && entry.resource)
    ) {
      return {
        error: "Invalid FHIR Bundle",
        message:
          "Bundle must have resourceType 'Bundle' and at least one entry with a resource",
      };
    }
    clinicalData = bundle;
  } else if (patientData) {
    if (
      patientData &&
      patientData.resourceType === "Bundle" &&
      patientData.entry
    ) {
      clinicalData = patientData;
    } else {
      clinicalData = patientData;
    }
  }

  if (!clinicalData) {
    return {
      error: "Invalid patient data",
      message: "No valid clinical data found in the request",
    };
  }

  return { clinicalData };
}

/**
 * POST /llm/stream - Stream clinical chat response via Server-Sent Events (SSE)
 */
router.post("/stream", async (req, res) => {
  try {
    const validationError = validateRequestBody(req.body);
    if (validationError) {
      return res
        .status(400)
        .json({ error: "Invalid request", message: validationError });
    }
    const {
      context = CONTEXT_TYPES.CLINICAL_CHAT,
      query,
      conversationHistory,
    } = req.body;

    const resolved = resolveClinicalData(req.body);
    if (resolved.error) {
      return res.status(400).json({
        error: resolved.error,
        message: resolved.message,
      });
    }

    const { clinicalData } = resolved;
    const sourceReferences = resolveSourceReferences(
      clinicalData,
      req.body.sourceReferences || [],
    );
    const llmFactory = getLLMProviderFactory();
    const hasProvider = await llmFactory.hasConfiguredProvider();

    if (!hasProvider) {
      return res.status(503).json({
        error: "Service Unavailable",
        message: "No LLM providers are available for streaming",
      });
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const sanitizedQuery = query ? sanitizeInput(query) : null;
    const prompt = generatePrompt(
      context,
      clinicalData,
      sanitizedQuery,
      conversationHistory,
      sourceReferences,
    );

    const abortController = new AbortController();
    let isClientDisconnected = false;

    req.on("close", () => {
      if (!res.writableEnded) {
        isClientDisconnected = true;
        abortController.abort();
        logger.info(
          "Client disconnected from SSE stream, aborted upstream request",
        );
      }
    });

    const llmOptions = {
      signal: abortController.signal,
      ...(context === CONTEXT_TYPES.CLINICAL_CHAT ? { maxTokens: 4000 } : {}),
    };

    let accumulatedText = "";
    let usedProvider = null;

    try {
      for await (const chunk of llmFactory.streamResponse(prompt, llmOptions)) {
        if (isClientDisconnected || res.writableEnded) {
          break;
        }
        if (chunk.provider && !usedProvider) {
          usedProvider = chunk.provider;
          sendEvent("start", { provider: usedProvider, context });
        }
        if (chunk.text) {
          accumulatedText += chunk.text;
        }
      }

      if (isClientDisconnected || res.writableEnded) {
        return;
      }

      let parsedActions = null;
      let isStructuredResponse = false;
      let evidenceReferences = [];
      let cleanResponseText = accumulatedText;

      if (context === CONTEXT_TYPES.CLINICAL_CHAT) {
        const parsed = parseClinicalChatResponse(
          accumulatedText,
          sourceReferences,
        );
        cleanResponseText = parsed.response;
        parsedActions = parsed.suggestedActions;
        evidenceReferences = parsed.evidenceReferences;
        isStructuredResponse = !parsed.isPlainText;
      }

      sendEvent("done", {
        success: true,
        summary: cleanResponseText,
        provider: usedProvider,
        suggestedActions: parsedActions,
        evidenceReferences,
        isStructuredResponse,
        context,
        timestamp: new Date().toISOString(),
      });
    } catch (streamError) {
      if (
        isClientDisconnected ||
        res.writableEnded ||
        abortController.signal.aborted
      ) {
        logger.debug("SSE stream ended due to client disconnect");
        return;
      }
      logger.error(
        "Streaming generation failed:",
        streamError?.name || "UnknownError",
      );
      sendEvent("error", {
        error: "Stream generation failed",
        message: "The configured model provider did not complete the request.",
      });
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  } catch (error) {
    logger.error("Streaming setup failed:", error?.name || "UnknownError");
    if (!res.headersSent) {
      res.status(500).json({
        error: "Streaming failed",
        message: "The request could not be completed. Please try again.",
      });
    } else {
      res.end();
    }
  }
});

/**
 * POST /llm - Generate clinical summary or chat response from FHIR Bundle
 */
router.post("/", async (req, res) => {
  try {
    const validationError = validateRequestBody(req.body);
    if (validationError) {
      return res
        .status(400)
        .json({ error: "Invalid request", message: validationError });
    }
    const {
      context = CONTEXT_TYPES.SUMMARY,
      query,
      conversationHistory,
    } = req.body;

    const resolved = resolveClinicalData(req.body);
    if (resolved.error) {
      return res.status(400).json({
        error: resolved.error,
        message: resolved.message,
      });
    }

    const { clinicalData } = resolved;
    const sourceReferences = resolveSourceReferences(
      clinicalData,
      req.body.sourceReferences || [],
    );

    let summary;
    let llmUsed = false;
    let provider = null;

    // Prepare response based on context
    const response = {
      success: true,
      summary: "", // Will be set below
      evidenceReferences: [],
      llmUsed,
      provider,
      context,
      timestamp: new Date().toISOString(),
    };

    // Check if any LLM provider is available
    const llmFactory = getLLMProviderFactory();
    const hasProvider = await llmFactory.hasConfiguredProvider();

    if (hasProvider) {
      try {
        logger.debug(`Generating prompt for ${context} context`);

        // Generate appropriate prompt based on context
        const sanitizedQuery = query ? sanitizeInput(query) : null;
        const prompt = generatePrompt(
          context,
          clinicalData,
          sanitizedQuery,
          conversationHistory,
          sourceReferences,
        );
        logger.debug(`Generated prompt length: ${prompt.length}`);

        // Use more tokens for clinical chat to handle complex FHIR JSON responses
        const llmOptions =
          context === CONTEXT_TYPES.CLINICAL_CHAT
            ? { maxTokens: 4000 } // Increase tokens for complex FHIR JSON response
            : {};

        const llmResult = await callLLM(prompt, llmOptions);

        if (context === CONTEXT_TYPES.CLINICAL_CHAT) {
          const parsedResponse = parseClinicalChatResponse(
            llmResult.response,
            sourceReferences,
          );
          summary = parsedResponse.response;
          provider = llmResult.provider;
          llmUsed = true;

          // Add the parsed suggested actions to the response
          response.suggestedActions = parsedResponse.suggestedActions;
          response.evidenceReferences = parsedResponse.evidenceReferences;
          response.isStructuredResponse = !parsedResponse.isPlainText;

          logger.info("Clinical chat response passed validation", {
            suggestedActionsCount: parsedResponse.suggestedActions?.length || 0,
            sourceReferenceCount:
              parsedResponse.evidenceReferences?.length || 0,
          });
        } else {
          const parsedSummary = parseClinicalChatResponse(
            llmResult.response,
            sourceReferences,
          );
          summary = parsedSummary.response;
          response.evidenceReferences = parsedSummary.evidenceReferences;
          provider = llmResult.provider;
          llmUsed = true;
          logger.info("AI summary passed evidence-reference validation", {
            sourceReferenceCount: parsedSummary.evidenceReferences.length,
          });
        }
      } catch (llmError) {
        logger.warn(`Configured LLM provider failed for ${context} context`);
        logger.debug(
          "LLM provider error type:",
          llmError?.name || "UnknownError",
        );

        // Fall back based on context
        if (context === CONTEXT_TYPES.CLINICAL_CHAT) {
          summary =
            "I apologize, but I'm currently unable to process your request due to a technical issue. Please try again in a moment, or rephrase your question.";
        } else {
          // Ensure we have proper data structure for fallback summary
          let fallbackData = clinicalData;
          if (
            clinicalData &&
            clinicalData.resourceType === "Bundle" &&
            clinicalData.entry
          ) {
            // Extract clinical data from FHIR bundle for fallback
            fallbackData = extractClinicalData(clinicalData);
          } else if (
            clinicalData &&
            clinicalData.patient &&
            !clinicalData.conditions &&
            !clinicalData.observations &&
            !clinicalData.medications
          ) {
            fallbackData = {
              patient: clinicalData.patient,
              conditions: [],
              observations: [],
              medications: [],
            };
          }
          summary = generateFallbackSummary(fallbackData);
        }
      }
    } else {
      logger.warn(
        `No LLM providers available for ${context} context, using fallback`,
      );

      if (context === CONTEXT_TYPES.CLINICAL_CHAT) {
        summary =
          "The AI assistant is currently unavailable. Please contact your system administrator for assistance with clinical data analysis.";
      } else {
        // Ensure we have proper data structure for fallback summary
        let fallbackData = clinicalData;
        if (
          clinicalData &&
          clinicalData.resourceType === "Bundle" &&
          clinicalData.entry
        ) {
          // Extract clinical data from FHIR bundle for fallback
          fallbackData = extractClinicalData(clinicalData);
        } else if (
          clinicalData &&
          clinicalData.patient &&
          !clinicalData.conditions &&
          !clinicalData.observations &&
          !clinicalData.medications
        ) {
          fallbackData = {
            patient: clinicalData.patient,
            conditions: [],
            observations: [],
            medications: [],
          };
        }
        summary = generateFallbackSummary(fallbackData);
      }
    }

    // Update response with final values
    response.summary = summary;
    response.llmUsed = llmUsed;
    response.provider = provider;

    // Add stats for summary context or when we have structured clinical data
    if (context === CONTEXT_TYPES.SUMMARY) {
      let statsData = clinicalData;
      if (
        clinicalData &&
        clinicalData.resourceType === "Bundle" &&
        clinicalData.entry
      ) {
        // Extract clinical data from FHIR bundle for stats
        statsData = extractClinicalData(clinicalData);
      }

      if (statsData && statsData.conditions && statsData.observations) {
        response.stats = {
          conditions: statsData.conditions?.length || 0,
          observations: statsData.observations?.length || 0,
          medications: statsData.medications?.length || 0,
        };
      }
    }

    // Add query echo for chat context
    if (context === CONTEXT_TYPES.CLINICAL_CHAT && query) {
      response.query = query;
    }

    res.json(response);
  } catch (error) {
    logger.error(
      "Summarization request failed:",
      error?.name || "UnknownError",
    );
    res.status(500).json({
      error: "Summarization failed",
      message: "The request could not be completed. Please try again.",
    });
  }
});

/**
 * GET /status - Check LLM providers status
 */
router.get("/status", async (req, res) => {
  try {
    const llmFactory = getLLMProviderFactory();
    const providersStatus = await llmFactory.getProvidersStatus();
    const selectedProvider =
      providersStatus.providers[providersStatus.preferredProvider] || null;

    res.json({
      llmConfigured: selectedProvider?.configured || false,
      ...providersStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Status check failed:", error?.name || "UnknownError");
    res.json({
      llmConfigured: false,
      fallbackEnabled: false,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /llm/compress - Get compressed FHIR bundle summary
 */
router.post("/compress", async (req, res) => {
  try {
    const { bundle } = req.body;

    if (!bundle) {
      return res.status(400).json({
        error: "Missing bundle",
        message: "Please provide a FHIR Bundle in the request body",
      });
    }

    // Compress the FHIR bundle for header display (basic patient info only)
    const compressedSummary = compressFHIRBundleForHeader(bundle);

    res.json({
      success: true,
      compressedSummary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      "FHIR bundle compression failed:",
      error?.name || "UnknownError",
    );
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to compress FHIR bundle",
    });
  }
});

export default router;
