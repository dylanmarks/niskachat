# NiskaChat FHIR Examples

This directory contains example FHIR bundles and resources for development, testing, and demonstration purposes.

## 📁 Folder Structure

## 🎯 Usage

### For Development

- Use these examples to test FHIR client functionality
- Load sample data during development
- Validate component rendering with realistic data

### For Testing

- Unit tests can reference these files
- Integration tests can use as seed data
- Manual testing scenarios

### For Documentation

- Examples for API documentation
- Demo scenarios for presentations
- Reference implementations

## 📝 FHIR Bundle Guidelines

When adding new example bundles:

1. **Use descriptive filenames**: `patient-john-doe-with-diabetes.json`
2. **Include realistic data**: Use fake but believable names, dates, codes
3. **Follow FHIR R4 specification**: Ensure valid JSON structure
4. **Add comments in this README**: Document what each bundle demonstrates

## 🔗 Loading Examples

### Frontend (Angular)

```typescript
// Load from assets if moved to src/assets/examples/
this.http.get("/assets/examples/fhir-bundles/example.json");
```

### Backend (Node.js)

```javascript
// Load from file system
const bundle = require("./examples/fhir-bundles/example.json");
```

### Testing

```javascript
// In tests
const exampleBundle = require("../../examples/fhir-bundles/example.json");
```

## 🚀 Getting Started

1. Drop your FHIR JSON files into the appropriate subfolder
2. Update this README with descriptions of new examples
3. Reference them in your development/testing code
4. Enjoy realistic FHIR data for development!
