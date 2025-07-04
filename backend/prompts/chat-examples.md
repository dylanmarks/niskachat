# Clinical Chat Prompt Examples

This file contains examples of how to customize the clinical chat prompt for different use cases and specialties.

## Basic Clinical Questions

### Example Interactions:
- "What are this patient's active conditions?"
- "Show me the latest lab results"
- "What medications is the patient currently taking?"
- "Are there any concerning vital signs?"

## Specialized Prompts for Different Departments

### Emergency Department Focus
Add to the clinical-chat.txt prompt:
```
### EMERGENCY DEPARTMENT PRIORITIES
- Identify acute/urgent conditions requiring immediate attention
- Flag abnormal vital signs or critical lab values
- Highlight drug allergies and contraindications
- Consider triage and disposition factors
```

### Primary Care Focus
Add to the clinical-chat.txt prompt:
```
### PRIMARY CARE PRIORITIES
- Focus on preventive care opportunities
- Identify chronic disease management gaps
- Review medication compliance and interactions
- Consider social determinants of health
```

### Cardiology Focus
Add to the clinical-chat.txt prompt:
```
### CARDIOLOGY FOCUS
- Prioritize cardiovascular conditions and risk factors
- Interpret cardiac-specific lab values (troponins, BNP, etc.)
- Review cardiac medications and dosing
- Assess cardiovascular risk stratification
```

## Response Style Customization

### More Concise Responses
Replace the response structure section with:
```
### 4. RESPONSE STRUCTURE
- Provide direct, bullet-point answers
- Limit responses to 2-3 sentences maximum
- Focus on actionable clinical information
- Use medical abbreviations when appropriate
```

### More Detailed Analysis
Replace the response structure section with:
```
### 4. RESPONSE STRUCTURE
- Provide comprehensive clinical analysis
- Include differential considerations
- Explain clinical reasoning
- Suggest follow-up actions and monitoring
```

## How to Apply Changes

1. Edit `backend/prompts/clinical-chat.txt`
2. Run `npm run reload-prompts` to refresh the cache
3. Test with the chat interface
4. Iterate and refine based on provider feedback

## Testing Different Prompts

You can create specialty-specific prompt files:
- `clinical-chat-ed.txt` for Emergency Department
- `clinical-chat-cardio.txt` for Cardiology
- `clinical-chat-primary.txt` for Primary Care

Then modify the backend to load different prompts based on user context or preferences.