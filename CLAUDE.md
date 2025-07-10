# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (Angular)

- `npm start` - Start Angular dev server on port 4200
- `npm run build` - Build for production
- `npm run watch` - Build with watch mode for development
- `npm test` - Run frontend tests with Karma/Jasmine
- `npm run test:ci` - Run tests in headless mode for CI

### Backend (Node.js/Express)

- `npm run start:backend` - Start backend server on port 3000
- `npm run test:backend` - Run backend Jest tests
- `npm run test:backend:watch` - Run backend tests in watch mode

### Development Workflow

- `npm run start:dev` - Start both frontend and backend concurrently
- `npm run reload-prompts` - Reload LLM prompts from disk
- `npm run test-providers` - Test LLM provider connectivity

### Code Quality

- `npm run lint` - Run ESLint on all TypeScript and JavaScript files
- `npm run lint:tsc:all` - Run TypeScript compiler checks for both app and spec files
- `npm run lint:style` - Run stylelint on CSS/SCSS files
- `npm run lint:spelling` - Run cspell for spell checking
- `npm run lint:format` - Check Prettier formatting
- `npm run lint:all` - Run all linting checks
- `npm run format` - Format code with Prettier
- `npm run ci:all` - Run all linting and tests for CI

## Architecture Overview

### Project Structure

NiskaChat is a FHIR Bundle Viewer and SMART on FHIR-compliant web application with:

- **Frontend**: Angular 20+ with Material Design, Chart.js for visualizations
- **Backend**: Node.js/Express API with LLM integration
- **Authentication**: SMART on FHIR OAuth2 with PKCE
- **Data Sources**: SMART Sandbox, static FHIR Bundle uploads, future Google Cloud Healthcare API

### Core Components

#### Frontend (src/app/components/)

- `smart-launch/` - SMART on FHIR authentication flow
- `patient-summary/` - Patient demographics and identifiers
- `conditions-list/` - Patient conditions display
- `medications-list/` - Medication requests display
- `observations-chart/` - Time-series charts for labs/vitals using Chart.js
- `chat/` - LLM-powered chat interface for clinical data
- `file-upload/` - Static FHIR Bundle upload for offline mode

#### Backend (backend/)

- `server.js` - Main Express server with CORS, security middleware
- `routes/auth.js` - SMART on FHIR authentication endpoints
- `routes/llm.js` - LLM summarization and chat endpoints
- `routes/proxy.js` - FHIR API proxy for secure token handling
- `providers/` - LLM provider abstraction (Claude Haiku via Bedrock)
- `utils/logger.js` - Centralized logging (NO console.log allowed in app code)
- `utils/fhirBundleCompressor.js` - FHIR data compression utilities

#### Key Services

- `FhirClientService` - FHIR client wrapper with offline mode support
- `LLMProviderFactory` - Manages multiple LLM providers with fallback

### Configuration

- Angular app named "extreme-angular" in angular.json (legacy name)
- ESLint with strict TypeScript checking, some rules temporarily set to "warn"
- Proxy configuration routes `/api/**` to backend on localhost:3000
- Jest for backend testing, Karma/Jasmine for frontend testing

### Environment Setup

Backend requires:

- `SESSION_SECRET` - Session encryption secret
- `CORS_ORIGINS` - Comma-separated allowed origins (defaults to localhost:4200)
- `LLM_PROVIDER` - Preferred LLM provider (defaults to "claude-haiku")

### Development Notes

- Uses custom logger service in both frontend and backend - never use console.log directly
- FHIR resources are mapped to TypeScript interfaces in FhirClientService
- Supports both online SMART on FHIR mode and offline static bundle mode
- LLM integration is optional and falls back gracefully when not configured
- Angular Material theme in src/themes/theme.scss

### Testing Strategy

- TDD approach with test cases defined before implementation
- Backend tests use Jest with Supertest for API testing
- Frontend tests use Karma/Jasmine
- Comprehensive test coverage for FHIR resource parsing and LLM integration
