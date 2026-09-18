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

  it("should fall back to next provider if first provider fails before emitting chunks", async () => {
    const factory = new LLMProviderFactory();
    factory.providers.clear();
    const failingProvider = new MockProvider("failing", true);
    const fallbackProvider = new MockProvider("backup", false, [
      "backup-chunk",
    ]);
    factory.providers.set("failing", failingProvider);
    factory.providers.set("backup", fallbackProvider);

    const chunks = [];
    for await (const chunk of factory.streamResponse("test prompt")) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      type: "chunk",
      text: "backup-chunk",
      provider: "backup",
    });
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

  it("should throw if no providers are available", async () => {
    const factory = new LLMProviderFactory();
    factory.providers.clear();

    await expect(async () => {
      // eslint-disable-next-line no-unused-vars
      for await (const _chunk of factory.streamResponse("test prompt")) {
        // no-op
      }
    }).rejects.toThrow("No LLM providers are available");
  });
});
