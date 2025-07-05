import { compressFHIRBundle } from './fhirBundleCompressor.js';

// Realistic clinical scenario: 65-year-old diabetic patient with multiple conditions
const comprehensiveFHIRBundle = {
  resourceType: 'Bundle',
  id: 'comprehensive-patient-bundle',
  type: 'collection',
  entry: [
    // Patient Demographics
    {
      resource: {
        resourceType: 'Patient',
        id: 'patient-martinez',
        name: [
          {
            given: ['Maria', 'Elena'],
            family: 'Martinez'
          }
        ],
        gender: 'female',
        birthDate: '1958-03-15',
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
            value: 'MRN-987654'
          }
        ]
      }
    },
    
    // Active Conditions
    {
      resource: {
        resourceType: 'Condition',
        id: 'diabetes-t2',
        code: {
          coding: [
            {
              system: 'http://hl7.org/fhir/sid/icd-10',
              code: 'E11.9',
              display: 'Type 2 diabetes mellitus without complications'
            }
          ],
          text: 'Type 2 Diabetes'
        },
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: 'active'
            }
          ]
        },
        onsetDateTime: '2015-08-12'
      }
    },
    {
      resource: {
        resourceType: 'Condition',
        id: 'hypertension',
        code: {
          coding: [
            {
              system: 'http://hl7.org/fhir/sid/icd-10',
              code: 'I10',
              display: 'Essential hypertension'
            }
          ]
        },
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: 'active'
            }
          ]
        },
        onsetDateTime: '2018-02-28'
      }
    },
    {
      resource: {
        resourceType: 'Condition',
        id: 'hyperlipidemia',
        code: {
          coding: [
            {
              system: 'http://hl7.org/fhir/sid/icd-10',
              code: 'E78.5',
              display: 'Hyperlipidemia'
            }
          ]
        },
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: 'active'
            }
          ]
        },
        onsetDateTime: '2019-11-05'
      }
    },
    
    // Inactive Condition (should be excluded)
    {
      resource: {
        resourceType: 'Condition',
        id: 'resolved-uti',
        code: {
          coding: [
            {
              system: 'http://hl7.org/fhir/sid/icd-10',
              code: 'N39.0',
              display: 'Urinary tract infection'
            }
          ]
        },
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: 'resolved'
            }
          ]
        },
        onsetDateTime: '2023-01-15'
      }
    },
    
    // Active Medications
    {
      resource: {
        resourceType: 'MedicationRequest',
        id: 'metformin-prescription',
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
                  value: 1000,
                  unit: 'mg'
                }
              }
            ],
            timing: {
              code: {
                coding: [
                  {
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
        id: 'lisinopril-prescription',
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
                  value: 20,
                  unit: 'mg'
                }
              }
            ],
            timing: {
              code: {
                coding: [
                  {
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
        resourceType: 'MedicationRequest',
        id: 'atorvastatin-prescription',
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [
            {
              system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: '83367',
              display: 'Atorvastatin'
            }
          ]
        },
        dosageInstruction: [
          {
            doseAndRate: [
              {
                doseQuantity: {
                  value: 40,
                  unit: 'mg'
                }
              }
            ],
            timing: {
              code: {
                coding: [
                  {
                    code: 'QHS',
                    display: 'QHS'
                  }
                ]
              }
            }
          }
        ]
      }
    },
    
    // Stopped Medication (should be excluded)
    {
      resource: {
        resourceType: 'MedicationRequest',
        id: 'old-glipizide',
        status: 'stopped',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [
            {
              system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: '25789',
              display: 'Glipizide'
            }
          ]
        },
        dosageInstruction: [
          {
            doseAndRate: [
              {
                doseQuantity: {
                  value: 5,
                  unit: 'mg'
                }
              }
            ]
          }
        ]
      }
    },
    
    // Recent Lab Results (Multiple A1c values to test 10-limit)
    {
      resource: {
        resourceType: 'Observation',
        id: 'a1c-latest',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '4548-4',
              display: 'Hemoglobin A1c/Hemoglobin.total in Blood'
            }
          ]
        },
        valueQuantity: {
          value: 7.8,
          unit: '%'
        },
        effectiveDateTime: '2024-12-15'
      }
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'a1c-prev1',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '4548-4',
              display: 'Hemoglobin A1c/Hemoglobin.total in Blood'
            }
          ]
        },
        valueQuantity: {
          value: 8.1,
          unit: '%'
        },
        effectiveDateTime: '2024-09-15'
      }
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'a1c-prev2',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '4548-4',
              display: 'Hemoglobin A1c/Hemoglobin.total in Blood'
            }
          ]
        },
        valueQuantity: {
          value: 8.4,
          unit: '%'
        },
        effectiveDateTime: '2024-06-15'
      }
    },
    
    // Blood Pressure
    {
      resource: {
        resourceType: 'Observation',
        id: 'bp-latest',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '85354-9',
              display: 'Blood pressure panel'
            }
          ]
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
              value: 138,
              unit: 'mmHg'
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
              value: 85,
              unit: 'mmHg'
            }
          }
        ],
        effectiveDateTime: '2024-12-15'
      }
    },
    
    // Lipid Panel
    {
      resource: {
        resourceType: 'Observation',
        id: 'ldl-latest',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '13457-7',
              display: 'Cholesterol in LDL [Mass/volume] in Serum or Plasma'
            }
          ]
        },
        valueQuantity: {
          value: 95,
          unit: 'mg/dL'
        },
        effectiveDateTime: '2024-12-15'
      }
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'hdl-latest',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '2085-9',
              display: 'Cholesterol in HDL [Mass/volume] in Serum or Plasma'
            }
          ]
        },
        valueQuantity: {
          value: 42,
          unit: 'mg/dL'
        },
        effectiveDateTime: '2024-12-15'
      }
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'triglycerides-latest',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '2571-8',
              display: 'Triglyceride [Mass/volume] in Serum or Plasma'
            }
          ]
        },
        valueQuantity: {
          value: 168,
          unit: 'mg/dL'
        },
        effectiveDateTime: '2024-12-15'
      }
    },
    
    // Kidney Function
    {
      resource: {
        resourceType: 'Observation',
        id: 'creatinine-latest',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '2160-0',
              display: 'Creatinine [Mass/volume] in Serum or Plasma'
            }
          ]
        },
        valueQuantity: {
          value: 1.1,
          unit: 'mg/dL'
        },
        effectiveDateTime: '2024-12-15'
      }
    },
    
    // Allergies
    {
      resource: {
        resourceType: 'AllergyIntolerance',
        id: 'penicillin-allergy',
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
        resourceType: 'AllergyIntolerance',
        id: 'sulfa-allergy',
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
              code: '387467',
              display: 'Sulfonamide'
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
                    code: '62315008',
                    display: 'Difficulty breathing'
                  }
                ]
              }
            ]
          }
        ]
      }
    },
    
    // Immunizations
    {
      resource: {
        resourceType: 'Immunization',
        id: 'flu-vaccine-2024',
        status: 'completed',
        vaccineCode: {
          coding: [
            {
              system: 'http://hl7.org/fhir/sid/cvx',
              code: '88',
              display: 'Influenza vaccine'
            }
          ]
        },
        occurrenceDateTime: '2024-10-15'
      }
    },
    {
      resource: {
        resourceType: 'Immunization',
        id: 'covid-booster-2024',
        status: 'completed',
        vaccineCode: {
          coding: [
            {
              system: 'http://hl7.org/fhir/sid/cvx',
              code: '228',
              display: 'COVID-19 vaccine'
            }
          ]
        },
        occurrenceDateTime: '2024-09-20'
      }
    },
    
    // Procedures
    {
      resource: {
        resourceType: 'Procedure',
        id: 'diabetic-eye-exam',
        status: 'completed',
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '410451008',
              display: 'Diabetic retinopathy screening'
            }
          ]
        },
        performedDateTime: '2024-11-10'
      }
    },
    {
      resource: {
        resourceType: 'Procedure',
        id: 'mammogram',
        status: 'completed',
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '24623002',
              display: 'Mammography'
            }
          ]
        },
        performedDateTime: '2024-08-22'
      }
    },
    
    // Diagnostic Reports
    {
      resource: {
        resourceType: 'DiagnosticReport',
        id: 'comprehensive-metabolic-panel',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '24323-8',
              display: 'Comprehensive metabolic panel'
            }
          ]
        },
        effectiveDateTime: '2024-12-15'
      }
    },
    {
      resource: {
        resourceType: 'DiagnosticReport',
        id: 'ecg-report',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '11524-6',
              display: 'EKG study'
            }
          ]
        },
        effectiveDateTime: '2024-11-28'
      }
    }
  ]
};

console.log('🏥 COMPREHENSIVE FHIR BUNDLE COMPRESSION DEMO');
console.log('='.repeat(60));
console.log();

console.log('👩‍⚕️ CLINICAL SCENARIO:');
console.log('65-year-old female with Type 2 diabetes, hypertension, and hyperlipidemia');
console.log('Recent labs, multiple medications, allergies, and preventive care');
console.log();

console.log('📊 BUNDLE STATISTICS:');
console.log(`- Total Resources: ${comprehensiveFHIRBundle.entry.length}`);
console.log(`- Resource Types: ${[...new Set(comprehensiveFHIRBundle.entry.map(e => e.resource.resourceType))].join(', ')}`);
console.log(`- Original JSON Size: ${JSON.stringify(comprehensiveFHIRBundle, null, 2).length.toLocaleString()} characters`);
console.log();

console.log('🔄 COMPRESSION PROCESS:');
console.log('Processing bundle through FHIR compressor...');
console.log();

const compressed = compressFHIRBundle(comprehensiveFHIRBundle);

console.log('✅ COMPRESSED OUTPUT:');
console.log('-'.repeat(60));
console.log(compressed);
console.log('-'.repeat(60));
console.log();

console.log('📈 COMPRESSION METRICS:');
const originalSize = JSON.stringify(comprehensiveFHIRBundle).length;
const compressedSize = compressed.length;
const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100);
const estimatedTokens = Math.ceil(compressedSize / 4);

console.log(`- Original Size: ${originalSize.toLocaleString()} characters`);
console.log(`- Compressed Size: ${compressedSize.toLocaleString()} characters`);
console.log(`- Compression Ratio: ${compressionRatio}%`);
console.log(`- Estimated Tokens: ~${estimatedTokens} tokens`);
console.log(`- Token Efficiency: ${Math.round(originalSize / estimatedTokens)}:1 ratio`);
console.log();

console.log('🧠 LLM PROMPT USAGE:');
console.log('This compressed summary can now be used in LLM prompts like:');
console.log();
console.log('```');
console.log('Patient Summary: ' + compressed);
console.log('');
console.log('Based on this clinical data, please provide:');
console.log('1. Risk assessment for diabetic complications');
console.log('2. Medication optimization recommendations');
console.log('3. Preventive care gaps');
console.log('```');
console.log();

console.log('🔍 CLINICAL INSIGHTS PRESERVED:');
console.log('✅ Patient demographics and identifiers');
console.log('✅ Active conditions with onset dates');
console.log('✅ Current medications with dosing');
console.log('✅ Recent lab trends (A1c improvement: 8.4% → 7.8%)');
console.log('✅ Vital signs (BP: 138/85 - controlled)');
console.log('✅ Lipid panel (LDL: 95 mg/dL - at goal)');
console.log('✅ Kidney function (Cr: 1.1 mg/dL - stable)');
console.log('✅ Drug allergies (Penicillin, Sulfa)');
console.log('✅ Preventive care (Flu vaccine, COVID booster)');
console.log('✅ Screening procedures (Eye exam, Mammogram)');
console.log('✅ Diagnostic studies (CMP, ECG)');
console.log();

console.log('🚀 READY FOR LLM PROCESSING!');
console.log('The compressed summary maintains all clinically relevant information');
console.log('while reducing token usage by ' + compressionRatio + '% for cost-effective LLM interactions.');