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
const MEDICAL_SUMMARY_PROMPT = `You are a clinical AI assistant. Please provide a concise clinical summary of the following FHIR patient data. Focus on:

1. **Patient Demographics**: Age, gender, key identifiers
2. **Active Conditions**: Current diagnosed conditions with dates
3. **Recent Observations**: Key vital signs, lab results, diagnostic findings
4. **Current Medications**: Active prescriptions with dosages
5. **Clinical Highlights**: Most important medical information for provider review

Keep the summary professional, clinical, and under 300 words. Use medical terminology appropriately.

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
 * Generate enhanced fallback summary without LLM
 */
function generateFallbackSummary(data) {
  let summary = "**Clinical Summary**\n\n";

  // Patient demographics with age calculation
  if (data.patient) {
    const patient = data.patient;
    const name = patient.name?.[0];
    const nameStr = name ? `${name.given?.[0]} ${name.family}` : "Patient";

    let age = "Unknown";
    if (patient.birthDate) {
      const birthDate = new Date(patient.birthDate);
      const today = new Date();
      const ageYears = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age = (ageYears - 1).toString();
      } else {
        age = ageYears.toString();
      }
    }

    const gender = patient.gender || "Unknown";
    const mrn =
      patient.identifier?.find((id) => id.type?.coding?.[0]?.code === "MR")
        ?.value || "Not specified";

    summary += `**Patient**: ${nameStr}\n`;
    summary += `**Age**: ${age} years\n`;
    summary += `**Gender**: ${gender}\n`;
    summary += `**MRN**: ${mrn}\n\n`;
  }

  // Active conditions with clinical details
  if (data.conditions.length > 0) {
    summary += `**Active Conditions** (${data.conditions.length}):\n`;
    data.conditions.slice(0, 8).forEach((condition, index) => {
      const code = condition.code?.coding?.[0];
      const display = code?.display || "Unspecified condition";
      const codeSystem = code?.system?.includes("snomed")
        ? "SNOMED"
        : code?.system?.includes("icd")
          ? "ICD"
          : "Unknown";
      const onset =
        condition.onsetDateTime || condition.recordedDate || "Unknown date";
      const verificationStatus =
        condition.verificationStatus?.coding?.[0]?.code || "confirmed";

      summary += `${index + 1}. **${display}**\n`;
      summary += `   - Code: ${code?.code || "N/A"} (${codeSystem})\n`;
      summary += `   - Onset: ${onset}\n`;
      summary += `   - Status: ${verificationStatus}\n`;
    });
    summary += "\n";
  }

  // Recent observations with clinical interpretation
  if (data.observations.length > 0) {
    summary += `**Recent Observations** (${data.observations.length}):\n`;
    data.observations.slice(0, 8).forEach((obs, index) => {
      const code = obs.code?.coding?.[0];
      const display = code?.display || "Unknown observation";
      const value = obs.valueQuantity?.value || obs.valueString || "No value";
      const unit = obs.valueQuantity?.unit || "";
      const date = obs.effectiveDateTime || obs.issued || "Unknown date";

      // Add clinical interpretation for common values
      let interpretation = "";
      if (
        display.toLowerCase().includes("blood pressure") &&
        obs.valueQuantity?.value
      ) {
        if (obs.valueQuantity.value > 140) interpretation = " (High)";
        else if (obs.valueQuantity.value < 90) interpretation = " (Low)";
        else interpretation = " (Normal)";
      }

      summary += `${index + 1}. **${display}**: ${value} ${unit}${interpretation}\n`;
      summary += `   - Date: ${date}\n`;
      if (code?.code)
        summary += `   - Code: ${code.code} (${code.system?.includes("loinc") ? "LOINC" : "Other"})\n`;
    });
    summary += "\n";
  }

  // Current medications with dosage
  if (data.medications.length > 0) {
    summary += `**Current Medications** (${data.medications.length}):\n`;
    data.medications.slice(0, 8).forEach((med, index) => {
      const medication = med.medicationCodeableConcept?.coding?.[0];
      const display = medication?.display || "Unknown medication";
      const dosage = med.dosageInstruction?.[0]?.text || "Dosage not specified";
      const frequency =
        med.dosageInstruction?.[0]?.timing?.repeat?.frequency || "";
      const prescriber = med.requester?.display || "Unknown prescriber";

      summary += `${index + 1}. **${display}**\n`;
      summary += `   - Dosage: ${dosage}\n`;
      if (frequency) summary += `   - Frequency: ${frequency}\n`;
      summary += `   - Prescriber: ${prescriber}\n`;
    });
    summary += "\n";
  }

  // Clinical notes
  summary += "**Clinical Notes**:\n";
  if (data.conditions.length > 0) {
    summary += `• Patient has ${data.conditions.length} active condition${data.conditions.length > 1 ? "s" : ""}\n`;
  }
  if (data.observations.length > 0) {
    summary += `• ${data.observations.length} observation${data.observations.length > 1 ? "s" : ""} recorded\n`;
  }
  if (data.medications.length > 0) {
    summary += `• Currently on ${data.medications.length} active medication${data.medications.length > 1 ? "s" : ""}\n`;
  }

  summary +=
    "\n*Note: This is a structured summary generated from FHIR data. For AI-powered clinical insights, ensure the LLM service is available.*";

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
      try {
        // Attempt to use LLM for summarization
        const prompt = MEDICAL_SUMMARY_PROMPT.replace(
          "{fhirData}",
          formattedData,
        );
        summary = await callLLM(prompt);
        llmUsed = true;
      } catch (llmError) {
        console.log(
          "LLM unavailable, using enhanced fallback summary:",
          llmError.message,
        );
        // Fall back to enhanced summary
        summary = generateFallbackSummary(clinicalData);
      }
    } else {
      console.log("LLM disabled, using enhanced fallback summary");
      summary = generateFallbackSummary(clinicalData);
    }

    res.json({
      success: true,
      summary,
      llmUsed,
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
