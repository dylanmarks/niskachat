import logger from "../utils/logger.js";
import { BaseLLMProvider } from "./baseProvider.js";

/**
 * Claude Haiku Provider
 * Connects to Anthropic's Claude API using the Haiku model
 */
export class ClaudeHaikuProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super(config);

    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.baseUrl =
      process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
    this.model = process.env.CLAUDE_MODEL || "claude-3-haiku-20240307";
    this.maxTokens = parseInt(process.env.CLAUDE_MAX_TOKENS) || 1000;
    this.temperature = parseFloat(process.env.CLAUDE_TEMPERATURE) || 0.3;
    this.timeout = parseInt(process.env.CLAUDE_TIMEOUT) || 30000;
    this.version = process.env.ANTHROPIC_VERSION || "2023-06-01";
  }

  getName() {
    return "claude-haiku";
  }

  getRequiredEnvVars() {
    return ["ANTHROPIC_API_KEY"];
  }

  async isAvailable() {
    if (!this.isConfigured()) {
      logger.warn("Claude Haiku not configured: missing ANTHROPIC_API_KEY");
      return false;
    }

    try {
      // Test with a minimal message to check API availability
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": this.version,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 10,
          messages: [
            {
              role: "user",
              content: "test",
            },
          ],
        }),
        signal: AbortSignal.timeout(10000),
      });

      return response.ok || response.status === 400; // 400 might be rate limit, but API is available
    } catch (error) {
      logger.warn(`Claude Haiku unavailable: ${error.message}`);
      return false;
    }
  }

  async generateResponse(prompt, options = {}) {
    if (!this.isConfigured()) {
      throw new Error(
        "Claude Haiku not configured: ANTHROPIC_API_KEY is required",
      );
    }

    const requestOptions = {
      model: this.model,
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature || this.temperature,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      ...options.llmOptions, // Allow override of any options
    };

    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": this.version,
        },
        body: JSON.stringify(requestOptions),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Claude API error: ${response.status} ${response.statusText}`;

        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error?.message) {
            errorMessage += ` - ${errorData.error.message}`;
          }
        } catch {
          // If we can't parse error as JSON, use the raw text
          if (errorText) {
            errorMessage += ` - ${errorText}`;
          }
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();

      // Claude API returns content in a different format
      if (result.content && result.content.length > 0) {
        return result.content[0].text || "No response generated";
      }

      return "No response generated";
    } catch (error) {
      logger.error("Claude Haiku call failed:", error);

      // Provide more specific error messages
      if (error.message.includes("401")) {
        throw new Error(
          "Claude API authentication failed. Please check your ANTHROPIC_API_KEY.",
        );
      } else if (error.message.includes("429")) {
        throw new Error(
          "Claude API rate limit exceeded. Please try again later.",
        );
      } else if (error.message.includes("timeout")) {
        throw new Error("Claude API request timed out. Please try again.");
      } else {
        throw new Error(`Claude Haiku error: ${error.message}`);
      }
    }
  }

  /**
   * Stream a response from Claude API via SSE
   * @param {string} prompt
   * @param {Object} options
   * @yields {{type: string, text?: string}}
   */
  async *streamResponse(prompt, options = {}) {
    if (!this.isConfigured()) {
      throw new Error(
        "Claude Haiku not configured: ANTHROPIC_API_KEY is required",
      );
    }

    const requestOptions = {
      model: this.model,
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature || this.temperature,
      stream: true,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      ...options.llmOptions,
    };

    const signal = options.signal
      ? AbortSignal.any([AbortSignal.timeout(this.timeout), options.signal])
      : AbortSignal.timeout(this.timeout);

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": this.version,
      },
      body: JSON.stringify(requestOptions),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Claude API error: ${response.status} ${response.statusText} ${errorText}`,
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
          "Claude stream buffer exceeded maximum safe size (512KB)",
        );
      }

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) {
          continue;
        }
        const data = trimmed.slice(5).trim();
        if (!data) {
          continue;
        }
        try {
          const parsed = JSON.parse(data);
          if (
            parsed.type === "content_block_delta" &&
            parsed.delta?.type === "text_delta" &&
            parsed.delta.text
          ) {
            yield { type: "chunk", text: parsed.delta.text };
          } else if (parsed.type === "message_stop") {
            return;
          }
        } catch {
          // Skip malformed SSE lines
        }
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
        version: this.version,
      },
    };

    if (!this.isConfigured()) {
      return {
        ...status,
        available: false,
        error: "Missing required environment variable: ANTHROPIC_API_KEY",
      };
    }

    try {
      const available = await this.isAvailable();
      return {
        ...status,
        available,
        baseUrl: this.baseUrl,
        // Don't include API key in status for security
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
