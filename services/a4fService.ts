
import { GeneratedImage, AspectRatioOption, ModelOption } from "../types";
import { generateUUID, getSystemPromptContent, FIXED_SYSTEM_PROMPT_SUFFIX } from "./utils";
import { API_MODEL_MAP } from "../constants";

const A4F_GENERATE_API_URL = "https://api.a4f.co/v1/images/generations";
const A4F_CHAT_API_URL = "https://api.a4f.co/v1/chat/completions";

const TOKEN_STORAGE_KEY = 'a4fToken';
const TOKEN_STATUS_KEY = 'a4f_token_status';

interface TokenStatusStore {
  date: string; // YYYY-MM-DD
  exhausted: Record<string, boolean>;
}

const getUTCDatesString = () => new Date().toISOString().split('T')[0];

const getTokenStatusStore = (): TokenStatusStore => {
  const defaultStore = { date: getUTCDatesString(), exhausted: {} };
  if (typeof localStorage === 'undefined') return defaultStore;

  try {
    const raw = localStorage.getItem(TOKEN_STATUS_KEY);
    if (!raw) return defaultStore;
    const store = JSON.parse(raw);
    if (store.date !== getUTCDatesString()) {
      return defaultStore;
    }
    return store;
  } catch {
    return defaultStore;
  }
};

const saveTokenStatusStore = (store: TokenStatusStore) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(TOKEN_STATUS_KEY, JSON.stringify(store));
  }
};

export const getA4FTokens = (rawInput?: string | null): string[] => {
  const input = rawInput !== undefined ? rawInput : (typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : '');
  if (!input) return [];
  return input.split(',').map(t => t.trim()).filter(t => t.length > 0);
};

export const getA4FTokenStats = (rawInput: string) => {
  const tokens = getA4FTokens(rawInput);
  const store = getTokenStatusStore();
  const total = tokens.length;
  const exhausted = tokens.filter(t => store.exhausted[t]).length;
  return {
    total,
    exhausted,
    active: total - exhausted
  };
};

const getNextAvailableToken = (): string | null => {
  const tokens = getA4FTokens();
  const store = getTokenStatusStore();
  return tokens.find(t => !store.exhausted[t]) || null;
};

const markTokenExhausted = (token: string) => {
  const store = getTokenStatusStore();
  store.exhausted[token] = true;
  saveTokenStatusStore(store);
};

const runWithA4FTokenRetry = async <T>(operation: (token: string) => Promise<T>): Promise<T> => {
  const tokens = getA4FTokens();

  if (tokens.length === 0) {
      throw new Error("error_a4f_token_required");
  }

  let lastError: any;
  let attempts = 0;
  const maxAttempts = tokens.length + 1;

  while (attempts < maxAttempts) {
    attempts++;
    const token = getNextAvailableToken();

    if (!token) {
       throw new Error("error_a4f_token_exhausted");
    }

    try {
      return await operation(token);
    } catch (error: any) {
      lastError = error;

      if (error.name === 'AbortError') {
        throw error;
      }

      const isQuotaError =
        error.message?.includes("429") ||
        error.status === 429 ||
        error.message?.includes("insufficient_quota") ||
        error.message?.includes("quota");

      if (isQuotaError && token) {
        console.warn(`A4F Token ${token.substring(0, 8)}... exhausted/error. Switching to next token.`);
        markTokenExhausted(token);
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error("error_api_connection");
};

// --- Dimensions Logic ---

const getBaseDimensions = (ratio: AspectRatioOption) => {
    switch(ratio) {
        case "16:9": return { width: 1024, height: 576 };
        case "4:3": return { width: 1024, height: 768 };
        case "3:2": return { width: 960, height: 640 };
        case "9:16": return { width: 576, height: 1024 };
        case "3:4": return { width: 768, height: 1024 };
        case "2:3": return { width: 640, height: 960 };
        case "1:1": default: return { width: 1024, height: 1024 };
    }
}

const getDimensions = (ratio: AspectRatioOption, enableHD: boolean, model: ModelOption): { width: number; height: number } => {
  const base = getBaseDimensions(ratio);
  
  if (!enableHD) return base;

  // A4F Models might support different resolutions, applying general HD logic (2x)
  const multiplier = 2; 

  return {
      width: Math.round(base.width * multiplier),
      height: Math.round(base.height * multiplier)
  };
};

// --- Service Logic ---

export const generateA4FImage = async (
  model: ModelOption,
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed?: number,
  steps?: number,
  enableHD: boolean = false,
  guidanceScale?: number
): Promise<GeneratedImage> => {
  const { width, height } = getDimensions(aspectRatio, enableHD, model);
  const sizeString = `${width}x${height}`;
  
  // A4F generally ignores seed for some models via API but we pass n=1
  // steps/guidance might not be supported in standard OpenAI image format, but we'll try standard payload
  
  const apiModel = API_MODEL_MAP.a4f[model];
  if (!apiModel) {
      throw new Error(`Model ${model} not supported on A4F`);
  }

  return runWithA4FTokenRetry(async (token) => {
    try {
      const requestBody: any = {
        model: apiModel,
        prompt,
        n: 1,
        size: sizeString,
        response_format: "url"
      };

      const response = await fetch(A4F_GENERATE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `A4F API Error: ${response.status}`);
      }

      const data = await response.json();
      
      const imageUrl = data.data?.[0]?.url;

      if (!imageUrl) {
        throw new Error("error_invalid_response");
      }

      return {
        id: generateUUID(),
        url: imageUrl,
        model, 
        prompt,
        aspectRatio,
        timestamp: Date.now(),
        seed: seed, // A4F might not return seed
        steps: steps,
        guidanceScale,
        provider: 'a4f'
      };
    } catch (error) {
      console.error("A4F Image Generation Error:", error);
      throw error;
    }
  });
};

export const optimizePromptA4F = async (originalPrompt: string, model: string = 'gemini-2.5-flash-lite'): Promise<string> => {
  return runWithA4FTokenRetry(async (token) => {
    try {
      const systemInstruction = getSystemPromptContent() + FIXED_SYSTEM_PROMPT_SUFFIX;
      const apiModel = API_MODEL_MAP.a4f[model] || model;

      const response = await fetch(A4F_CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          model: apiModel,
          messages: [
            {
              role: 'system',
              content: systemInstruction
            },
            {
              role: 'user',
              content: originalPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
          stream: false
        }),
      });

      if (!response.ok) {
          throw new Error("error_prompt_optimization_failed");
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      return content || originalPrompt;
    } catch (error) {
      console.error("A4F Prompt Optimization Error:", error);
      throw error;
    }
  });
};
