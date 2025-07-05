import { compressFHIRBundle } from './fhirBundleCompressor.js';

// Example FHIR Bundle - matches the specification example
const exampleBundle = {
  resourceType: 'Bundle',
  id: 'example-bundle',
  type: 'collection',
  entry: [
    {
      resource: {
        resourceType: 'Patient',
        id: 'patient-1',
        name: [
          {
            given: ['Jane'],
            family: 'Doe'
          }
        ],
        gender: 'female',
        birthDate: '1972-01-01',
        identifier: [
          {
            type: {
              coding: [
                {
                  code: 'MR',
                  display: 'Medical record number'
                }
              ]
            },
            value: 'MRN123456'
          }
        ]
      }
    },
    {
      resource: {
        resourceType: 'Condition',
        id: 'condition-1',
        code: {
          coding: [
            {
              system: 'http://hl7.org/fhir/sid/icd-10',
              code: 'E11',
              display: 'Type 2 diabetes mellitus'
            }
          ],
          text: 'T2DM'
        },
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: 'active'
            }
          ]
        },
        onsetDateTime: '2010-01-01'
      }
    },
    {
      resource: {
        resourceType: 'Condition',
        id: 'condition-2',
        code: {
          coding: [
            {
              system: 'http://hl7.org/fhir/sid/icd-10',
              code: 'I10',
              display: 'Essential hypertension'
            }
          ],
          text: 'HTN'
        },
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: 'active'
            }
          ]
        },
        onsetDateTime: '2020-01-01'
      }
    },
    {
      resource: {
        resourceType: 'MedicationRequest',
        id: 'medication-1',
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [
            {
              system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: '6809',
              display: 'Metformin'
            }
          ]
        },
        dosageInstruction: [
          {
            doseAndRate: [
              {
                doseQuantity: {
                  value: 500,
                  unit: 'mg',
                  system: 'http://unitsofmeasure.org',
                  code: 'mg'
                }
              }
            ],
            timing: {
              code: {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation',
                    code: 'BID',
                    display: 'BID'
                  }
                ]
              }
            }
          }
        ]
      }
    },
    {
      resource: {
        resourceType: 'MedicationRequest',
        id: 'medication-2',
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [
            {
              system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: '29046',
              display: 'Lisinopril'
            }
          ]
        },
        dosageInstruction: [
          {
            doseAndRate: [
              {
                doseQuantity: {
                  value: 10,
                  unit: 'mg',
                  system: 'http://unitsofmeasure.org',
                  code: 'mg'
                }
              }
            ],
            timing: {
              code: {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation',
                    code: 'QD',
                    display: 'QD'
                  }
                ]
              }
            }
          }
        ]
      }
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'obs-1',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '4548-4',
              display: 'Hemoglobin A1c/Hemoglobin.total in Blood'
            }
          ],
          text: 'HbA1c'
        },
        valueQuantity: {
          value: 8.2,
          unit: '%',
          system: 'http://unitsofmeasure.org',
          code: '%'
        },
        effectiveDateTime: '2024-06-01'
      }
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'obs-2',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '13457-7',
              display: 'Cholesterol in LDL [Mass/volume] in Serum or Plasma'
            }
          ],
          text: 'LDL Cholesterol'
        },
        valueQuantity: {
          value: 130,
          unit: 'mg/dL',
          system: 'http://unitsofmeasure.org',
          code: 'mg/dL'
        },
        effectiveDateTime: '2024-04-15'
      }
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'obs-3',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '85354-9',
              display: 'Blood pressure panel with all children optional'
            }
          ],
          text: 'Blood Pressure'
        },
        component: [
          {
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '8480-6',
                  display: 'Systolic blood pressure'
                }
              ]
            },
            valueQuantity: {
              value: 142,
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]'
            }
          },
          {
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '8462-4',
                  display: 'Diastolic blood pressure'
                }
              ]
            },
            valueQuantity: {
              value: 90,
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]'
            }
          }
        ],
        effectiveDateTime: '2024-06-01'
      }
    },
    {
      resource: {
        resourceType: 'AllergyIntolerance',
        id: 'allergy-1',
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
              code: 'active'
            }
          ]
        },
        code: {
          coding: [
            {
              system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: '7980',
              display: 'Penicillin'
            }
          ]
        },
        reaction: [
          {
            manifestation: [
              {
                coding: [
                  {
                    system: 'http://snomed.info/sct',
                    code: '271807003',
                    display: 'Skin rash'
                  }
                ]
              }
            ]
          }
        ]
      }
    },
    {
      resource: {
        resourceType: 'Immunization',
        id: 'immunization-1',
        status: 'completed',
        vaccineCode: {
          coding: [
            {
              system: 'http://hl7.org/fhir/sid/cvx',
              code: '88',
              display: 'Influenza vaccine'
            }
          ],
          text: 'Flu Vax'
        },
        occurrenceDateTime: '2023-10-01'
      }
    }
  ]
};

// Example usage
console.log('🔬 FHIR Bundle Compressor Example\n');
console.log('📋 Input Bundle:');
console.log(`- ${exampleBundle.entry.length} resources`);
console.log(`- Resource types: ${[...new Set(exampleBundle.entry.map(e => e.resource.resourceType))].join(', ')}`);
console.log();

console.log('🗜️  Compressed Output:');
const compressed = compressFHIRBundle(exampleBundle);
console.log(compressed);
console.log();

console.log('📊 Compression Stats:');
console.log(`- Original JSON size: ${JSON.stringify(exampleBundle).length} characters`);
console.log(`- Compressed size: ${compressed.length} characters`);
console.log(`- Compression ratio: ${Math.round((1 - compressed.length / JSON.stringify(exampleBundle).length) * 100)}%`);
console.log(`- Estimated tokens (÷4): ~${Math.ceil(compressed.length / 4)}`);
console.log();

// Example with large observation set
console.log('🧪 Large Observation Set Example (25 A1c values):');
const largeObsBundle = {
  resourceType: 'Bundle',
  entry: [
    {
      resource: {
        resourceType: 'Patient',
        name: [{ given: ['Test'], family: 'Patient' }],
        gender: 'male',
        birthDate: '1980-01-01'
      }
    },
    // Add 25 A1c observations
    ...Array.from({ length: 25 }, (_, i) => ({
      resource: {
        resourceType: 'Observation',
        code: {
          coding: [{
            code: '4548-4',
            display: 'Hemoglobin A1c'
          }]
        },
        valueQuantity: {
          value: 7.0 + (i * 0.1),
          unit: '%'
        },
        effectiveDateTime: `2024-${String(i + 1).padStart(2, '0')}-01`
      }
    }))
  ]
};

const largeObsCompressed = compressFHIRBundle(largeObsBundle);
console.log(largeObsCompressed);
const a1cCount = (largeObsCompressed.match(/A1c \d+\.\d%/g) || []).length;
console.log(`📈 A1c observations shown: ${a1cCount}/25 (max 10 per type)`);

export { exampleBundle, compressFHIRBundle };

// If running directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  // Already executed above
}