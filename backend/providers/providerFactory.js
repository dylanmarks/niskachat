import logger from "../utils/logger.js";
import { ClaudeHaikuProvider } from "./claudeHaikuProvider.js";

/**
 * LLM Provider Factory
 * Manages LLM providers and determines which one to use
 */
export class LLMProviderFactory {
  constructor() {
    this.providers = new Map();
    this.preferredProvider = process.env.LLM_PROVIDER || "claude-haiku";

    this.initializeProviders();
  }

  /**
   * Initialize all available providers
   */
  initializeProviders() {
    // Initialize Claude Haiku provider
    const claudeProvider = new ClaudeHaikuProvider();
    this.providers.set("claude-haiku", claudeProvider);

    logger.info(
      `LLM Provider Factory initialized with providers: ${Array.from(this.providers.keys()).join(", ")}`,
    );
    logger.info(`Preferred provider: ${this.preferredProvider}`);
  }

  /**
   * Get a specific provider by name
   * @param {string} providerName
   * @returns {BaseLLMProvider|null}
   */
  getProvider(providerName) {
    return this.providers.get(providerName) || null;
  }

  /**
   * Get all available providers
   * @returns {Map<string, BaseLLMProvider>}
   */
  getAllProviders() {
    return this.providers;
  }

  /**
   * Get the best available provider based on configuration and availability
   * @returns {Promise<BaseLLMProvider|null>}
   */
  async getBestProvider() {
    // Try the preferred provider
    const preferred = this.providers.get(this.preferredProvider);
    if (
      preferred &&
      preferred.isConfigured() &&
      (await preferred.isAvailable())
    ) {
      logger.info(`Using preferred provider: ${this.preferredProvider}`);
      return preferred;
    }

    // If preferred is not available, try any other configured provider
    for (const [name, provider] of this.providers) {
      if (name !== this.preferredProvider) {
        if (provider.isConfigured() && (await provider.isAvailable())) {
          logger.info(`Using alternative provider: ${name}`);
          return provider;
        }
      }
    }

    logger.warn("No LLM providers are available");
    return null;
  }

  /**
   * Generate a response using the best available provider
   * @param {string} prompt
   * @param {Object} options
   * @returns {Promise<{response: string, provider: string}>}
   */
  async generateResponse(prompt, options = {}) {
    const provider = await this.getBestProvider();

    if (!provider) {
      throw new Error("No LLM providers are available");
    }

    try {
      const response = await provider.generateResponse(prompt, options);
      return {
        response,
        provider: provider.getName(),
      };
    } catch (error) {
      // If the provider fails, try another one
      logger.warn(`Provider ${provider.getName()} failed: ${error.message}`);

      // Try other providers
      for (const [name, fallbackProvider] of this.providers) {
        if (name !== provider.getName() && fallbackProvider.isConfigured()) {
          try {
            if (await fallbackProvider.isAvailable()) {
              logger.info(`Trying fallback provider: ${name}`);
              const response = await fallbackProvider.generateResponse(
                prompt,
                options,
              );
              return {
                response,
                provider: fallbackProvider.getName(),
              };
            }
          } catch (fallbackError) {
            logger.warn(
              `Fallback provider ${name} also failed: ${fallbackError.message}`,
            );
          }
        }
      }

      // If all providers fail, throw the original error
      throw error;
    }
  }

  /**
   * Get status of all providers
   * @returns {Promise<Object>}
   */
  async getProvidersStatus() {
    const status = {
      preferredProvider: this.preferredProvider,
      providers: {},
    };

    for (const [name, provider] of this.providers) {
      try {
        status.providers[name] = await provider.getStatus();
      } catch (error) {
        status.providers[name] = {
          provider: name,
          available: false,
          error: error.message,
        };
      }
    }

    return status;
  }

  /**
   * Check if any provider is available
   * @returns {Promise<boolean>}
   */
  async hasAvailableProvider() {
    const provider = await this.getBestProvider();
    return provider !== null;
  }
}

// Singleton instance
let factoryInstance = null;

/**
 * Get the singleton LLM Provider Factory instance
 * @returns {LLMProviderFactory}
 */
export function getLLMProviderFactory() {
  if (!factoryInstance) {
    factoryInstance = new LLMProviderFactory();
  }
  return factoryInstance;
}

/**
 * Reset the singleton instance (useful for testing or when env vars change)
 */
export function resetLLMProviderFactory() {
  factoryInstance = null;
}
