# NiskaChat: FHIR Bundle Viewer & SMART on FHIR App

**NiskaChat** is a modular, standards-compliant, and test-driven web application that enables clinicians and patients to securely view clinical data from FHIR repositories. Built with an Angular frontend and a Node.js/Express backend, NiskaChat supports SMART on FHIR authentication, structured FHIR resource views, charting of observations, and optional LLM-powered summarization and chat.

## 🌐 Project Overview

<p align="center">
  <img src="src/assets/niska-logo.png"
       alt="Logo icon of a goose from above with medical cross"
       width="150">
</p>

Niska Chat draws its name from the Indigenous Cree word niska (“goose”). Just as geese fly in cooperative V-formation, the app promotes shared direction and mutual support among clinicians and patients. Geese navigate with an innate magnetic compass, mirroring the platform’s goal of steering users confidently through complex health data. Niska Chat was built in Calgary on the traditional territories of Treaty 7: the Blackfoot Confederacy (Siksika, Piikani, Kainai), the Tsuut’ina Nation, the Stoney Nakoda Nations, and the Métis Nation of Alberta, Region 3.

NiskaChat is designed for:

- **Clinicians** reviewing longitudinal patient data
- **Care coordinators** managing multi-provider care plans
- **Future agentic capabilities** for interpreting and guiding health actions

Initial data sources include the SMART Sandbox and static FHIR Bundle uploads, with future support for the Google Cloud Healthcare API, Aidbox, or integration into SMART compliant EHRs such as Epic and Oracle.

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

| Metric                          | Target                      |
| ------------------------------- | --------------------------- |
| Time to patient view post-login | < 10 seconds                |
| Resource parsing accuracy       | 100% by `resourceType`      |
| Compatibility                   | SMART R4, GCP FHIR          |
| Security                        | Server-side session storage |
| LLM cost per summary (optional) | <$0.10                      |

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

📄 [View the full PRD here](./docs/prd.md)  
📋 [View the task tracker here](./docs/tasks.md)

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
```

### Configuration

NiskaChat is configured using environment variables. For local development, create a `.env` file in the project root by copying the example file:

```bash
cp .env.example .env
```

Next, open the `.env` file and configure the following variables:

- **`LLM_PROVIDER`**: Set this to `claude-haiku` to use the Anthropic API.
- **`ANTHROPIC_API_KEY`**: Your Anthropic API key. This is required if you're using the `claude-haiku` provider.
- **`SESSION_SECRET`**: A long, random string used to secure user sessions. You can generate one using a tool like `openssl rand -hex 32`.
- **`CORS_ORIGINS`**: A comma-separated list of allowed origins for CORS requests. For local development, this should be `http://localhost:4200`.

### Running the Application

```bash
# Run the backend server
npm run start:backend

# In a separate terminal, run the frontend application
npm run start
```

Use SMART HealthIT Launcher in Practitioner Context to test:
For example: https://launch.smarthealthit.org/?launch_url=http%3A%2F%2Flocalhost%3A4200%2F&launch=WzAsImJhYjdmYmJlLTliODQtNGIyYi1iNTQxLWJiMWZlNzY5NzcyYSIsIjFjYjUxMTU3LTgwODMtNDEwZi04N2QxLTA3YTk0NjI5MjIyYSIsIkFVVE8iLDAsMCwwLCIiLCIiLCIiLCIiLCIiLCIiLCIiLDAsMSwiIl0 
