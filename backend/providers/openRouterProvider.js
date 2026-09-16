import logger from "../utils/logger.js";
import { BaseLLMProvider } from "./baseProvider.js";

/**
 * OpenRouter Provider
 * Connects to OpenRouter's unified API for accessing various AI models
 * (Claude 3.5 Sonnet/Haiku, Llama 3.3 70B, DeepSeek, etc.)
 */
export class OpenRouterProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super(config);

    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseUrl =
      process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
    this.model = process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-haiku";
    this.maxTokens = parseInt(process.env.OPENROUTER_MAX_TOKENS, 10) || 1500;
    this.temperature = parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.2;
    this.timeout = parseInt(process.env.OPENROUTER_TIMEOUT, 10) || 45000;
    this.siteUrl =
      process.env.OPENROUTER_SITE_URL ||
      "https://github.com/dylanmarks/niskachat";
    this.siteName = process.env.OPENROUTER_SITE_NAME || "NiskaChat FHIR Viewer";
  }

  getName() {
    return "openrouter";
  }

  getRequiredEnvVars() {
    return ["OPENROUTER_API_KEY"];
  }

  async isAvailable() {
    if (!this.isConfigured()) {
      logger.warn("OpenRouter not configured: missing OPENROUTER_API_KEY");
      return false;
    }

    try {
      // Lightweight auth validation against OpenRouter's models endpoint
      const response = await fetch(`${this.baseUrl}/auth/key`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      return response.ok;
    } catch (error) {
      logger.warn(`OpenRouter check failed: ${error.message}`);
      return false;
    }
  }

  async generateResponse(prompt, options = {}) {
    if (!this.isConfigured()) {
      throw new Error(
        "OpenRouter not configured: OPENROUTER_API_KEY is required",
      );
    }

    const maxTokens = options.maxTokens || this.maxTokens;
    const temperature =
      options.temperature !== undefined
        ? options.temperature
        : this.temperature;

    const requestBody = {
      model: options.model || this.model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: maxTokens,
      temperature,
      ...options.llmOptions,
    };

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": this.siteUrl,
          "X-Title": this.siteName,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `OpenRouter API error: ${response.status} ${response.statusText}`;

        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            errorMessage = `OpenRouter API error: ${errorJson.error.message}`;
          }
        } catch {
          // Keep default message if not parseable JSON
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error("Empty response received from OpenRouter API");
      }

      return text.trim();
    } catch (error) {
      logger.error("OpenRouter API call failed:", error);

      if (
        error.message.includes("401") ||
        error.message.toLowerCase().includes("unauthorized")
      ) {
        throw new Error(
          "OpenRouter API authentication failed. Please check your OPENROUTER_API_KEY.",
        );
      } else if (
        error.message.includes("429") ||
        error.message.toLowerCase().includes("rate limit")
      ) {
        throw new Error(
          "OpenRouter rate limit exceeded or credit exhausted. Please check your account.",
        );
      } else if (error.message.includes("timeout")) {
        throw new Error("OpenRouter API request timed out. Please try again.");
      }

      throw error;
    }
  }

  async getStatus() {
    return {
      provider: this.getName(),
      model: this.model,
      configured: this.isConfigured(),
      config: {
        maxTokens: this.maxTokens,
        temperature: this.temperature,
        timeout: this.timeout,
        baseUrl: this.baseUrl,
      },
    };
  }
}
