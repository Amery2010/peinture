import { describe, it, expect, beforeEach, vi } from "vitest";


// Mock configStore to prevent circular import initialization errors
vi.mock("../store/configStore", () => ({
  useConfigStore: {
    getState: () => ({
      serviceMode: "local",
      storageType: "opfs",
      systemPrompt: "",
      translationPrompt: "",
      editModelConfig: { provider: "huggingface", model: "test" },
      liveModelConfig: { provider: "huggingface", model: "test" },
      textModelConfig: { provider: "huggingface", model: "test" },
      upscalerModelConfig: { provider: "huggingface", model: "test" },
      videoSettings: {},
      customProviders: [],
      tokens: { huggingface: [], gitee: [], modelscope: [], a4f: [] },
      tokenStatus: {
        huggingface: { date: "", exhausted: {} },
        gitee: { date: "", exhausted: {} },
        modelscope: { date: "", exhausted: {} },
        a4f: { date: "", exhausted: {} },
      },
    }),
  },
}));

import { addToPromptHistory } from "../services/utils";

describe("addToPromptHistory", () => {
  beforeEach(() => {
    try {
      sessionStorage.clear();
    } catch {
      const keys = Object.keys(sessionStorage);
      keys.forEach((key) => sessionStorage.removeItem(key));
    }
  });

  it("should add a prompt to history", () => {
    addToPromptHistory("a beautiful sunset");

    const stored = JSON.parse(sessionStorage.getItem("prompt_history") || "[]");
    expect(stored).toEqual(["a beautiful sunset"]);
  });

  it("should add newest prompt to the front", () => {
    addToPromptHistory("first prompt");
    addToPromptHistory("second prompt");

    const stored = JSON.parse(sessionStorage.getItem("prompt_history") || "[]");
    expect(stored[0]).toBe("second prompt");
    expect(stored[1]).toBe("first prompt");
  });

  it("should deduplicate existing prompts", () => {
    addToPromptHistory("repeated prompt");
    addToPromptHistory("other prompt");
    addToPromptHistory("repeated prompt");

    const stored = JSON.parse(sessionStorage.getItem("prompt_history") || "[]");
    expect(stored).toEqual(["repeated prompt", "other prompt"]);
  });

  it("should trim whitespace", () => {
    addToPromptHistory("  trimmed  ");

    const stored = JSON.parse(sessionStorage.getItem("prompt_history") || "[]");
    expect(stored).toEqual(["trimmed"]);
  });

  it("should skip empty strings", () => {
    addToPromptHistory("");
    addToPromptHistory("   ");

    const stored = sessionStorage.getItem("prompt_history");
    expect(stored).toBeNull();
  });

  it("should limit to 50 entries", () => {
    for (let i = 0; i < 60; i++) {
      addToPromptHistory(`prompt ${i}`);
    }

    const stored = JSON.parse(sessionStorage.getItem("prompt_history") || "[]");
    expect(stored).toHaveLength(50);
    expect(stored[0]).toBe("prompt 59");
  });
});
