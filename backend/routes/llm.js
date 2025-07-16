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
 * Generate appropriate prompt based on context type
 */
function generatePrompt(context, data, userQuery = null) {
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
  if (data.conditions.length > 0) {
    const primaryConditions = data.conditions.slice(0, 3).map((condition) => {
      const display =
        condition.code?.coding?.[0]?.display || "unspecified condition";
      return display.toLowerCase();
    });
    conditionsInfo = ` with active conditions including ${primaryConditions.join(", ")}`;
  }

  // Current medications
  if (data.medications.length > 0) {
    medicationsInfo = ` and is currently on ${data.medications.length} active medication${data.medications.length > 1 ? "s" : ""}`;
  }

  // Recent observations summary
  let observationsInfo = "";
  if (data.observations.length > 0) {
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
        const prompt = generatePrompt(context, clinicalData, query);
        logger.debug(`Generated prompt length: ${prompt.length}`);

        const llmResult = await callLLM(prompt);
        summary = llmResult.response;
        provider = llmResult.provider;
        llmUsed = true;
        logger.info("✅ LLM call successful, using AI-generated summary");
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

    // Prepare response based on context
    const response = {
      success: true,
      summary,
      llmUsed,
      provider,
      context,
      timestamp: new Date().toISOString(),
    };

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
