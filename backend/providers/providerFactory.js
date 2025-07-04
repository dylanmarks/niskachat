import { LocalLlamaProvider } from './localLlamaProvider.js';
import { ClaudeHaikuProvider } from './claudeHaikuProvider.js';

/**
 * LLM Provider Factory
 * Manages multiple LLM providers and determines which one to use
 */
export class LLMProviderFactory {
  constructor() {
    this.providers = new Map();
    this.preferredProvider = process.env.LLM_PROVIDER || 'claude-haiku';
    this.fallbackProvider = process.env.LLM_FALLBACK_PROVIDER || 'local-llama';
    
    this.initializeProviders();
  }

  /**
   * Initialize all available providers
   */
  initializeProviders() {
    // Initialize Claude Haiku provider
    const claudeProvider = new ClaudeHaikuProvider();
    this.providers.set('claude-haiku', claudeProvider);

    // Initialize Local Llama provider
    const llamaProvider = new LocalLlamaProvider();
    this.providers.set('local-llama', llamaProvider);

    console.log(`LLM Provider Factory initialized with providers: ${Array.from(this.providers.keys()).join(', ')}`);
    console.log(`Preferred provider: ${this.preferredProvider}`);
    console.log(`Fallback provider: ${this.fallbackProvider}`);
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
    // First try the preferred provider
    const preferred = this.providers.get(this.preferredProvider);
    if (preferred && preferred.isConfigured() && await preferred.isAvailable()) {
      console.log(`Using preferred provider: ${this.preferredProvider}`);
      return preferred;
    }

    // If preferred is not available, try fallback
    const fallback = this.providers.get(this.fallbackProvider);
    if (fallback && fallback.isConfigured() && await fallback.isAvailable()) {
      console.log(`Using fallback provider: ${this.fallbackProvider}`);
      return fallback;
    }

    // If both preferred and fallback fail, try any other configured provider
    for (const [name, provider] of this.providers) {
      if (name !== this.preferredProvider && name !== this.fallbackProvider) {
        if (provider.isConfigured() && await provider.isAvailable()) {
          console.log(`Using alternative provider: ${name}`);
          return provider;
        }
      }
    }

    console.log('No LLM providers are available');
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
      throw new Error('No LLM providers are available');
    }

    try {
      const response = await provider.generateResponse(prompt, options);
      return {
        response,
        provider: provider.getName(),
      };
    } catch (error) {
      // If the provider fails, try another one
      console.log(`Provider ${provider.getName()} failed: ${error.message}`);
      
      // Try other providers
      for (const [name, fallbackProvider] of this.providers) {
        if (name !== provider.getName() && fallbackProvider.isConfigured()) {
          try {
            if (await fallbackProvider.isAvailable()) {
              console.log(`Trying fallback provider: ${name}`);
              const response = await fallbackProvider.generateResponse(prompt, options);
              return {
                response,
                provider: fallbackProvider.getName(),
              };
            }
          } catch (fallbackError) {
            console.log(`Fallback provider ${name} also failed: ${fallbackError.message}`);
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
      fallbackProvider: this.fallbackProvider,
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