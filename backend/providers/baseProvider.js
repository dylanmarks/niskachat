/**
 * Base LLM Provider Interface
 * All LLM providers must implement these methods
 */
export class BaseLLMProvider {
  constructor(config) {
    this.config = config;
  }

  /**
   * Check if the provider is properly configured and available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error('isAvailable() must be implemented by provider');
  }

  /**
   * Generate a response from the LLM
   * @param {string} prompt - The prompt to send to the LLM
   * @param {Object} options - Additional options for the request
   * @returns {Promise<string>} - The LLM response
   */
  async generateResponse(prompt, options = {}) {
    throw new Error('generateResponse() must be implemented by provider');
  }

  /**
   * Get provider-specific status information
   * @returns {Promise<Object>}
   */
  async getStatus() {
    throw new Error('getStatus() must be implemented by provider');
  }

  /**
   * Get the provider name
   * @returns {string}
   */
  getName() {
    throw new Error('getName() must be implemented by provider');
  }

  /**
   * Get provider-specific configuration requirements
   * @returns {Array<string>} - Array of required environment variables
   */
  getRequiredEnvVars() {
    return [];
  }

  /**
   * Validate that all required configuration is present
   * @returns {boolean}
   */
  isConfigured() {
    const requiredVars = this.getRequiredEnvVars();
    return requiredVars.every(varName => process.env[varName]);
  }
}