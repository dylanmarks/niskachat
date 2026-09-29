import { jest } from "@jest/globals";
import { BaseLLMProvider } from "./baseProvider.js";
import { LLMProviderFactory } from "./providerFactory.js";

class MockProvider extends BaseLLMProvider {
  constructor(name, shouldFail = false, chunks = ["Hello", " ", "World"]) {
    super();
    this.name = name;
    this.shouldFail = shouldFail;
    this.chunks = chunks;
  }

  getName() {
    return this.name;
  }

  isConfigured() {
    return true;
  }

  async isAvailable() {
    return true;
  }

  async generateResponse() {
    if (this.shouldFail) {
      throw new Error(`${this.name} failed`);
    }
    return this.chunks.join("");
  }

  async *streamResponse(_prompt, options = {}) {
    if (this.shouldFail) {
      throw new Error(`${this.name} stream error`);
    }
    for (const chunk of this.chunks) {
      if (options.signal?.aborted) {
        return;
      }
      yield { type: "chunk", text: chunk };
    }
  }

  async getStatus() {
    return { provider: this.name, available: true };
  }
}

describe("LLMProviderFactory streamResponse", () => {
  it("should stream chunks from the best provider", async () => {
    const factory = new LLMProviderFactory();
    factory.providers.clear();
    const provider1 = new MockProvider("mock-1", false, ["token1", "token2"]);
    factory.providers.set("mock-1", provider1);
    factory.preferredProvider = "mock-1";

    const chunks = [];
    for await (const chunk of factory.streamResponse("test prompt")) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({
      type: "chunk",
      text: "token1",
      provider: "mock-1",
    });
    expect(chunks[1]).toEqual({
      type: "chunk",
      text: "token2",
      provider: "mock-1",
    });
  });

  it("does not send a failed stream to a different provider", async () => {
    const factory = new LLMProviderFactory();
    factory.providers.clear();
    const failingProvider = new MockProvider("failing", true);
    const fallbackProvider = new MockProvider("backup", false, [
      "backup-chunk",
    ]);
    const fallbackStream = jest.spyOn(fallbackProvider, "streamResponse");
    factory.providers.set("failing", failingProvider);
    factory.providers.set("backup", fallbackProvider);
    factory.preferredProvider = "failing";

    await expect(async () => {
      // eslint-disable-next-line no-unused-vars
      for await (const _chunk of factory.streamResponse("test prompt")) {
        // no-op
      }
    }).rejects.toThrow("failing stream error");
    expect(fallbackStream).not.toHaveBeenCalled();
  });

  it("should respect abort signal", async () => {
    const factory = new LLMProviderFactory();
    factory.providers.clear();
    const slowProvider = new MockProvider("slow", false, [
      "chunk1",
      "chunk2",
      "chunk3",
    ]);
    factory.providers.set("slow", slowProvider);
    factory.preferredProvider = "slow";

    const controller = new AbortController();
    controller.abort();

    const chunks = [];
    for await (const chunk of factory.streamResponse("test prompt", {
      signal: controller.signal,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(0);
  });

  it("does not probe provider availability before the user's request", async () => {
    const factory = new LLMProviderFactory();
    factory.providers.clear();
    const selectedProvider = new MockProvider("selected");
    const selectedAvailability = jest.spyOn(selectedProvider, "isAvailable");
    factory.providers.set("selected", selectedProvider);
    factory.preferredProvider = "selected";

    expect(factory.getConfiguredProvider()).toBe(selectedProvider);
    await expect(factory.hasConfiguredProvider()).resolves.toBe(true);
    const status = await factory.getProvidersStatus();
    expect(status.providers.selected.configured).toBe(true);
    expect(status.providers.selected).not.toHaveProperty("available");
    expect(selectedAvailability).not.toHaveBeenCalled();
  });

  it("should throw if no providers are available", async () => {
    const factory = new LLMProviderFactory();
    factory.providers.clear();

    await expect(async () => {
      // eslint-disable-next-line no-unused-vars
      for await (const _chunk of factory.streamResponse("test prompt")) {
        // no-op
      }
    }).rejects.toThrow("Configured LLM provider is not configured");
  });
});

describe("LLMProviderFactory generateResponse", () => {
  it("does not retry clinical prompts through another provider", async () => {
    const factory = new LLMProviderFactory();
    factory.providers.clear();
    const selectedProvider = new MockProvider("selected", true);
    const otherProvider = new MockProvider("other");
    const otherGenerate = jest.spyOn(otherProvider, "generateResponse");
    factory.providers.set("selected", selectedProvider);
    factory.providers.set("other", otherProvider);
    factory.preferredProvider = "selected";

    await expect(factory.generateResponse("synthetic prompt")).rejects.toThrow(
      "selected failed",
    );
    expect(otherGenerate).not.toHaveBeenCalled();
  });
});
