import express from "express";

const router = express.Router();

// LLM server configuration - optimized for MacBook Air
const LLM_CONFIG = {
  url: process.env.LLM_URL || "http://127.0.0.1:8081",
  timeout: parseInt(process.env.LLM_TIMEOUT) || 15000, // Reduced timeout for MacBook Air
  maxTokens: parseInt(process.env.LLM_MAX_TOKENS) || 300, // Reduced tokens for lighter models
  temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.3,
  enabled: process.env.LLM_ENABLED !== "false", // Allow disabling LLM for MacBook Air
};

// Medical summarization prompt template
const MEDICAL_SUMMARY_PROMPT = `You are a clinical AI assistant. Please provide a brief 3-sentence clinical summary of the following FHIR patient data. Include the patient's basic demographics, primary active conditions, and current medications in a concise, professional format suitable for quick clinical review.

FHIR Data:
{fhirData}

Clinical Summary:`;

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
 * Call local LLM for summarization
 */
async function callLLM(prompt) {
  try {
    const response = await fetch(`${LLM_CONFIG.url}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "biomistral",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: LLM_CONFIG.maxTokens,
        temperature: LLM_CONFIG.temperature,
        stream: false,
      }),
      signal: AbortSignal.timeout(LLM_CONFIG.timeout),
    });

    if (!response.ok) {
      throw new Error(
        `LLM API error: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || "No summary generated";
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
 * POST /summarize - Generate clinical summary from FHIR Bundle
 */
router.post("/", async (req, res) => {
  try {
    const { bundle } = req.body;

    if (!bundle) {
      return res.status(400).json({
        error: "Missing FHIR Bundle data",
        message: "Please provide a FHIR Bundle in the request body",
      });
    }

    // Extract clinical data from bundle
    const clinicalData = extractClinicalData(bundle);

    if (clinicalData === "No clinical data available") {
      return res.status(400).json({
        error: "Invalid FHIR Bundle",
        message: "Bundle contains no extractable clinical data",
      });
    }

    // Format data for LLM
    const formattedData = formatClinicalData(clinicalData);

    let summary;
    let llmUsed = false;

    // Only attempt LLM if enabled and we have the service
    if (LLM_CONFIG.enabled) {
      console.log(
        `🤖 LLM is enabled, attempting to call LLM at ${LLM_CONFIG.url}`,
      );
      try {
        // Attempt to use LLM for summarization
        const prompt = MEDICAL_SUMMARY_PROMPT.replace(
          "{fhirData}",
          formattedData,
        );
        console.log(
          `📝 Calling LLM with prompt length: ${prompt.length} characters`,
        );
        summary = await callLLM(prompt);
        llmUsed = true;
        console.log("✅ LLM call successful, using AI-generated summary");
      } catch (llmError) {
        console.log(
          "❌ LLM unavailable, using concise fallback summary:",
          llmError.message,
        );
        // Fall back to concise summary
        summary = generateFallbackSummary(clinicalData);
        console.log(
          `📄 Generated fallback summary: "${summary.substring(0, 100)}..."`,
        );
      }
    } else {
      console.log("🚫 LLM disabled, using concise fallback summary");
      summary = generateFallbackSummary(clinicalData);
      console.log(
        `📄 Generated fallback summary: "${summary.substring(0, 100)}..."`,
      );
    }

    res.json({
      success: true,
      summary,
      llmUsed,
      warning: !llmUsed
        ? "AI summarization unavailable - using structured fallback"
        : null,
      stats: {
        conditions: clinicalData.conditions.length,
        observations: clinicalData.observations.length,
        medications: clinicalData.medications.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Summarization error:", error);
    res.status(500).json({
      error: "Summarization failed",
      message: error.message,
    });
  }
});

/**
 * GET /status - Check LLM server status
 */
router.get("/status", async (req, res) => {
  try {
    const response = await fetch(`${LLM_CONFIG.url}/v1/models`, {
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const models = await response.json();
      res.json({
        llmAvailable: true,
        url: LLM_CONFIG.url,
        models: models.data || [],
      });
    } else {
      res.json({
        llmAvailable: false,
        error: `LLM server responded with ${response.status}`,
      });
    }
  } catch (error) {
    res.json({
      llmAvailable: false,
      error: error.message,
    });
  }
});

export default router;
