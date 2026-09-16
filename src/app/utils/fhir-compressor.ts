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

// FHIR Resource interfaces for compression
interface FhirResource {
  resourceType: string;
  id?: string;
}

interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

interface FhirHumanName {
  family?: string;
  given?: string[];
  use?: string;
}

interface FhirQuantity {
  value?: number;
  unit?: string;
  code?: string;
}

interface FhirPeriod {
  start?: string;
  end?: string;
}

interface FhirReference {
  reference?: string;
  display?: string;
}

interface FhirPatient extends FhirResource {
  resourceType: 'Patient';
  name?: FhirHumanName[];
  birthDate?: string;
  gender?: string;
}

interface FhirCondition extends FhirResource {
  resourceType: 'Condition';
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  code?: FhirCodeableConcept;
  onsetDateTime?: string;
  onsetPeriod?: FhirPeriod;
  onsetAge?: { value?: number; unit?: string };
}

interface FhirMedicationRequest extends FhirResource {
  resourceType: 'MedicationRequest';
  status?: string;
  intent?: string;
  medicationCodeableConcept?: FhirCodeableConcept;
  medicationReference?: FhirReference;
  dosageInstruction?: FhirDosage[];
}

interface FhirDosage {
  text?: string;
  timing?: { code?: FhirCodeableConcept };
  doseAndRate?: FhirDoseAndRate[];
}

interface FhirDoseAndRate {
  doseQuantity?: FhirQuantity;
}

interface FhirObservation extends FhirResource {
  resourceType: 'Observation';
  status?: string;
  code?: FhirCodeableConcept;
  effectiveDateTime?: string;
  effectivePeriod?: FhirPeriod;
  valueQuantity?: FhirQuantity;
  valueString?: string;
  valueCodeableConcept?: FhirCodeableConcept;
  component?: FhirObservationComponent[];
}

interface FhirObservationComponent {
  code?: FhirCodeableConcept;
  valueQuantity?: FhirQuantity;
}

interface FhirAllergyIntolerance extends FhirResource {
  resourceType: 'AllergyIntolerance';
  clinicalStatus?: FhirCodeableConcept;
  code?: FhirCodeableConcept;
  reaction?: FhirAllergyIntoleranceReaction[];
}

interface FhirAllergyIntoleranceReaction {
  manifestation?: FhirCodeableConcept[];
}

interface FhirImmunization extends FhirResource {
  resourceType: 'Immunization';
  vaccineCode?: FhirCodeableConcept;
  occurrenceDateTime?: string;
}

interface FhirProcedure extends FhirResource {
  resourceType: 'Procedure';
  code?: FhirCodeableConcept;
  performedDateTime?: string;
  performedPeriod?: FhirPeriod;
}

interface FhirDiagnosticReport extends FhirResource {
  resourceType: 'DiagnosticReport';
  code?: FhirCodeableConcept;
  effectiveDateTime?: string;
  effectivePeriod?: FhirPeriod;
}

interface FhirBundleEntry {
  resource?: FhirResource;
  fullUrl?: string;
}

/**
 * Compress a FHIR Bundle on the client side before sending to backend
 * @param bundle - FHIR Bundle to compress
 * @returns Compressed bundle data
 */
export function compressFhirBundleClient(
  bundle: unknown,
): CompressedFhirBundle {
  // Type guard to ensure we have a valid bundle
  if (!bundle || typeof bundle !== 'object' || bundle === null) {
    const emptyResult = 'Invalid or empty FHIR Bundle';
    return {
      compressedData: emptyResult,
      originalSize: 0,
      compressedSize: emptyResult.length,
      compressionRatio: 0,
    };
  }

  const bundleObj = bundle as { entry?: FhirBundleEntry[] };

  if (!bundleObj.entry || !Array.isArray(bundleObj.entry)) {
    const emptyResult = 'Invalid or empty FHIR Bundle';
    return {
      compressedData: emptyResult,
      originalSize: 0,
      compressedSize: emptyResult.length,
      compressionRatio: 0,
    };
  }

  const originalJson = JSON.stringify(bundle);
  const originalSize = new Blob([originalJson]).size;

  const resources = bundleObj.entry
    .map((entry) => entry.resource)
    .filter((resource): resource is FhirResource => Boolean(resource));
  const resourceGroups = groupResourcesByType(resources);

  // Compress each resource group
  const compressedParts: string[] = [];

  if (resourceGroups['Patient']?.[0]) {
    compressedParts.push(compressPatient(resourceGroups['Patient'][0]));
  }

  if (resourceGroups['Condition']) {
    const compressed = compressConditions(resourceGroups['Condition']);
    if (compressed) compressedParts.push(compressed);
  }

  if (resourceGroups['MedicationRequest']) {
    const compressed = compressMedicationRequests(
      resourceGroups['MedicationRequest'],
    );
    if (compressed) compressedParts.push(compressed);
  }

  if (resourceGroups['Observation']) {
    const compressed = compressObservations(resourceGroups['Observation']);
    if (compressed) compressedParts.push(compressed);
  }

  if (resourceGroups['AllergyIntolerance']) {
    const compressed = compressAllergyIntolerances(
      resourceGroups['AllergyIntolerance'],
    );
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
    const compressed = compressDiagnosticReports(
      resourceGroups['DiagnosticReport'],
    );
    if (compressed) compressedParts.push(compressed);
  }

  const compressedData = compressedParts.join('; ');
  const compressedSize = new Blob([compressedData]).size;
  const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 0;

  return {
    compressedData,
    originalSize,
    compressedSize,
    compressionRatio,
  };
}

// Helper functions (duplicated from backend for client-side use)

function groupResourcesByType(
  resources: FhirResource[],
): Record<string, FhirResource[]> {
  const groups: Record<string, FhirResource[]> = {};

  resources.forEach((resource) => {
    if (!resource.resourceType) return;

    if (!groups[resource.resourceType]) {
      groups[resource.resourceType] = [];
    }
    groups[resource.resourceType]?.push(resource);
  });

  return groups;
}

function compressPatient(patient: FhirResource): string {
  if (!patient || patient.resourceType !== 'Patient') return '';

  const patientResource = patient as FhirPatient;
  const name = getPatientName(patientResource);
  const gender = patientResource.gender
    ? patientResource.gender.charAt(0).toUpperCase()
    : '';
  const dob = patientResource.birthDate ? patientResource.birthDate : '';

  let result = `Pt: ${name}`;
  if (gender) result += `, ${gender}`;
  if (dob) result += `, DOB ${dob}`;

  return result;
}

function getPatientName(patient: FhirPatient): string {
  if (
    !patient.name ||
    !Array.isArray(patient.name) ||
    patient.name.length === 0
  ) {
    return 'Unknown';
  }

  const name = patient.name[0];
  const given = name?.given ? name.given.join(' ') : '';
  const family = name?.family || '';

  return `${given} ${family}`.trim() || 'Unknown';
}

function compressConditions(conditions: FhirResource[]): string {
  if (!conditions || conditions.length === 0) return '';

  const conditionResources = conditions.filter(
    (res): res is FhirCondition => res.resourceType === 'Condition',
  );

  const activeConditions = conditionResources.filter((condition) =>
    condition.clinicalStatus?.coding?.some(
      (coding) => coding.code === 'active',
    ),
  );

  if (activeConditions.length === 0) return '';

  const compressed = activeConditions
    .map((condition) => {
      const display = getCodeDisplay(condition.code);
      const onset = getOnsetDate(condition);
      return onset ? `${display} (${onset})` : display;
    })
    .join(', ');

  return `Dx: ${compressed}`;
}

function compressMedicationRequests(medications: FhirResource[]): string {
  if (!medications || medications.length === 0) return '';

  const medicationResources = medications.filter(
    (res): res is FhirMedicationRequest =>
      res.resourceType === 'MedicationRequest',
  );

  const activeRequests = medicationResources.filter(
    (med) =>
      med.status === 'active' ||
      (med.status === 'unknown' && (!med.intent || med.intent === 'order')),
  );

  if (activeRequests.length === 0) return '';

  const compressed = activeRequests
    .map((med) => {
      const name = getMedicationName(med);
      const dose = getDosage(med);
      return dose ? `${name} ${dose}` : name;
    })
    .join(', ');

  return `Rx: ${compressed}`;
}

function compressObservations(observations: FhirResource[]): string {
  if (!observations || observations.length === 0) return '';

  const observationResources = observations.filter(
    (res): res is FhirObservation => res.resourceType === 'Observation',
  );

  // Group by LOINC code or display
  const groupedObs: Record<string, FhirObservation[]> = {};

  observationResources.forEach((obs) => {
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

  return compressed.length > 0 ? `Labs: ${compressed.join(', ')}` : '';
}

function compressAllergyIntolerances(allergies: FhirResource[]): string {
  if (!allergies || allergies.length === 0) return '';

  const allergyResources = allergies.filter(
    (res): res is FhirAllergyIntolerance =>
      res.resourceType === 'AllergyIntolerance',
  );

  const activeAllergies = allergyResources.filter(
    (allergy) =>
      !allergy.clinicalStatus ||
      allergy.clinicalStatus.coding?.some((coding) => coding.code === 'active'),
  );

  if (activeAllergies.length === 0) return '';

  const compressed = activeAllergies
    .map((allergy) => {
      const substance = getAllergySubstance(allergy);
      const reaction = getAllergyReaction(allergy);
      return reaction ? `${substance} (${reaction})` : substance;
    })
    .join(', ');

  return `Allergies: ${compressed}`;
}

function compressImmunizations(immunizations: FhirResource[]): string {
  if (!immunizations || immunizations.length === 0) return '';

  const immunizationResources = immunizations.filter(
    (res): res is FhirImmunization => res.resourceType === 'Immunization',
  );

  const compressed = immunizationResources
    .map((imm) => {
      const vaccine = getVaccineName(imm);
      const date = getImmunizationDate(imm);
      return date ? `${vaccine} (${date})` : vaccine;
    })
    .join(', ');

  return `Vax: ${compressed}`;
}

function compressProcedures(procedures: FhirResource[]): string {
  if (!procedures || procedures.length === 0) return '';

  const procedureResources = procedures.filter(
    (res): res is FhirProcedure => res.resourceType === 'Procedure',
  );

  const compressed = procedureResources
    .map((proc) => {
      const name = getProcedureName(proc);
      const date = getProcedureDate(proc);
      return date ? `${name} (${date})` : name;
    })
    .join(', ');

  return `Proc: ${compressed}`;
}

function compressDiagnosticReports(reports: FhirResource[]): string {
  if (!reports || reports.length === 0) return '';

  const reportResources = reports.filter(
    (res): res is FhirDiagnosticReport =>
      res.resourceType === 'DiagnosticReport',
  );

  const compressed = reportResources
    .map((report) => {
      const name = getReportName(report);
      const date = getReportDate(report);
      return date ? `${name} (${date})` : name;
    })
    .join(', ');

  return `Reports: ${compressed}`;
}

// Additional helper functions

function getCodeDisplay(code: FhirCodeableConcept | undefined): string {
  if (!code) return 'Unknown';

  if (code.text) return code.text;

  if (code.coding && code.coding.length > 0) {
    const coding = code.coding[0];
    return coding?.display || coding?.code || 'Unknown';
  }

  return 'Unknown';
}

function getOnsetDate(condition: FhirCondition): string {
  if (condition.onsetDateTime) {
    return formatDate(condition.onsetDateTime);
  }
  if (condition.onsetPeriod?.start) {
    return formatDate(condition.onsetPeriod.start);
  }
  return '';
}

function getMedicationName(medRequest: FhirMedicationRequest): string {
  if (medRequest.medicationCodeableConcept) {
    return getCodeDisplay(medRequest.medicationCodeableConcept);
  }
  if (medRequest.medicationReference?.display) {
    return medRequest.medicationReference.display;
  }
  return 'Unknown Medication';
}

function getDosage(medRequest: FhirMedicationRequest): string {
  if (
    !medRequest.dosageInstruction ||
    medRequest.dosageInstruction.length === 0
  ) {
    return '';
  }

  const dosage = medRequest.dosageInstruction[0];
  let result = '';

  if (dosage?.doseAndRate && dosage.doseAndRate.length > 0) {
    const dose = dosage.doseAndRate[0];
    if (dose?.doseQuantity) {
      result += `${dose.doseQuantity.value}${dose.doseQuantity.unit || dose.doseQuantity.code || 'mg'}`;
    }
  }

  if (dosage?.timing?.code) {
    const freq = getCodeDisplay(dosage.timing.code);
    if (freq !== 'Unknown') {
      result += ` ${freq}`;
    }
  }

  return result;
}

function getObservationKey(obs: FhirObservation): string {
  if (!obs.code) return 'Unknown';

  if (obs.code.coding && obs.code.coding.length > 0) {
    const coding = obs.code.coding[0];
    return coding?.code || coding?.display || 'Unknown';
  }

  return obs.code.text || 'Unknown';
}

function getObservationDisplay(obs: FhirObservation): string {
  if (!obs.code) return 'Unknown';

  const display = getCodeDisplay(obs.code);

  // Common abbreviations
  const abbreviations: Record<string, string> = {
    'Hemoglobin A1c': 'A1c',
    'Blood pressure': 'BP',
    'Systolic blood pressure': 'SBP',
    'Diastolic blood pressure': 'DBP',
    'Low density lipoprotein': 'LDL',
    'High density lipoprotein': 'HDL',
    'Total cholesterol': 'TC',
    Triglycerides: 'TG',
    Glucose: 'Glc',
    Creatinine: 'Cr',
    'Blood urea nitrogen': 'BUN',
    'White blood cell count': 'WBC',
    'Red blood cell count': 'RBC',
    'Platelet count': 'PLT',
    Hemoglobin: 'Hgb',
    Hematocrit: 'Hct',
  };

  return abbreviations[display] || display;
}

function getObservationValue(obs: FhirObservation): string {
  if (obs.valueQuantity) {
    const unit = obs.valueQuantity.unit || obs.valueQuantity.code || '';
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
    const systolic = obs.component.find((c) =>
      c.code?.coding?.some(
        (coding) =>
          coding.code === '8480-6' || coding.display?.includes('Systolic'),
      ),
    );
    const diastolic = obs.component.find((c) =>
      c.code?.coding?.some(
        (coding) =>
          coding.code === '8462-4' || coding.display?.includes('Diastolic'),
      ),
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

  return '';
}

function getObservationDate(obs: FhirObservation): string {
  if (obs.effectiveDateTime) {
    return formatDate(obs.effectiveDateTime);
  }
  if (obs.effectivePeriod?.start) {
    return formatDate(obs.effectivePeriod.start);
  }
  return '';
}

function deduplicateObservations(
  observations: FhirObservation[],
): FhirObservation[] {
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

function getAllergySubstance(allergy: FhirAllergyIntolerance): string {
  if (allergy.code) {
    return getCodeDisplay(allergy.code);
  }
  return 'Unknown Allergen';
}

function getAllergyReaction(allergy: FhirAllergyIntolerance): string {
  if (allergy.reaction && allergy.reaction.length > 0) {
    const reaction = allergy.reaction[0];
    if (reaction?.manifestation && reaction.manifestation.length > 0) {
      return getCodeDisplay(reaction.manifestation[0]);
    }
  }
  return '';
}

function getVaccineName(immunization: FhirImmunization): string {
  if (immunization.vaccineCode) {
    return getCodeDisplay(immunization.vaccineCode);
  }
  return 'Unknown Vaccine';
}

function getImmunizationDate(immunization: FhirImmunization): string {
  if (immunization.occurrenceDateTime) {
    return formatDate(immunization.occurrenceDateTime);
  }
  return '';
}

function getProcedureName(procedure: FhirProcedure): string {
  if (procedure.code) {
    return getCodeDisplay(procedure.code);
  }
  return 'Unknown Procedure';
}

function getProcedureDate(procedure: FhirProcedure): string {
  if (procedure.performedDateTime) {
    return formatDate(procedure.performedDateTime);
  }
  if (procedure.performedPeriod?.start) {
    return formatDate(procedure.performedPeriod.start);
  }
  return '';
}

function getReportName(report: FhirDiagnosticReport): string {
  if (report.code) {
    return getCodeDisplay(report.code);
  }
  return 'Unknown Report';
}

function getReportDate(report: FhirDiagnosticReport): string {
  if (report.effectiveDateTime) {
    return formatDate(report.effectiveDateTime);
  }
  if (report.effectivePeriod?.start) {
    return formatDate(report.effectivePeriod.start);
  }
  return '';
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0] || ''; // YYYY-MM-DD format
  } catch {
    return ''; // Return empty string if parsing fails
  }
}
