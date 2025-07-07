import { BaseLLMProvider } from './baseProvider.js';
import logger from '../utils/logger.js';

/**
 * Local Llama.cpp Provider
 * Connects to a local llama.cpp server
 */
export class LocalLlamaProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super(config);
    
    this.url = process.env.LLAMA_URL || process.env.LLM_URL || "http://127.0.0.1:8081";
    this.timeout = parseInt(process.env.LLAMA_TIMEOUT || process.env.LLM_TIMEOUT) || 15000;
    this.maxTokens = parseInt(process.env.LLAMA_MAX_TOKENS || process.env.LLM_MAX_TOKENS) || 300;
    this.temperature = parseFloat(process.env.LLAMA_TEMPERATURE || process.env.LLM_TEMPERATURE) || 0.3;
    this.model = process.env.LLAMA_MODEL || "biomistral";
  }

  getName() {
    return 'local-llama';
  }

  getRequiredEnvVars() {
    // Local llama doesn't require API keys, just URL configuration
    return [];
  }

  async isAvailable() {
    try {
      const response = await fetch(`${this.url}/v1/models`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      logger.warn(`Local Llama unavailable: ${error.message}`);
      return false;
    }
  }

  async generateResponse(prompt, options = {}) {
    const requestOptions = {
      model: this.model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature || this.temperature,
      stream: false,
      ...options.llmOptions, // Allow override of any options
    };

    try {
      const response = await fetch(`${this.url}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestOptions),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(
          `Local Llama API error: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      return result.choices?.[0]?.message?.content || "No response generated";
    } catch (error) {
      logger.error("Local Llama call failed:", error);
      throw new Error(`Local Llama error: ${error.message}`);
    }
  }

  async getStatus() {
    try {
      const response = await fetch(`${this.url}/v1/models`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const models = await response.json();
        return {
          available: true,
          provider: this.getName(),
          url: this.url,
          model: this.model,
          models: models.data || [],
          config: {
            maxTokens: this.maxTokens,
            temperature: this.temperature,
            timeout: this.timeout,
          },
        };
      } else {
        return {
          available: false,
          provider: this.getName(),
          error: `Server responded with ${response.status}`,
        };
      }
    } catch (error) {
      return {
        available: false,
        provider: this.getName(),
        error: error.message,
      };
    }
  }
}