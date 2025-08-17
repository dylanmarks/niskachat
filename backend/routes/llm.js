import express from "express";
import { getLLMProviderFactory } from "../providers/providerFactory.js";
import {
  compressFHIRBundle,
  compressFHIRBundleForHeader,
} from "../utils/fhirBundleCompressor.js";
import logger from "../utils/logger.js";
import { getFormattedPrompt } from "../utils/promptLoader.js";

const router = express.Router();

// Context types for different interactions
const CONTEXT_TYPES = {
  SUMMARY: "summary",
  CLINICAL_CHAT: "clinical_chat",
};

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
 * Format conversation history for the LLM prompt
 */
function formatConversationHistory(conversationHistory) {
  if (!conversationHistory || !Array.isArray(conversationHistory) || conversationHistory.length === 0) {
    return "";
  }

  // Format conversation history as a readable string
  const formattedHistory = conversationHistory
    .filter(msg => !msg.isLoading) // Exclude loading messages
    .map(msg => {
      const role = msg.isUser ? "Human" : "Assistant";
      const timestamp = new Date(msg.timestamp).toLocaleString();
      return `[${timestamp}] ${role}: ${msg.content}`;
    })
    .join("\n");

  return formattedHistory;
}

/**
 * Generate appropriate prompt based on context type
 */
function generatePrompt(context, data, userQuery = null, conversationHistory = null) {
  logger.debug("generatePrompt called", {
    context,
    dataType: typeof data,
    dataKeys: data ? Object.keys(data) : null,
    userQuery,
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
        });
      } else {
        // Legacy handling for structured data
        const formattedData = formatClinicalData(data);
        return getFormattedPrompt("clinical-summary", {
          fhirData: formattedData,
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
    logger.error("LLM call failed:", error);
    throw error;
  }
}

/**
 * Parse and validate Clinical Chat response with suggested actions and optional FHIR tasks
 */
function parseClinicalChatResponse(llmResponse) {
  try {
    logger.debug("Parsing clinical chat response", {
      responseLength: llmResponse.length,
      responseStart: llmResponse.substring(0, 200)
    });

    // Try to parse JSON from the response
    let parsedResponse;
    let jsonText = "";
    
    // Handle cases where response might be wrapped in markdown code blocks
    const jsonMatch = llmResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
      logger.debug("Found JSON in code block", { jsonLength: jsonText.length });
    } else {
      // Try to find JSON-like content in the response
      const jsonStart = llmResponse.indexOf('{');
      const jsonEnd = llmResponse.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonText = llmResponse.substring(jsonStart, jsonEnd + 1).trim();
        logger.debug("Extracted JSON-like content", { jsonLength: jsonText.length });
      } else {
        // If no JSON structure found, treat as plain text response
        logger.debug("No JSON structure found, treating as plain text");
        return {
          response: llmResponse,
          suggestedActions: [],
          isPlainText: true
        };
      }
    }

    // Try to fix common JSON truncation issues
    if (jsonText && !jsonText.endsWith('}')) {
      logger.warn("JSON appears to be truncated, attempting to fix");
      // Count open braces to try to close properly
      const openBraces = (jsonText.match(/\{/g) || []).length;
      const closeBraces = (jsonText.match(/\}/g) || []).length;
      const missingBraces = openBraces - closeBraces;
      
      if (missingBraces > 0) {
        // Add missing closing braces
        jsonText += '}'.repeat(missingBraces);
        logger.debug("Added missing closing braces", { count: missingBraces });
      }
      
      // Try to complete arrays if they're incomplete
      if (jsonText.includes('"tasks": [') && !jsonText.includes('"tasks": []')) {
        const tasksMatch = jsonText.match(/"tasks":\s*\[([^\]]*?)$/);
        if (tasksMatch && !jsonText.endsWith(']]')) {
          // Try to close incomplete task array
          if (jsonText.endsWith(',')) {
            jsonText = jsonText.slice(0, -1); // Remove trailing comma
          }
          if (!jsonText.endsWith(']')) {
            jsonText += ']';
            logger.debug("Closed incomplete tasks array");
          }
        }
      }
    }

    try {
      parsedResponse = JSON.parse(jsonText);
    } catch (parseError) {
      logger.debug("JSON parsing failed, treating as plain text", {
        error: parseError.message
      });
      // Fall back to plain text response
      return {
        response: llmResponse,
        suggestedActions: [],
        isPlainText: true
      };
    }

    // Validate structure - be flexible about structure
    if (typeof parsedResponse.response !== 'string') {
      logger.debug("Invalid response structure, using raw response");
      return {
        response: llmResponse,
        suggestedActions: [],
        isPlainText: true
      };
    }

    // Ensure suggestedActions is an array
    if (!Array.isArray(parsedResponse.suggestedActions)) {
      parsedResponse.suggestedActions = [];
    }

    // Validate suggested actions structure
    parsedResponse.suggestedActions = parsedResponse.suggestedActions.filter((action, index) => {
      if (!action.id || !action.title || !action.description) {
        logger.debug(`Invalid suggested action at index ${index}, filtering out`);
        return false;
      }
      return true;
    });

    // Check if this response includes FHIR task generation (when user requests comprehensive actions)
    let taskGeneration = null;
    if (parsedResponse.carePlan && parsedResponse.tasks && Array.isArray(parsedResponse.tasks)) {
      // Validate CarePlan structure
      const carePlan = parsedResponse.carePlan;
      if (carePlan.resourceType === "CarePlan" && carePlan.id && carePlan.title) {
        // Validate Task structures
        const validTasks = parsedResponse.tasks.filter((task, index) => {
          if (task.resourceType !== "Task" || !task.id || !task.code?.text) {
            logger.debug(`Invalid Task structure at index ${index}, filtering out`);
            return false;
          }
          return true;
        });

        if (validTasks.length > 0) {
          taskGeneration = {
            summary: parsedResponse.response,
            carePlan: carePlan,
            tasks: validTasks,
            source: "clinical_chat"
          };
          logger.info("Successfully parsed FHIR task generation", {
            carePlanId: carePlan.id,
            taskCount: validTasks.length
          });
        }
      }
    }

    logger.info("Successfully parsed clinical chat response", {
      responseLength: parsedResponse.response.length,
      suggestedActionsCount: parsedResponse.suggestedActions.length,
      hasTaskGeneration: !!taskGeneration
    });

    return {
      response: parsedResponse.response,
      suggestedActions: parsedResponse.suggestedActions,
      taskGeneration: taskGeneration,
      isPlainText: false
    };
  } catch (error) {
    logger.warn("Failed to parse clinical chat response, using fallback", {
      error: error.message
    });
    
    // Return fallback structure with plain text response
    return {
      response: llmResponse,
      suggestedActions: [],
      isPlainText: true
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
 * POST /llm - Generate clinical summary or chat response from FHIR Bundle
 */
router.post("/", async (req, res) => {
  try {
    const {
      bundle,
      context = CONTEXT_TYPES.SUMMARY,
      query,
      patientData,
      compressedData,
      conversationHistory,
    } = req.body;


    // For chat context, we can accept either bundle, patientData, or compressedData
    if (!bundle && !patientData && !compressedData) {
      return res.status(400).json({
        error: "Missing patient data",
        message:
          "Please provide either a FHIR Bundle, patient data, or compressed data in the request body",
      });
    }

    let clinicalData;

    // Handle different input types
    if (compressedData) {
      // Client-side compressed data - use directly
      clinicalData = compressedData;
    } else if (bundle) {
      // If we have a bundle, use it directly for FHIR bundle processing
      clinicalData = bundle;
    } else if (patientData) {
      // Check if patientData is actually a FHIR bundle
      if (
        patientData &&
        patientData.resourceType === "Bundle" &&
        patientData.entry
      ) {
        // patientData is a FHIR bundle
        clinicalData = patientData;
      } else {
        // Legacy structured data or minimal patient data
        clinicalData = patientData;
      }
    }

    // Validate we have some clinical data
    if (!clinicalData) {
      return res.status(400).json({
        error: "Invalid patient data",
        message: "No valid clinical data found in the request",
      });
    }

    let summary;
    let llmUsed = false;
    let provider = null;

    // Prepare response based on context
    const response = {
      success: true,
      summary: "", // Will be set below
      llmUsed,
      provider,
      context,
      timestamp: new Date().toISOString(),
    };

    // Check if any LLM provider is available
    const llmFactory = getLLMProviderFactory();
    const hasProvider = await llmFactory.hasAvailableProvider();

    if (hasProvider) {
      try {
        logger.debug(`Generating prompt for ${context} context`, {
          clinicalDataType: typeof clinicalData,
          clinicalDataKeys: clinicalData ? Object.keys(clinicalData) : null,
          query,
        });

        // Generate appropriate prompt based on context
        const prompt = generatePrompt(context, clinicalData, query, conversationHistory);
        logger.debug(`Generated prompt length: ${prompt.length}`);

        // Use more tokens for clinical chat to handle complex FHIR JSON responses
        const llmOptions = context === CONTEXT_TYPES.CLINICAL_CHAT 
          ? { maxTokens: 4000 } // Increase tokens for complex FHIR JSON response
          : {};

        const llmResult = await callLLM(prompt, llmOptions);
        
        // Handle clinical chat responses (which now includes both simple and comprehensive actions)
        if (context === CONTEXT_TYPES.CLINICAL_CHAT) {
          const parsedResponse = parseClinicalChatResponse(llmResult.response);
          summary = parsedResponse.response;
          provider = llmResult.provider;
          llmUsed = true;
          
          // Add the parsed suggested actions to the response
          response.suggestedActions = parsedResponse.suggestedActions;
          response.isStructuredResponse = !parsedResponse.isPlainText;
          
          // Add task generation if present (for comprehensive action requests)
          if (parsedResponse.taskGeneration) {
            response.taskGeneration = parsedResponse.taskGeneration;
          }
          
          logger.info("✅ Clinical chat LLM call successful, parsed response", {
            responseLength: summary.length,
            suggestedActionsCount: parsedResponse.suggestedActions?.length || 0,
            hasTaskGeneration: !!parsedResponse.taskGeneration,
            isPlainText: parsedResponse.isPlainText || false
          });
        } else {
          summary = llmResult.response;
          provider = llmResult.provider;
          llmUsed = true;
          logger.info("✅ LLM call successful, using AI-generated summary");
        }
      } catch (llmError) {
        logger.warn(
          `LLM providers unavailable for ${context} context, using fallback: ${llmError.message}`,
        );
        logger.debug("Error stack:", llmError.stack);

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
    logger.error("Summarization error:", error);
    res.status(500).json({
      error: "Summarization failed",
      message: error.message,
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
    const hasAvailable = await llmFactory.hasAvailableProvider();

    res.json({
      llmAvailable: hasAvailable,
      ...providersStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Status check error:", error);
    res.json({
      llmAvailable: false,
      error: error.message,
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
    logger.error("Error compressing FHIR bundle:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to compress FHIR bundle",
    });
  }
});

export default router;
