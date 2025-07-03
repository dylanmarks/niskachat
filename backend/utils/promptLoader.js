import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for loaded prompts to avoid file reads on every request
const promptCache = new Map();

/**
 * Load a prompt template from the prompts directory
 * @param {string} promptName - Name of the prompt file (without .txt extension)
 * @returns {string} The prompt template content
 */
export function loadPrompt(promptName) {
  // Check cache first
  if (promptCache.has(promptName)) {
    return promptCache.get(promptName);
  }

  try {
    const promptPath = path.join(__dirname, '../prompts', `${promptName}.txt`);
    const promptContent = fs.readFileSync(promptPath, 'utf-8');
    
    // Cache the prompt for future use
    promptCache.set(promptName, promptContent);
    
    return promptContent;
  } catch (error) {
    console.error(`Failed to load prompt '${promptName}':`, error.message);
    throw new Error(`Prompt template '${promptName}' not found`);
  }
}

/**
 * Format a prompt template by replacing placeholders with actual values
 * @param {string} template - The prompt template with placeholders
 * @param {Object} variables - Key-value pairs for placeholder replacement
 * @returns {string} The formatted prompt
 */
export function formatPrompt(template, variables = {}) {
  let formatted = template;
  
  // Replace all placeholders in the format {variableName}
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    formatted = formatted.replace(new RegExp(placeholder, 'g'), value || '');
  }
  
  return formatted;
}

/**
 * Load and format a prompt in one call
 * @param {string} promptName - Name of the prompt file
 * @param {Object} variables - Variables for placeholder replacement
 * @returns {string} The loaded and formatted prompt
 */
export function getFormattedPrompt(promptName, variables = {}) {
  const template = loadPrompt(promptName);
  return formatPrompt(template, variables);
}

/**
 * Clear the prompt cache (useful for development/testing)
 */
export function clearPromptCache() {
  promptCache.clear();
}

/**
 * Reload a specific prompt (useful for development)
 * @param {string} promptName - Name of the prompt to reload
 */
export function reloadPrompt(promptName) {
  promptCache.delete(promptName);
  return loadPrompt(promptName);
}