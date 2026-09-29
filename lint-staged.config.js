export default {
  "**/*.{js,ts,html,json}": "eslint",
  "**/*.{css,scss}": "stylelint",
  "**/*.{js,ts,css,scss,sh,html,md,json,yaml,yml}":
    "prettier --write --log-level warn",
  "**/*.{js,ts,sh,html,md}": "cspell --quiet",
  // Type-check app and Jasmine specs with their own configs; do not append file names.
  "**/*.ts": () => "npm run lint:tsc:all",
};
