import { GoogleGenAI } from "@google/genai";
import logger from "../utils/logger.js";
import { BaseLLMProvider } from "./baseProvider.js";

/**
 * Gemini Vertex Provider
 * Connects to Google's Gemini API using an API key
 */
export class GeminiVertexProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super(config);

    this.apiKey = process.env.GEMINI_API_KEY;
    this.model = process.env.GEMINI_MODEL || "gemini-2.5-pro";
    this.maxTokens = parseInt(process.env.GEMINI_MAX_TOKENS) || 1000;
    this.temperature = parseFloat(process.env.GEMINI_TEMPERATURE) || 0.3;
    this.timeout = parseInt(process.env.GEMINI_TIMEOUT) || 30000;

    this.ai = null;
  }

  getName() {
    return "gemini-vertex";
  }

  getRequiredEnvVars() {
    return ["GEMINI_API_KEY"];
  }

  async _initializeClient() {
    if (!this.ai && this.apiKey) {
      try {
        this.ai = new GoogleGenAI({
          apiKey: this.apiKey,
        });
      } catch (error) {
        logger.error("Failed to initialize Gemini client:", error);
        throw error;
      }
    }
    return this.ai;
  }

  async isAvailable() {
    if (!this.isConfigured()) {
      logger.warn("Gemini Vertex not configured: missing GEMINI_API_KEY");
      return false;
    }

    try {
      // Initialize client and test with a minimal message to check API availability
      const ai = await this._initializeClient();

      const response = await Promise.race([
        ai.models.generateContent({
          model: `models/${this.model}`,
          contents: [
            {
              parts: [{ text: "test" }],
              role: "user",
            },
          ],
          generationConfig: {
            maxOutputTokens: 10,
            temperature: this.temperature,
          },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 10000),
        ),
      ]);

      return response && (response.candidates?.length > 0 || response.error);
    } catch (error) {
      logger.warn(`Gemini Vertex unavailable: ${error.message}`);
      return false;
    }
  }

  async generateResponse(prompt, options = {}) {
    if (!this.isConfigured()) {
      throw new Error(
        "Gemini Vertex not configured: GEMINI_API_KEY is required",
      );
    }

    try {
      const ai = await this._initializeClient();

      const requestOptions = {
        model: `models/${this.model}`,
        contents: [
          {
            parts: [{ text: prompt }],
            role: "user",
          },
        ],
        generationConfig: {
          maxOutputTokens: options.maxTokens || this.maxTokens,
          temperature: options.temperature || this.temperature,
          ...options.llmOptions?.generationConfig, // Allow override of generation config
        },
        ...options.llmOptions, // Allow override of any options
      };

      const response = await Promise.race([
        ai.models.generateContent(requestOptions),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), this.timeout),
        ),
      ]);

      if (response.error) {
        throw new Error(
          `Gemini API error: ${response.error.message || response.error}`,
        );
      }

      // Extract text from Gemini response
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (
          candidate.content &&
          candidate.content.parts &&
          candidate.content.parts.length > 0
        ) {
          return candidate.content.parts[0].text || "No response generated";
        }
      }

      return "No response generated";
    } catch (error) {
      logger.error("Gemini Vertex call failed:", error);

      // Provide more specific error messages
      if (
        error.message.includes("401") ||
        error.message.includes("authentication")
      ) {
        throw new Error(
          "Gemini API authentication failed. Please check your GEMINI_API_KEY.",
        );
      } else if (
        error.message.includes("429") ||
        error.message.includes("quota")
      ) {
        throw new Error(
          "Gemini API rate limit or quota exceeded. Please try again later.",
        );
      } else if (error.message.includes("timeout")) {
        throw new Error("Gemini API request timed out. Please try again.");
      } else {
        throw new Error(`Gemini Vertex error: ${error.message}`);
      }
    }
  }

  async getStatus() {
    const status = {
      provider: this.getName(),
      model: this.model,
      configured: this.isConfigured(),
      config: {
        maxTokens: this.maxTokens,
        temperature: this.temperature,
        timeout: this.timeout,
        model: this.model,
      },
    };

    if (!this.isConfigured()) {
      return {
        ...status,
        available: false,
        error: "Missing required environment variable: GEMINI_API_KEY",
      };
    }

    try {
      const available = await this.isAvailable();
      return {
        ...status,
        available,
        hasApiKey: !!this.apiKey,
      };
    } catch (error) {
      return {
        ...status,
        available: false,
        error: error.message,
      };
    }
  }
}
