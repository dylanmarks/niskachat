import logger from "../utils/logger.js";
import { ClaudeHaikuProvider } from "./claudeHaikuProvider.js";
import { GeminiVertexProvider } from "./geminiVertexProvider.js";
import { OllamaProvider } from "./ollamaProvider.js";
import { OpenRouterProvider } from "./openRouterProvider.js";

/**
 * LLM Provider Factory
 * Manages LLM providers and determines which one to use
 */
export class LLMProviderFactory {
  constructor() {
    this.providers = new Map();
    this.preferredProvider = process.env.LLM_PROVIDER || "openrouter";

    this.initializeProviders();
  }

  /**
   * Initialize all available providers
   */
  initializeProviders() {
    // 1. OpenRouter (Unified API for Claude, Llama, DeepSeek, etc.)
    const openRouterProvider = new OpenRouterProvider();
    this.providers.set("openrouter", openRouterProvider);

    // 2. Ollama (Local / Offline inference)
    const ollamaProvider = new OllamaProvider();
    this.providers.set("ollama", ollamaProvider);

    // 3. Direct Claude Haiku
    const claudeProvider = new ClaudeHaikuProvider();
    this.providers.set("claude-haiku", claudeProvider);

    // 4. Direct Gemini
    const geminiProvider = new GeminiVertexProvider();
    this.providers.set("gemini-vertex", geminiProvider);

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
   * Resolve only the explicitly configured provider.
   *
   * Clinical context must never be sent to a different provider as an implicit
   * retry: each provider has a distinct data-processing boundary.
   * @returns {Promise<BaseLLMProvider|null>}
   */
  async getBestProvider() {
    const provider = this.providers.get(this.preferredProvider);
    if (
      !provider ||
      !provider.isConfigured() ||
      !(await provider.isAvailable())
    ) {
      logger.warn(
        `Configured LLM provider is unavailable: ${this.preferredProvider}`,
      );
      return null;
    }

    return provider;
  }

  /**
   * Generate a response using only the explicitly configured provider.
   * @param {string} prompt
   * @param {Object} options
   * @returns {Promise<{response: string, provider: string}>}
   */
  async generateResponse(prompt, options = {}) {
    const provider = await this.getBestProvider();
    if (!provider) {
      throw new Error(
        `Configured LLM provider is unavailable: ${this.preferredProvider}`,
      );
    }

    const response = await provider.generateResponse(prompt, options);
    return {
      response,
      provider: provider.getName(),
    };
  }

  /**
   * Stream from the explicitly configured provider. Provider failures are
   * surfaced instead of retrying the prompt across another data boundary.
   * @param {string} prompt
   * @param {Object} options
   * @yields {{type: string, text?: string, provider?: string}}
   */
  async *streamResponse(prompt, options = {}) {
    const provider = await this.getBestProvider();
    if (!provider) {
      throw new Error(
        `Configured LLM provider is unavailable: ${this.preferredProvider}`,
      );
    }

    for await (const chunk of provider.streamResponse(prompt, options)) {
      yield { ...chunk, provider: provider.getName() };
    }
  }

  /**
   * Get status of all providers
   * @returns {Promise<Object>}
   */
  async getProvidersStatus() {
    const provider = this.providers.get(this.preferredProvider);
    const status = {
      preferredProvider: this.preferredProvider,
      fallbackEnabled: false,
      providers: {},
    };

    if (!provider) {
      return status;
    }

    let available = false;
    try {
      available = provider.isConfigured() && (await provider.isAvailable());
    } catch {
      available = false;
    }

    const destination = this.getProviderDestination(provider);
    status.providers[this.preferredProvider] = {
      provider: this.preferredProvider,
      model: provider.model || null,
      configured: provider.isConfigured(),
      available,
      destination,
      processingBoundary:
        this.preferredProvider === "ollama"
          ? "Ollama-compatible endpoint; confirm where that endpoint runs"
          : "External model provider; data leaves this application host",
    };

    return status;
  }

  getProviderDestination(provider) {
    if (provider.baseUrl) {
      try {
        return new URL(provider.baseUrl).origin;
      } catch {
        return "Configured provider endpoint";
      }
    }

    if (provider.getName() === "gemini-vertex") {
      return "Google Gemini API";
    }

    return "Provider endpoint configured by its SDK";
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
