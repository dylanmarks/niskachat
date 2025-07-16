/**
 * Client-side FHIR Bundle compression utilities
 * Compresses FHIR bundles before sending to backend to reduce payload size
 */

export interface CompressedFhirBundle {
  compressedData: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * Compress a FHIR Bundle on the client side before sending to backend
 * @param bundle - FHIR Bundle to compress
 * @returns Compressed bundle data
 */
export function compressFhirBundleClient(bundle: any): CompressedFhirBundle {
  if (!bundle || !bundle.entry || !Array.isArray(bundle.entry)) {
    const emptyResult = "Invalid or empty FHIR Bundle";
    return {
      compressedData: emptyResult,
      originalSize: 0,
      compressedSize: emptyResult.length,
      compressionRatio: 0
    };
  }

  const originalJson = JSON.stringify(bundle);
  const originalSize = new Blob([originalJson]).size;

  const resources = bundle.entry.map((entry: any) => entry.resource).filter(Boolean);
  const resourceGroups = groupResourcesByType(resources);

  // Compress each resource group
  const compressedParts: string[] = [];

  if (resourceGroups['Patient']) {
    compressedParts.push(compressPatient(resourceGroups['Patient'][0]));
  }

  if (resourceGroups['Condition']) {
    const compressed = compressConditions(resourceGroups['Condition']);
    if (compressed) compressedParts.push(compressed);
  }

  if (resourceGroups['MedicationRequest']) {
    const compressed = compressMedicationRequests(resourceGroups['MedicationRequest']);
    if (compressed) compressedParts.push(compressed);
  }

  if (resourceGroups['Observation']) {
    const compressed = compressObservations(resourceGroups['Observation']);
    if (compressed) compressedParts.push(compressed);
  }

  if (resourceGroups['AllergyIntolerance']) {
    const compressed = compressAllergyIntolerances(resourceGroups['AllergyIntolerance']);
    if (compressed) compressedParts.push(compressed);
  }

  if (resourceGroups['Immunization']) {
    const compressed = compressImmunizations(resourceGroups['Immunization']);
    if (compressed) compressedParts.push(compressed);
  }

  if (resourceGroups['Procedure']) {
    const compressed = compressProcedures(resourceGroups['Procedure']);
    if (compressed) compressedParts.push(compressed);
  }

  if (resourceGroups['DiagnosticReport']) {
    const compressed = compressDiagnosticReports(resourceGroups['DiagnosticReport']);
    if (compressed) compressedParts.push(compressed);
  }

  const compressedData = compressedParts.join("; ");
  const compressedSize = new Blob([compressedData]).size;
  const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 0;

  return {
    compressedData,
    originalSize,
    compressedSize,
    compressionRatio
  };
}

// Helper functions (duplicated from backend for client-side use)

function groupResourcesByType(resources: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};

  resources.forEach((resource) => {
    if (!resource.resourceType) return;

    if (!groups[resource.resourceType]) {
      groups[resource.resourceType] = [];
    }
    groups[resource.resourceType]?.push(resource);
  });

  return groups;
}

function compressPatient(patient: any): string {
  if (!patient) return "";

  const name = getPatientName(patient);
  const gender = patient?.gender ? patient.gender.charAt(0).toUpperCase() : "";
  const dob = patient?.birthDate ? patient.birthDate : "";

  let result = `Pt: ${name}`;
  if (gender) result += `, ${gender}`;
  if (dob) result += `, DOB ${dob}`;

  return result;
}

function getPatientName(patient: any): string {
  if (!patient?.name || !Array.isArray(patient.name) || patient.name.length === 0) {
    return "Unknown";
  }

  const name = patient.name[0];
  const given = name?.given ? name.given.join(" ") : "";
  const family = name?.family || "";

  return `${given} ${family}`.trim() || "Unknown";
}

function compressConditions(conditions: any[]): string {
  if (!conditions || conditions.length === 0) return "";

  const activeConditions = conditions.filter(
    (condition) =>
      condition?.clinicalStatus &&
      condition.clinicalStatus.coding &&
      condition.clinicalStatus.coding.some((coding: any) => coding?.code === "active")
  );

  if (activeConditions.length === 0) return "";

  const compressed = activeConditions
    .map((condition) => {
      const display = getCodeDisplay(condition.code);
      const onset = getOnsetDate(condition);
      return onset ? `${display} (${onset})` : display;
    })
    .join(", ");

  return `Dx: ${compressed}`;
}

function compressMedicationRequests(medications: any[]): string {
  if (!medications || medications.length === 0) return "";

  const activeRequests = medications.filter(
    (med) =>
      med.status === "active" ||
      (med.status === "unknown" && (!med.intent || med.intent === "order"))
  );

  if (activeRequests.length === 0) return "";

  const compressed = activeRequests
    .map((med) => {
      const name = getMedicationName(med);
      const dose = getDosage(med);
      return dose ? `${name} ${dose}` : name;
    })
    .join(", ");

  return `Rx: ${compressed}`;
}

function compressObservations(observations: any[]): string {
  if (!observations || observations.length === 0) return "";

  // Group by LOINC code or display
  const groupedObs: Record<string, any[]> = {};

  observations.forEach((obs) => {
    const key = getObservationKey(obs);
    if (!groupedObs[key]) {
      groupedObs[key] = [];
    }
    groupedObs[key].push(obs);
  });

  const compressed: string[] = [];

  Object.keys(groupedObs).forEach((key) => {
    // Sort by effective date (most recent first)
    const sortedObs = groupedObs[key]?.sort((a, b) => {
      const dateA = getObservationDate(a);
      const dateB = getObservationDate(b);
      return dateB.localeCompare(dateA);
    });

    // Take max 10 entries per type
    const limitedObs = sortedObs?.slice(0, 10) || [];

    // Deduplicate by same value/date combo
    const uniqueObs = deduplicateObservations(limitedObs);

    uniqueObs.forEach((obs) => {
      const display = getObservationDisplay(obs);
      const value = getObservationValue(obs);
      const date = getObservationDate(obs);

      if (value && date) {
        compressed.push(`${display} ${value} (${date})`);
      }
    });
  });

  return compressed.length > 0 ? `Labs: ${compressed.join(", ")}` : "";
}

function compressAllergyIntolerances(allergies: any[]): string {
  if (!allergies || allergies.length === 0) return "";

  const activeAllergies = allergies.filter(
    (allergy) =>
      !allergy.clinicalStatus ||
      (allergy.clinicalStatus.coding &&
        allergy.clinicalStatus.coding.some((coding: any) => coding.code === "active"))
  );

  if (activeAllergies.length === 0) return "";

  const compressed = activeAllergies
    .map((allergy) => {
      const substance = getAllergySubstance(allergy);
      const reaction = getAllergyReaction(allergy);
      return reaction ? `${substance} (${reaction})` : substance;
    })
    .join(", ");

  return `Allergies: ${compressed}`;
}

function compressImmunizations(immunizations: any[]): string {
  if (!immunizations || immunizations.length === 0) return "";

  const compressed = immunizations
    .map((imm) => {
      const vaccine = getVaccineName(imm);
      const date = getImmunizationDate(imm);
      return date ? `${vaccine} (${date})` : vaccine;
    })
    .join(", ");

  return `Vax: ${compressed}`;
}

function compressProcedures(procedures: any[]): string {
  if (!procedures || procedures.length === 0) return "";

  const compressed = procedures
    .map((proc) => {
      const name = getProcedureName(proc);
      const date = getProcedureDate(proc);
      return date ? `${name} (${date})` : name;
    })
    .join(", ");

  return `Proc: ${compressed}`;
}

function compressDiagnosticReports(reports: any[]): string {
  if (!reports || reports.length === 0) return "";

  const compressed = reports
    .map((report) => {
      const name = getReportName(report);
      const date = getReportDate(report);
      return date ? `${name} (${date})` : name;
    })
    .join(", ");

  return `Reports: ${compressed}`;
}

// Additional helper functions

function getCodeDisplay(code: any): string {
  if (!code) return "Unknown";

  if (code.text) return code.text;

  if (code.coding && code.coding.length > 0) {
    const coding = code.coding[0];
    return coding.display || coding.code || "Unknown";
  }

  return "Unknown";
}

function getOnsetDate(condition: any): string {
  if (condition.onsetDateTime) {
    return formatDate(condition.onsetDateTime);
  }
  if (condition.onsetPeriod && condition.onsetPeriod.start) {
    return formatDate(condition.onsetPeriod.start);
  }
  return "";
}

function getMedicationName(medRequest: any): string {
  if (medRequest.medicationCodeableConcept) {
    return getCodeDisplay(medRequest.medicationCodeableConcept);
  }
  if (medRequest.medicationReference && medRequest.medicationReference.display) {
    return medRequest.medicationReference.display;
  }
  return "Unknown Medication";
}

function getDosage(medRequest: any): string {
  if (!medRequest.dosageInstruction || medRequest.dosageInstruction.length === 0) {
    return "";
  }

  const dosage = medRequest.dosageInstruction[0];
  let result = "";

  if (dosage.doseAndRate && dosage.doseAndRate.length > 0) {
    const dose = dosage.doseAndRate[0];
    if (dose.doseQuantity) {
      result += `${dose.doseQuantity.value}${dose.doseQuantity.unit || dose.doseQuantity.code || "mg"}`;
    }
  }

  if (dosage.timing && dosage.timing.code) {
    const freq = getCodeDisplay(dosage.timing.code);
    if (freq !== "Unknown") {
      result += ` ${freq}`;
    }
  }

  return result;
}

function getObservationKey(obs: any): string {
  if (!obs.code) return "Unknown";

  if (obs.code.coding && obs.code.coding.length > 0) {
    const coding = obs.code.coding[0];
    return coding.code || coding.display || "Unknown";
  }

  return obs.code.text || "Unknown";
}

function getObservationDisplay(obs: any): string {
  if (!obs.code) return "Unknown";

  const display = getCodeDisplay(obs.code);

  // Common abbreviations
  const abbreviations: Record<string, string> = {
    "Hemoglobin A1c": "A1c",
    "Blood pressure": "BP",
    "Systolic blood pressure": "SBP",
    "Diastolic blood pressure": "DBP",
    "Low density lipoprotein": "LDL",
    "High density lipoprotein": "HDL",
    "Total cholesterol": "TC",
    "Triglycerides": "TG",
    "Glucose": "Glc",
    "Creatinine": "Cr",
    "Blood urea nitrogen": "BUN",
    "White blood cell count": "WBC",
    "Red blood cell count": "RBC",
    "Platelet count": "PLT",
    "Hemoglobin": "Hgb",
    "Hematocrit": "Hct",
  };

  return abbreviations[display] || display;
}

function getObservationValue(obs: any): string {
  if (obs.valueQuantity) {
    const unit = obs.valueQuantity.unit || obs.valueQuantity.code || "";
    return `${obs.valueQuantity.value}${unit}`;
  }

  if (obs.valueCodeableConcept) {
    return getCodeDisplay(obs.valueCodeableConcept);
  }

  if (obs.valueString) {
    return obs.valueString;
  }

  if (obs.component && obs.component.length > 0) {
    // Handle BP readings
    const systolic = obs.component.find(
      (c: any) =>
        c.code &&
        c.code.coding &&
        c.code.coding.some(
          (coding: any) =>
            coding.code === "8480-6" || coding.display?.includes("Systolic")
        )
    );
    const diastolic = obs.component.find(
      (c: any) =>
        c.code &&
        c.code.coding &&
        c.code.coding.some(
          (coding: any) =>
            coding.code === "8462-4" || coding.display?.includes("Diastolic")
        )
    );

    if (
      systolic &&
      diastolic &&
      systolic.valueQuantity &&
      diastolic.valueQuantity
    ) {
      return `${systolic.valueQuantity.value}/${diastolic.valueQuantity.value}`;
    }
  }

  return "";
}

function getObservationDate(obs: any): string {
  if (obs.effectiveDateTime) {
    return formatDate(obs.effectiveDateTime);
  }
  if (obs.effectivePeriod && obs.effectivePeriod.start) {
    return formatDate(obs.effectivePeriod.start);
  }
  return "";
}

function deduplicateObservations(observations: any[]): any[] {
  const seen = new Set<string>();
  return observations.filter((obs) => {
    const value = getObservationValue(obs);
    const date = getObservationDate(obs);
    const key = `${value}|${date}`;

    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getAllergySubstance(allergy: any): string {
  if (allergy.code) {
    return getCodeDisplay(allergy.code);
  }
  return "Unknown Allergen";
}

function getAllergyReaction(allergy: any): string {
  if (allergy.reaction && allergy.reaction.length > 0) {
    const reaction = allergy.reaction[0];
    if (reaction.manifestation && reaction.manifestation.length > 0) {
      return getCodeDisplay(reaction.manifestation[0]);
    }
  }
  return "";
}

function getVaccineName(immunization: any): string {
  if (immunization.vaccineCode) {
    return getCodeDisplay(immunization.vaccineCode);
  }
  return "Unknown Vaccine";
}

function getImmunizationDate(immunization: any): string {
  if (immunization.occurrenceDateTime) {
    return formatDate(immunization.occurrenceDateTime);
  }
  return "";
}

function getProcedureName(procedure: any): string {
  if (procedure.code) {
    return getCodeDisplay(procedure.code);
  }
  return "Unknown Procedure";
}

function getProcedureDate(procedure: any): string {
  if (procedure.performedDateTime) {
    return formatDate(procedure.performedDateTime);
  }
  if (procedure.performedPeriod && procedure.performedPeriod.start) {
    return formatDate(procedure.performedPeriod.start);
  }
  return "";
}

function getReportName(report: any): string {
  if (report.code) {
    return getCodeDisplay(report.code);
  }
  return "Unknown Report";
}

function getReportDate(report: any): string {
  if (report.effectiveDateTime) {
    return formatDate(report.effectiveDateTime);
  }
  if (report.effectivePeriod && report.effectivePeriod.start) {
    return formatDate(report.effectivePeriod.start);
  }
  return "";
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return "";

  try {
    const date = new Date(dateString);
    return date.toISOString().split("T")[0]; // YYYY-MM-DD format
  } catch {
    return ""; // Return empty string if parsing fails
  }
}