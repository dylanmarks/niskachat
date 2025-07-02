# NiskaChat: FHIR Bundle Viewer & SMART on FHIR App

**NiskaChat** is a modular, standards-compliant, and test-driven web application that enables clinicians and patients to securely view clinical data from FHIR repositories. Built with an Angular frontend and a Node.js/Express backend, NiskaChat supports SMART on FHIR authentication, structured FHIR resource views, charting of observations, and optional LLM-powered summarization and chat.

## 🌐 Project Overview

NiskaChat is designed for:

- **Clinicians** reviewing longitudinal patient data
- **Care coordinators** managing multi-provider care plans
- **Patients** wanting to view and interact with their full medical record
- **Future agentic capabilities** for interpreting and guiding health actions

Initial data sources include the SMART Sandbox and static FHIR Bundle uploads, with future support for the Google Cloud Healthcare API.

---

## ⚙️ Tech Stack

| Layer     | Tech                                  |
| --------- | ------------------------------------- |
| Frontend  | Angular 16+, Chart.js, fhirclient.js  |
| Backend   | Node.js + Express, Jest, Supertest    |
| Hosting   | GitHub Pages, Netlify, Render, Heroku |
| Auth      | SMART on FHIR (OAuth2 + PKCE)         |
| AI Option | Claude via Bedrock or local LLM       |

---

## 🔐 Key Features

- SMART on FHIR OAuth2 login (with PKCE)
- Patient summary: demographics, identifiers
- Views for Conditions, Medications, Observations
- Time-series charts for labs and vitals
- Optional LLM-powered summarization and chat
- Upload and parse static FHIR Bundles in test mode
- Secure backend token handling + proxy (optional)

---

## ✅ Success Criteria

| Metric                          | Target                    |
| ------------------------------- | ------------------------- |
| Time to patient view post-login | < 10 seconds              |
| Resource parsing accuracy       | 100% by `resourceType`    |
| Compatibility                   | SMART R4, GCP FHIR        |
| Security                        | No client secrets exposed |
| LLM cost per summary (optional) | <$0.10                    |

---

## 🚧 Development Phases (TDD)

Development is organized into clear test-driven phases, including:

1. **Project scaffolding**
2. **SMART OAuth2 backend**
3. **FHIR context handling**
4. **Patient summary**
5. **Condition list**
6. **Observation charting**
7. **Medication list**
8. **Static FHIR Bundle support**
9. **FHIR proxy backend (optional)**
10. **LLM summarization plugin (optional)**
11. **Deployment + integration testing**
12. **Chat UI (initial + with pre-set topics)**

> Each phase includes: test case definition → implementation → CI validation → PR merge

📄 [View the full PRD here](./docs/PRD.md)

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Angular CLI
- Git

### Setup

```bash
# Clone the repo
git clone https://github.com/your-org/niska-chat.git
cd niska-chat

# Install dependencies
npm install

# Run backend
cd backend
npm install
npm run dev

# Run frontend
cd ../frontend
npm install
ng serve
```
