# Repository Guidelines

## Project Structure & Module Organization

- Frontend: `src/app` (components, services, models, utils), assets in `src/assets`, global styles in `src/styles.scss`.
- Backend: `backend/` (Express server, routes, providers, utils). Tests in `backend/**/*.test.js`.
- Angular tests: `src/**/*.spec.ts`. Build output in `dist/`.
- Config: `angular.json`, `tsconfig*.json`, `proxy.conf.json`, lint configs in repo root.

## Build, Test, and Development Commands

- `npm run start:dev`: Run backend + Angular dev server concurrently.
- `npm run start:backend`: Start Express API (`backend/server.js`).
- `npm start`: Start Angular app at `http://localhost:4200`.
- `npm run build`: Production build to `dist/`.
- `npm test`: Run Angular unit tests (Karma/Jasmine).
- `npm run test:ci`: Headless Angular tests for CI.
- `npm run test:backend`: Run backend Jest tests.
- `npm run lint:all`: Type-check, ESLint, Stylelint, cspell, Prettier check.
- `npm run format`: Apply Prettier formatting.

## Coding Style & Naming Conventions

- Indent with 2 spaces; Prettier governs formatting (see `.prettierrc.json`, `.editorconfig`).
- TypeScript strict mode with ESLint; Angular selector prefixes: components `app-` (kebab-case), directives `app` (camelCase).
- File names: components `feature-name.component.ts/html/scss`, services `name.service.ts`, models `name.model.ts`.
- Keep Angular code in `src/app/**`; backend modules use ES modules.

## Testing Guidelines

- Frontend: Jasmine + Karma specs as `*.spec.ts` beside source; run with `npm test`.
- Backend: Jest tests in `backend/**/*.test.js`; run with `npm run test:backend`.
- Coverage: Jest collects coverage to `coverage/`; add meaningful tests for new/changed code.

## Commit & Pull Request Guidelines

- Conventional Commits enforced via commitlint/husky, e.g. `feat: add patient timeline`, `fix(auth): handle 401 on refresh)`.
- PRs: small, focused; include description, linked issues, and screenshots for UI changes. Ensure `npm run lint:all`, `npm run test:ci`, and `npm run test:backend` pass.

## Security & Configuration Tips

- Environment: copy `.env.example` to `.env`; backend also reads `backend/.env`. Set `SESSION_SECRET` and `CORS_ORIGINS` for local dev.
- Do not commit secrets; `.env` files are gitignored.
- Node version: use Node `^22` (see `package.json`).
