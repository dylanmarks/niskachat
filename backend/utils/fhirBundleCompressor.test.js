import { compressFHIRBundle } from "./fhirBundleCompressor.js";

describe("FHIR Bundle Compressor", () => {
  // Test case 1: Bundle with >20 observations per type returns max 10
  test("should limit observations to maximum 10 per type", () => {
    const bundle = {
      resourceType: "Bundle",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            name: [{ given: ["John"], family: "Doe" }],
            gender: "male",
            birthDate: "1990-01-01",
          },
        },
        // Create 25 A1c observations
        ...Array.from({ length: 25 }, (_, i) => ({
          resource: {
            resourceType: "Observation",
            code: {
              coding: [
                {
                  code: "4548-4",
                  display: "Hemoglobin A1c",
                },
              ],
            },
            valueQuantity: {
              value: 7.5 + i * 0.1,
              unit: "%",
            },
            effectiveDateTime: `2024-${String(i + 1).padStart(2, "0")}-01`,
          },
        })),
      ],
    };

    const result = compressFHIRBundle(bundle);

    // Should only contain 10 A1c values (max per type)
    const a1cMatches = result.match(/A1c \d+(?:\.\d+)?%/g);
    expect(a1cMatches).toHaveLength(10);

    // Should be most recent first
    expect(result).toContain("A1c 9.9%");
    expect(result).toContain("A1c 9%");
    expect(result).not.toContain("A1c 7.5%"); // Should exclude oldest
  });

  // Test case 2: Only active Condition and MedicationRequest included
  test("should only include active conditions and medications", () => {
    const bundle = {
      resourceType: "Bundle",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            name: [{ given: ["Jane"], family: "Smith" }],
            gender: "female",
            birthDate: "1985-05-15",
          },
        },
        {
          resource: {
            resourceType: "Condition",
            code: {
              coding: [
                {
                  code: "E11",
                  display: "Type 2 diabetes mellitus",
                },
              ],
            },
            clinicalStatus: {
              coding: [
                {
                  code: "active",
                },
              ],
            },
            onsetDateTime: "2010-01-01",
          },
        },
        {
          resource: {
            resourceType: "Condition",
            code: {
              coding: [
                {
                  code: "I10",
                  display: "Essential hypertension",
                },
              ],
            },
            clinicalStatus: {
              coding: [
                {
                  code: "inactive",
                },
              ],
            },
            onsetDateTime: "2015-01-01",
          },
        },
        {
          resource: {
            resourceType: "MedicationRequest",
            medicationCodeableConcept: {
              coding: [
                {
                  display: "Metformin",
                },
              ],
            },
            status: "active",
            dosageInstruction: [
              {
                doseAndRate: [
                  {
                    doseQuantity: {
                      value: 500,
                      unit: "mg",
                    },
                  },
                ],
              },
            ],
          },
        },
        {
          resource: {
            resourceType: "MedicationRequest",
            medicationCodeableConcept: {
              coding: [
                {
                  display: "Lisinopril",
                },
              ],
            },
            status: "stopped",
            dosageInstruction: [
              {
                doseAndRate: [
                  {
                    doseQuantity: {
                      value: 10,
                      unit: "mg",
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    const result = compressFHIRBundle(bundle);

    // Should include active diabetes
    expect(result).toContain("Dx: Type 2 diabetes mellitus");
    expect(result).not.toContain("Essential hypertension");

    // Should include active medication
    expect(result).toContain("Rx: Metformin");
    expect(result).not.toContain("Lisinopril");
  });

  // Test case 3: Handles missing or malformed fields gracefully
  test("should handle missing or malformed fields gracefully", () => {
    const bundle = {
      resourceType: "Bundle",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            // Missing name
            gender: "male",
            birthDate: "1990-01-01",
          },
        },
        {
          resource: {
            resourceType: "Condition",
            // Missing code
            clinicalStatus: {
              coding: [
                {
                  code: "active",
                },
              ],
            },
          },
        },
        {
          resource: {
            resourceType: "Observation",
            code: {
              coding: [
                {
                  code: "4548-4",
                  display: "Hemoglobin A1c",
                },
              ],
            },
            // Missing value
            effectiveDateTime: "2024-01-01",
          },
        },
        {
          resource: {
            resourceType: "MedicationRequest",
            // Missing medication info
            status: "active",
          },
        },
      ],
    };

    const result = compressFHIRBundle(bundle);

    // Should not throw errors and should handle gracefully
    expect(result).toBeTruthy();
    expect(result).toContain("Pt: Unknown");
    expect(result).toContain("Dx: Unknown");
    expect(result).toContain("Rx: Unknown Medication");
  });

  // Test case 4: Compressed output preserves all clinical meaning
  test("should preserve all clinical meaning in compressed output", () => {
    const bundle = {
      resourceType: "Bundle",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            name: [{ given: ["Alice"], family: "Johnson" }],
            gender: "female",
            birthDate: "1975-03-20",
            identifier: [
              {
                type: {
                  coding: [
                    {
                      code: "MR",
                      display: "Medical record number",
                    },
                  ],
                },
                value: "123456",
              },
            ],
          },
        },
        {
          resource: {
            resourceType: "Condition",
            code: {
              coding: [
                {
                  code: "E11",
                  display: "Type 2 diabetes mellitus",
                },
              ],
            },
            clinicalStatus: {
              coding: [
                {
                  code: "active",
                },
              ],
            },
            onsetDateTime: "2010-05-15",
          },
        },
        {
          resource: {
            resourceType: "MedicationRequest",
            medicationCodeableConcept: {
              coding: [
                {
                  display: "Metformin",
                },
              ],
            },
            status: "active",
            dosageInstruction: [
              {
                doseAndRate: [
                  {
                    doseQuantity: {
                      value: 500,
                      unit: "mg",
                    },
                  },
                ],
                timing: {
                  code: {
                    coding: [
                      {
                        code: "BID",
                        display: "BID",
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
        {
          resource: {
            resourceType: "Observation",
            code: {
              coding: [
                {
                  code: "4548-4",
                  display: "Hemoglobin A1c",
                },
              ],
            },
            valueQuantity: {
              value: 8.2,
              unit: "%",
            },
            effectiveDateTime: "2024-06-01",
          },
        },
        {
          resource: {
            resourceType: "AllergyIntolerance",
            code: {
              coding: [
                {
                  display: "Penicillin",
                },
              ],
            },
            reaction: [
              {
                manifestation: [
                  {
                    coding: [
                      {
                        display: "Skin rash",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    const result = compressFHIRBundle(bundle);

    // Should contain all key clinical information
    expect(result).toContain("Pt: Alice Johnson, F, DOB 1975-03-20");
    expect(result).toContain("Dx: Type 2 diabetes mellitus (2010-05-15)");
    expect(result).toContain("Rx: Metformin 500mg BID");
    expect(result).toContain("Labs: A1c 8.2% (2024-06-01)");
    expect(result).toContain("Allergies: Penicillin (Skin rash)");
  });

  // Test case 5: Output is readable and <500 tokens for standard bundle
  test("should produce readable output under 500 tokens for standard bundle", () => {
    const standardBundle = {
      resourceType: "Bundle",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            name: [{ given: ["John"], family: "Doe" }],
            gender: "male",
            birthDate: "1970-01-01",
          },
        },
        {
          resource: {
            resourceType: "Condition",
            code: {
              coding: [
                {
                  display: "Type 2 diabetes mellitus",
                },
              ],
            },
            clinicalStatus: {
              coding: [
                {
                  code: "active",
                },
              ],
            },
            onsetDateTime: "2010-01-01",
          },
        },
        {
          resource: {
            resourceType: "Condition",
            code: {
              coding: [
                {
                  display: "Essential hypertension",
                },
              ],
            },
            clinicalStatus: {
              coding: [
                {
                  code: "active",
                },
              ],
            },
            onsetDateTime: "2015-01-01",
          },
        },
        {
          resource: {
            resourceType: "MedicationRequest",
            medicationCodeableConcept: {
              coding: [
                {
                  display: "Metformin",
                },
              ],
            },
            status: "active",
            dosageInstruction: [
              {
                doseAndRate: [
                  {
                    doseQuantity: {
                      value: 500,
                      unit: "mg",
                    },
                  },
                ],
              },
            ],
          },
        },
        {
          resource: {
            resourceType: "MedicationRequest",
            medicationCodeableConcept: {
              coding: [
                {
                  display: "Lisinopril",
                },
              ],
            },
            status: "active",
            dosageInstruction: [
              {
                doseAndRate: [
                  {
                    doseQuantity: {
                      value: 10,
                      unit: "mg",
                    },
                  },
                ],
              },
            ],
          },
        },
        {
          resource: {
            resourceType: "Observation",
            code: {
              coding: [
                {
                  code: "4548-4",
                  display: "Hemoglobin A1c",
                },
              ],
            },
            valueQuantity: {
              value: 8.2,
              unit: "%",
            },
            effectiveDateTime: "2024-06-01",
          },
        },
        {
          resource: {
            resourceType: "Observation",
            code: {
              coding: [
                {
                  code: "13457-7",
                  display: "Cholesterol in LDL",
                },
              ],
            },
            valueQuantity: {
              value: 130,
              unit: "mg/dL",
            },
            effectiveDateTime: "2024-04-15",
          },
        },
      ],
    };

    const result = compressFHIRBundle(standardBundle);

    // Should be readable and comprehensive
    expect(result).toMatch(/^Pt: .+/);
    expect(result).toContain("Dx:");
    expect(result).toContain("Rx:");
    expect(result).toContain("Labs:");

    // Rough token count (assuming ~4 chars per token)
    const estimatedTokens = result.length / 4;
    expect(estimatedTokens).toBeLessThan(500);

    // Should be well-formatted with semicolons
    expect(result.split(";").length).toBeGreaterThan(1);
  });

  // Test case 6: Blood pressure observation handling
  test("should handle blood pressure observations correctly", () => {
    const bundle = {
      resourceType: "Bundle",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            name: [{ given: ["Test"], family: "Patient" }],
          },
        },
        {
          resource: {
            resourceType: "Observation",
            code: {
              coding: [
                {
                  code: "85354-9",
                  display: "Blood pressure",
                },
              ],
            },
            component: [
              {
                code: {
                  coding: [
                    {
                      code: "8480-6",
                      display: "Systolic blood pressure",
                    },
                  ],
                },
                valueQuantity: {
                  value: 142,
                  unit: "mmHg",
                },
              },
              {
                code: {
                  coding: [
                    {
                      code: "8462-4",
                      display: "Diastolic blood pressure",
                    },
                  ],
                },
                valueQuantity: {
                  value: 90,
                  unit: "mmHg",
                },
              },
            ],
            effectiveDateTime: "2024-06-01",
          },
        },
      ],
    };

    const result = compressFHIRBundle(bundle);

    expect(result).toContain("BP 142/90 (2024-06-01)");
  });

  // Test case 7: Empty bundle handling
  test("should handle empty or invalid bundles", () => {
    expect(compressFHIRBundle(null)).toBe("Invalid or empty FHIR Bundle");
    expect(compressFHIRBundle({})).toBe("Invalid or empty FHIR Bundle");
    expect(compressFHIRBundle({ entry: [] })).toBe("");
  });

  // Test case 8: De-duplication of observations
  test("should de-duplicate observations with same value and date", () => {
    const bundle = {
      resourceType: "Bundle",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            name: [{ given: ["Test"], family: "Patient" }],
          },
        },
        {
          resource: {
            resourceType: "Observation",
            code: {
              coding: [
                {
                  code: "4548-4",
                  display: "Hemoglobin A1c",
                },
              ],
            },
            valueQuantity: {
              value: 8.2,
              unit: "%",
            },
            effectiveDateTime: "2024-06-01",
          },
        },
        {
          resource: {
            resourceType: "Observation",
            code: {
              coding: [
                {
                  code: "4548-4",
                  display: "Hemoglobin A1c",
                },
              ],
            },
            valueQuantity: {
              value: 8.2,
              unit: "%",
            },
            effectiveDateTime: "2024-06-01",
          },
        },
      ],
    };

    const result = compressFHIRBundle(bundle);

    // Should only appear once
    const a1cMatches = result.match(/A1c 8\.2%/g);
    expect(a1cMatches).toHaveLength(1);
  });

  // Test case 9: Immunization and procedure handling
  test("should handle immunizations and procedures correctly", () => {
    const bundle = {
      resourceType: "Bundle",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            name: [{ given: ["Test"], family: "Patient" }],
          },
        },
        {
          resource: {
            resourceType: "Immunization",
            vaccineCode: {
              coding: [
                {
                  display: "Influenza vaccine",
                },
              ],
            },
            occurrenceDateTime: "2023-10-01",
          },
        },
        {
          resource: {
            resourceType: "Procedure",
            code: {
              coding: [
                {
                  display: "Colonoscopy",
                },
              ],
            },
            performedDateTime: "2023-05-15",
          },
        },
      ],
    };

    const result = compressFHIRBundle(bundle);

    expect(result).toContain("Vax: Influenza vaccine (2023-10-01)");
    expect(result).toContain("Proc: Colonoscopy (2023-05-15)");
  });

  // Test case 10: Comprehensive example matching the spec
  test("should match the example format from specification", () => {
    const bundle = {
      resourceType: "Bundle",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            name: [{ given: ["Jane"], family: "Doe" }],
            gender: "female",
            birthDate: "1972-01-01",
          },
        },
        {
          resource: {
            resourceType: "Condition",
            code: {
              coding: [
                {
                  display: "Type 2 diabetes mellitus",
                },
              ],
            },
            clinicalStatus: {
              coding: [
                {
                  code: "active",
                },
              ],
            },
            onsetDateTime: "2010-01-01",
          },
        },
        {
          resource: {
            resourceType: "Condition",
            code: {
              coding: [
                {
                  display: "Essential hypertension",
                },
              ],
            },
            clinicalStatus: {
              coding: [
                {
                  code: "active",
                },
              ],
            },
            onsetDateTime: "2020-01-01",
          },
        },
        {
          resource: {
            resourceType: "MedicationRequest",
            medicationCodeableConcept: {
              coding: [
                {
                  display: "Metformin",
                },
              ],
            },
            status: "active",
            dosageInstruction: [
              {
                doseAndRate: [
                  {
                    doseQuantity: {
                      value: 500,
                      unit: "mg",
                    },
                  },
                ],
                timing: {
                  code: {
                    coding: [
                      {
                        display: "BID",
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
        {
          resource: {
            resourceType: "MedicationRequest",
            medicationCodeableConcept: {
              coding: [
                {
                  display: "Lisinopril",
                },
              ],
            },
            status: "active",
            dosageInstruction: [
              {
                doseAndRate: [
                  {
                    doseQuantity: {
                      value: 10,
                      unit: "mg",
                    },
                  },
                ],
                timing: {
                  code: {
                    coding: [
                      {
                        display: "QD",
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
        {
          resource: {
            resourceType: "Observation",
            code: {
              coding: [
                {
                  code: "4548-4",
                  display: "Hemoglobin A1c",
                },
              ],
            },
            valueQuantity: {
              value: 8.2,
              unit: "%",
            },
            effectiveDateTime: "2024-06-01",
          },
        },
        {
          resource: {
            resourceType: "Observation",
            code: {
              coding: [
                {
                  code: "13457-7",
                  display: "Low density lipoprotein",
                },
              ],
            },
            valueQuantity: {
              value: 130,
              unit: "mg/dL",
            },
            effectiveDateTime: "2024-04-15",
          },
        },
        {
          resource: {
            resourceType: "Observation",
            code: {
              coding: [
                {
                  code: "85354-9",
                  display: "Blood pressure",
                },
              ],
            },
            component: [
              {
                code: {
                  coding: [
                    {
                      code: "8480-6",
                      display: "Systolic blood pressure",
                    },
                  ],
                },
                valueQuantity: {
                  value: 142,
                  unit: "mmHg",
                },
              },
              {
                code: {
                  coding: [
                    {
                      code: "8462-4",
                      display: "Diastolic blood pressure",
                    },
                  ],
                },
                valueQuantity: {
                  value: 90,
                  unit: "mmHg",
                },
              },
            ],
            effectiveDateTime: "2024-06-01",
          },
        },
        {
          resource: {
            resourceType: "AllergyIntolerance",
            code: {
              coding: [
                {
                  display: "Penicillin",
                },
              ],
            },
            reaction: [
              {
                manifestation: [
                  {
                    coding: [
                      {
                        display: "Skin rash",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
        {
          resource: {
            resourceType: "Immunization",
            vaccineCode: {
              coding: [
                {
                  display: "Influenza vaccine",
                },
              ],
            },
            occurrenceDateTime: "2023-10-01",
          },
        },
      ],
    };

    const result = compressFHIRBundle(bundle);

    // Should match the general format of the example
    expect(result).toMatch(/^Pt: Jane Doe, F, DOB 1972-01-01/);
    expect(result).toContain(
      "Dx: Type 2 diabetes mellitus (2010-01-01), Essential hypertension (2020-01-01)",
    );
    expect(result).toContain("Rx: Metformin 500mg BID, Lisinopril 10mg QD");
    expect(result).toContain(
      "Labs: A1c 8.2% (2024-06-01), LDL 130mg/dL (2024-04-15), BP 142/90 (2024-06-01)",
    );
    expect(result).toContain("Allergies: Penicillin (Skin rash)");
    expect(result).toContain("Vax: Influenza vaccine (2023-10-01)");
  });
});
