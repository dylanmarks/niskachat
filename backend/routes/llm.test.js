import express from "express";
import request from "supertest";
import llmRouter, { parseClinicalChatResponse } from "./llm.js";

// Create a test app
const app = express();
app.use(express.json());
app.use("/llm", llmRouter);

// Mock FHIR Bundle for testing
const mockFhirBundle = {
  resourceType: "Bundle",
  id: "test-bundle",
  type: "collection",
  entry: [
    {
      resource: {
        resourceType: "Patient",
        id: "patient-1",
        name: [
          {
            given: ["John"],
            family: "Doe",
          },
        ],
        gender: "male",
        birthDate: "1975-03-15",
        identifier: [
          {
            type: {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                  code: "MR",
                },
              ],
            },
            value: "123456789",
          },
        ],
      },
    },
    {
      resource: {
        resourceType: "Condition",
        id: "condition-1",
        clinicalStatus: {
          coding: [
            {
              system:
                "http://terminology.hl7.org/CodeSystem/condition-clinical",
              code: "active",
            },
          ],
        },
        code: {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "38341003",
              display: "Hypertension",
            },
          ],
        },
        subject: {
          reference: "Patient/patient-1",
        },
        recordedDate: "2023-01-15",
      },
    },
    {
      resource: {
        resourceType: "Observation",
        id: "observation-1",
        status: "final",
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "8480-6",
              display: "Systolic blood pressure",
            },
          ],
        },
        subject: {
          reference: "Patient/patient-1",
        },
        effectiveDateTime: "2023-12-01",
        valueQuantity: {
          value: 140,
          unit: "mmHg",
          system: "http://unitsofmeasure.org",
          code: "mm[Hg]",
        },
      },
    },
    {
      resource: {
        resourceType: "MedicationRequest",
        id: "medication-1",
        status: "active",
        intent: "order",
        medicationCodeableConcept: {
          coding: [
            {
              system: "http://www.nlm.nih.gov/research/umls/rxnorm",
              code: "197361",
              display: "Lisinopril 10mg",
            },
          ],
        },
        subject: {
          reference: "Patient/patient-1",
        },
        authoredOn: "2023-01-15",
        dosageInstruction: [
          {
            text: "Take 1 tablet daily",
          },
        ],
      },
    },
  ],
};

const emptyBundle = {
  resourceType: "Bundle",
  id: "empty-bundle",
  type: "collection",
  entry: [],
};

describe("Summarization API", () => {
  describe("POST /llm", () => {
    it("should return 400 for missing bundle", async () => {
      const response = await request(app).post("/llm").send({}).expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Missing patient data");
    });

    it("rejects oversized prompts and untrusted source-reference formats", async () => {
      await request(app)
        .post("/llm")
        .send({ bundle: mockFhirBundle, query: "x".repeat(1001) })
        .expect(400);
      await request(app)
        .post("/llm")
        .send({
          bundle: mockFhirBundle,
          sourceReferences: ["https://attacker.example"],
        })
        .expect(400);
    });

    it("should return 400 for empty bundle", async () => {
      const response = await request(app)
        .post("/llm")
        .send({ bundle: emptyBundle })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Invalid FHIR Bundle");
    });

    it("should generate fallback summary when LLM is unavailable", async () => {
      const response = await request(app)
        .post("/llm")
        .send({ bundle: mockFhirBundle })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("summary");
      expect(response.body).toHaveProperty("llmUsed", false);
      expect(response.body).toHaveProperty("stats");
      expect(response.body).toHaveProperty("timestamp");

      // Check that summary contains expected content
      expect(response.body.summary).toContain("John Doe");
      expect(response.body.summary).toContain("structured FHIR data");
      expect(response.body.summary).toContain("male");

      // Check stats
      expect(response.body.stats).toHaveProperty("conditions", 1);
      expect(response.body.stats).toHaveProperty("observations", 1);
      expect(response.body.stats).toHaveProperty("medications", 1);
    });

    it("should handle bundle with only patient data", async () => {
      const patientOnlyBundle = {
        resourceType: "Bundle",
        id: "patient-only-bundle",
        type: "collection",
        entry: [mockFhirBundle.entry[0]], // Only patient resource
      };

      const response = await request(app)
        .post("/llm")
        .send({ bundle: patientOnlyBundle })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.summary).toContain("John Doe");
      expect(response.body.stats.conditions).toBe(0);
      expect(response.body.stats.observations).toBe(0);
      expect(response.body.stats.medications).toBe(0);
    });

    it("should handle bundle with inactive conditions", async () => {
      const inactiveConditionBundle = {
        resourceType: "Bundle",
        id: "inactive-condition-bundle",
        type: "collection",
        entry: [
          mockFhirBundle.entry[0], // Patient
          {
            resource: {
              ...mockFhirBundle.entry[1].resource,
              clinicalStatus: {
                coding: [
                  {
                    system:
                      "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    code: "inactive",
                  },
                ],
              },
            },
          },
        ],
      };

      const response = await request(app)
        .post("/llm")
        .send({ bundle: inactiveConditionBundle })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.stats.conditions).toBe(0); // Should exclude inactive conditions
    });

    it("should handle bundle with inactive medications", async () => {
      const inactiveMedicationBundle = {
        resourceType: "Bundle",
        id: "inactive-medication-bundle",
        type: "collection",
        entry: [
          mockFhirBundle.entry[0], // Patient
          {
            resource: {
              ...mockFhirBundle.entry[3].resource,
              status: "stopped",
            },
          },
        ],
      };

      const response = await request(app)
        .post("/llm")
        .send({ bundle: inactiveMedicationBundle })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.stats.medications).toBe(0); // Should exclude inactive medications
    });

    it("should handle malformed bundle gracefully", async () => {
      const malformedBundle = {
        resourceType: "Bundle",
        id: "malformed-bundle",
        type: "collection",
        entry: [
          {
            resource: null, // Null resource
          },
          {
            // Missing resource property
          },
        ],
      };

      const response = await request(app)
        .post("/llm")
        .send({ bundle: malformedBundle })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Invalid FHIR Bundle");
    });
  });

  describe("POST /llm/stream", () => {
    it("should return 400 for missing patient data", async () => {
      const response = await request(app)
        .post("/llm/stream")
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("error", "Missing patient data");
    });

    it("should return 400 for empty bundle", async () => {
      const emptyBundle = {
        resourceType: "Bundle",
        id: "empty-bundle",
        type: "collection",
        entry: [],
      };

      const response = await request(app)
        .post("/llm/stream")
        .send({ bundle: emptyBundle })
        .expect(400);

      expect(response.body).toHaveProperty("error", "Invalid FHIR Bundle");
    });

    it("should return 503 when the selected LLM provider is not configured", async () => {
      const response = await request(app)
        .post("/llm/stream")
        .send({ bundle: mockFhirBundle, query: "Recommend next steps" })
        .expect(503);

      expect(response.body).toHaveProperty("error", "Service Unavailable");
    });
  });

  describe("evidence-linked model output validation", () => {
    it("keeps only allow-listed source references and assigns no model urgency", () => {
      const result = parseClinicalChatResponse(
        JSON.stringify({
          response: "The record contains an observation.",
          evidenceReferences: [
            "Observation/observation-1",
            "Patient/fabricated",
          ],
          suggestedActions: [
            {
              id: "action-1",
              title: "Review the observation",
              description: "Compare it with the current context.",
              category: "monitoring",
              priority: "stat",
              evidenceReferences: ["Observation/observation-1"],
            },
          ],
          carePlan: { resourceType: "CarePlan", intent: "plan" },
          tasks: [
            { resourceType: "Task", intent: "order", status: "requested" },
          ],
        }),
        ["Observation/observation-1"],
      );

      expect(result.evidenceReferences).toEqual(["Observation/observation-1"]);
      expect(result.suggestedActions).toHaveLength(1);
      expect(result.suggestedActions[0].priority).toBe("routine");
      expect(result.suggestedActions[0].evidenceReferences).toEqual([
        "Observation/observation-1",
      ]);
      expect(result).not.toHaveProperty("taskGeneration");
    });

    it("rejects unstructured or unreferenced clinical output", () => {
      expect(
        parseClinicalChatResponse("A clinical answer", ["Patient/p-1"])
          .response,
      ).toContain("could not be validated");
      expect(
        parseClinicalChatResponse(
          JSON.stringify({
            response: "Unreferenced claim",
            evidenceReferences: [],
          }),
          ["Patient/p-1"],
        ).response,
      ).toContain("could not be validated");
    });
  });

  describe("GET /llm/status", () => {
    it("should return LLM status", async () => {
      const response = await request(app).get("/llm/status").expect(200);

      expect(response.body).toHaveProperty("llmConfigured");
      expect(response.body).toHaveProperty("providers");
      expect(response.body).toHaveProperty("timestamp");
      // No provider credentials should be configured in the test environment.
      expect(response.body.llmConfigured).toBe(false);
    });
  });
});
