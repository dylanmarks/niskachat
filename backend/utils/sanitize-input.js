/**
 * Sanitize user input to prevent prompt injection attacks.
 * @param {string} input - The user input to sanitize.
 * @returns {string} - The sanitized input.
 */
function sanitizeInput(input) {
  if (typeof input !== "string") {
    return "";
  }

  // Remove characters that could be used to manipulate the prompt structure.
  // This is a basic example and may need to be adjusted based on the specific LLM's behavior.
  const sanitizedInput = input.replace(/[{}[\]":]/g, "");

  return sanitizedInput;
}

export { sanitizeInput };
