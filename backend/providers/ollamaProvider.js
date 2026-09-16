import logger from "../utils/logger.js";
import { BaseLLMProvider } from "./baseProvider.js";

/**
 * Ollama Provider (Local / Offline)
 * Connects to a local Ollama instance for completely private, zero-data-egress inference.
 * Ideal for air-gapped environments, on-prem clinical workstations, or HIPAA compliance.
 */
export class OllamaProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super(config);

    this.baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
    this.model = process.env.OLLAMA_MODEL || "llama3.1:8b";
    this.maxTokens = parseInt(process.env.OLLAMA_MAX_TOKENS, 10) || 1500;
    this.temperature = parseFloat(process.env.OLLAMA_TEMPERATURE) || 0.2;
    this.timeout = parseInt(process.env.OLLAMA_TIMEOUT, 10) || 60000;
  }

  getName() {
    return "ollama";
  }

  getRequiredEnvVars() {
    // Zero API keys required for local inference
    return [];
  }

  async isAvailable() {
    try {
      // Check if Ollama daemon is running and reachable
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch (error) {
      logger.warn(
        `Ollama local daemon unavailable at ${this.baseUrl}: ${error.message}`,
      );
      return false;
    }
  }

  async generateResponse(prompt, options = {}) {
    const maxTokens = options.maxTokens || this.maxTokens;
    const temperature =
      options.temperature !== undefined
        ? options.temperature
        : this.temperature;

    const requestBody = {
      model: options.model || this.model,
      prompt,
      stream: false,
      options: {
        num_predict: maxTokens,
        temperature,
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(
          `Ollama returned status ${response.status}: ${response.statusText}`,
        );
      }

      const data = await response.json();
      if (!data.response) {
        throw new Error("Empty response received from local Ollama model");
      }

      return data.response.trim();
    } catch (error) {
      logger.error("Ollama generation failed:", error);
      if (error.name === "TimeoutError" || error.message.includes("timeout")) {
        throw new Error(
          "Ollama generation timed out. Local hardware may be under heavy load.",
        );
      }
      throw error;
    }
  }

  async getStatus() {
    return {
      provider: this.getName(),
      model: this.model,
      configured: true,
      config: {
        baseUrl: this.baseUrl,
        maxTokens: this.maxTokens,
        temperature: this.temperature,
        timeout: this.timeout,
      },
    };
  }
}
