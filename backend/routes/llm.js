import express from "express";
import { getLLMProviderFactory } from "../providers/providerFactory.js";
import { getFormattedPrompt } from "../utils/promptLoader.js";

const router = express.Router();

// Get the LLM provider factory instance
const llmFactory = getLLMProviderFactory();

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
  switch (context) {
    case CONTEXT_TYPES.CLINICAL_CHAT: {
      // For chat interactions, format patient data and include user query
      const patientData = formatClinicalData(data);
      return getFormattedPrompt("clinical-chat", {
        patientData,
        userQuery: userQuery || "Please provide an overview of this patient.",
      });
    }

    case CONTEXT_TYPES.SUMMARY:
    default: {
      // For summaries, use the traditional formatted data
      const formattedData = formatClinicalData(data);
      return getFormattedPrompt("clinical-summary", {
        fhirData: formattedData,
      });
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
    const result = await llmFactory.generateResponse(prompt, options);
    return {
      response: result.response || "No summary generated",
      provider: result.provider,
    };
  } catch (error) {
    console.error("LLM call failed:", error);
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
    } = req.body;

    // For chat context, we can accept either bundle or patientData
    if (!bundle && !patientData) {
      return res.status(400).json({
        error: "Missing patient data",
        message:
          "Please provide either a FHIR Bundle or patient data in the request body",
      });
    }

    let clinicalData;

    // Handle different input types
    if (bundle) {
      // Extract clinical data from bundle
      clinicalData = extractClinicalData(bundle);

      if (clinicalData === "No clinical data available") {
        return res.status(400).json({
          error: "Invalid FHIR Bundle",
          message: "Bundle contains no extractable clinical data",
        });
      }
    } else if (patientData) {
      // Use provided patient data directly (for chat context)
      clinicalData = patientData;
    }

    let summary;
    let llmUsed = false;
    let provider = null;

    // Check if any LLM provider is available
    const hasProvider = await llmFactory.hasAvailableProvider();

    if (hasProvider) {
      try {
        // Generate appropriate prompt based on context
        const prompt = generatePrompt(context, clinicalData, query);
        const llmResult = await callLLM(prompt);
        summary = llmResult.response;
        provider = llmResult.provider;
        llmUsed = true;
        console.log("✅ LLM call successful, using AI-generated summary");
      } catch (llmError) {
        console.log(
          `LLM providers unavailable for ${context} context, using fallback:`,
          llmError.message,
        );

        // Fall back based on context
        if (context === CONTEXT_TYPES.CLINICAL_CHAT) {
          summary =
            "I apologize, but I'm currently unable to process your request due to a technical issue. Please try again in a moment, or rephrase your question.";
        } else {
          summary = generateFallbackSummary(clinicalData);
        }
      }
    } else {
      console.log(
        `No LLM providers available for ${context} context, using fallback`,
      );

      if (context === CONTEXT_TYPES.CLINICAL_CHAT) {
        summary =
          "The AI assistant is currently unavailable. Please contact your system administrator for assistance with clinical data analysis.";
      } else {
        summary = generateFallbackSummary(clinicalData);
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
    if (
      context === CONTEXT_TYPES.SUMMARY ||
      (clinicalData.conditions && clinicalData.observations)
    ) {
      response.stats = {
        conditions: clinicalData.conditions?.length || 0,
        observations: clinicalData.observations?.length || 0,
        medications: clinicalData.medications?.length || 0,
      };
    }

    // Add query echo for chat context
    if (context === CONTEXT_TYPES.CLINICAL_CHAT && query) {
      response.query = query;
    }

    res.json(response);
  } catch (error) {
    console.error("Summarization error:", error);
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
    const providersStatus = await llmFactory.getProvidersStatus();
    const hasAvailable = await llmFactory.hasAvailableProvider();

    res.json({
      llmAvailable: hasAvailable,
      ...providersStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Status check error:", error);
    res.json({
      llmAvailable: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
