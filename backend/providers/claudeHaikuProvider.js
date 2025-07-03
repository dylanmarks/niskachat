import { BaseLLMProvider } from './baseProvider.js';

/**
 * Claude Haiku Provider
 * Connects to Anthropic's Claude API using the Haiku model
 */
export class ClaudeHaikuProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super(config);
    
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
    this.model = process.env.CLAUDE_MODEL || "claude-3-haiku-20240307";
    this.maxTokens = parseInt(process.env.CLAUDE_MAX_TOKENS) || 1000;
    this.temperature = parseFloat(process.env.CLAUDE_TEMPERATURE) || 0.3;
    this.timeout = parseInt(process.env.CLAUDE_TIMEOUT) || 30000;
    this.version = process.env.ANTHROPIC_VERSION || "2023-06-01";
  }

  getName() {
    return 'claude-haiku';
  }

  getRequiredEnvVars() {
    return ['ANTHROPIC_API_KEY'];
  }

  async isAvailable() {
    if (!this.isConfigured()) {
      console.log('Claude Haiku not configured: missing ANTHROPIC_API_KEY');
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
          messages: [{
            role: "user",
            content: "test"
          }]
        }),
        signal: AbortSignal.timeout(10000),
      });

      return response.ok || response.status === 400; // 400 might be rate limit, but API is available
    } catch (error) {
      console.log(`Claude Haiku unavailable: ${error.message}`);
      return false;
    }
  }

  async generateResponse(prompt, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Claude Haiku not configured: ANTHROPIC_API_KEY is required');
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
      console.error("Claude Haiku call failed:", error);
      
      // Provide more specific error messages
      if (error.message.includes('401')) {
        throw new Error('Claude API authentication failed. Please check your ANTHROPIC_API_KEY.');
      } else if (error.message.includes('429')) {
        throw new Error('Claude API rate limit exceeded. Please try again later.');
      } else if (error.message.includes('timeout')) {
        throw new Error('Claude API request timed out. Please try again.');
      } else {
        throw new Error(`Claude Haiku error: ${error.message}`);
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
        error: 'Missing required environment variable: ANTHROPIC_API_KEY',
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