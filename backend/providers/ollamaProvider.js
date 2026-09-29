import logger from "../utils/logger.js";
import { BaseLLMProvider } from "./baseProvider.js";

/**
 * Ollama provider for a caller-managed local model runtime.
 * Whether data leaves the host depends on the configured base URL and the
 * surrounding Ollama deployment.
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
    // The default local Ollama API does not require an API key.
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
        "Ollama endpoint is unavailable:",
        error?.name || "UnknownError",
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
      logger.error("Ollama generation failed:", error?.name || "UnknownError");
      if (error.name === "TimeoutError" || error.message.includes("timeout")) {
        throw new Error(
          "Ollama generation timed out. Local hardware may be under heavy load.",
        );
      }
      throw error;
    }
  }

  /**
   * Stream a response from local Ollama via NDJSON
   * @param {string} prompt
   * @param {Object} options
   * @yields {{type: string, text?: string}}
   */
  async *streamResponse(prompt, options = {}) {
    const maxTokens = options.maxTokens || this.maxTokens;
    const temperature =
      options.temperature !== undefined
        ? options.temperature
        : this.temperature;

    const requestBody = {
      model: options.model || this.model,
      prompt,
      stream: true,
      options: {
        num_predict: maxTokens,
        temperature,
      },
    };

    const signal = options.signal
      ? AbortSignal.any([AbortSignal.timeout(this.timeout), options.signal])
      : AbortSignal.timeout(this.timeout);

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      throw new Error(
        `Ollama returned status ${response.status}: ${response.statusText}`,
      );
    }

    const decoder = new TextDecoder();
    let buffer = "";
    const maxBufferSize = 512 * 1024;

    for await (const value of response.body) {
      if (options.signal?.aborted) {
        return;
      }
      buffer += decoder.decode(value, { stream: true });

      if (buffer.length > maxBufferSize) {
        throw new Error(
          "Ollama stream buffer exceeded maximum safe size (512KB)",
        );
      }

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.response) {
            yield { type: "chunk", text: parsed.response };
          }
          if (parsed.done) {
            return;
          }
        } catch {
          // Skip malformed NDJSON lines
        }
      }
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
