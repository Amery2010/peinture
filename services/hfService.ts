
import { GeneratedImage, AspectRatioOption, ModelOption } from "../types";
import { generateUUID, getSystemPromptContent, FIXED_SYSTEM_PROMPT_SUFFIX, getVideoSettings, fetchBlob } from "./utils";
import { fetchCloudBlob } from "./storageService";
import { API_MODEL_MAP } from "../constants";

const ZIMAGE_BASE_API_URL = "https://luca115-z-image-turbo.hf.space";
const QWEN_IMAGE_BASE_API_URL = "https://mcp-tools-qwen-image-fast.hf.space";
const OVIS_IMAGE_BASE_API_URL = "https://aidc-ai-ovis-image-7b.hf.space";
const FLUX_SCHNELL_BASE_API_URL = "https://black-forest-labs-flux-1-schnell.hf.space";
const UPSCALER_BASE_API_URL = "https://tuan2308-upscaler.hf.space";
const POLLINATIONS_API_URL = "https://text.pollinations.ai/openai";
const WAN2_VIDEO_API_URL = "https://fradeck619-wan2-2-fp8da-aoti-faster.hf.space";
export const QWEN_IMAGE_EDIT_BASE_API_URL = "https://linoyts-qwen-image-edit-2509-fast.hf.space";

// --- Token Management System ---

const TOKEN_STORAGE_KEY = 'huggingFaceToken';
const TOKEN_STATUS_KEY = 'hf_token_status';
const QUOTA_ERROR_KEY = "error_quota_exhausted";

interface TokenStatusStore {
  date: string; // YYYY-MM-DD
  exhausted: Record<string, boolean>;
}

const getUTCDatesString = () => new Date().toISOString().split('T')[0];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getTokenStatusStore = (): TokenStatusStore => {
  const defaultStore = { date: getUTCDatesString(), exhausted: {} };
  if (typeof localStorage === 'undefined') return defaultStore;

  try {
    const raw = localStorage.getItem(TOKEN_STATUS_KEY);
    if (!raw) return defaultStore;
    const store = JSON.parse(raw);
    // Reset if it's a new day (UTC)
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

export const getTokens = (rawInput?: string | null): string[] => {
  const input = rawInput !== undefined ? rawInput : (typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : '');
  if (!input) return [];
  return input.split(',').map(t => t.trim()).filter(t => t.length > 0);
};

export const getTokenStats = (rawInput: string) => {
  const tokens = getTokens(rawInput);
  const store = getTokenStatusStore();
  const total = tokens.length;
  // A token is exhausted only if it's in the store's exhausted list for today
  const exhausted = tokens.filter(t => store.exhausted[t]).length;
  return {
    total,
    exhausted,
    active: total - exhausted
  };
};

const getNextAvailableToken = (): string | null => {
  const tokens = getTokens();
  const store = getTokenStatusStore();
  // Return the first token that is NOT marked as exhausted
  return tokens.find(t => !store.exhausted[t]) || null;
};

const markTokenExhausted = (token: string) => {
  const store = getTokenStatusStore();
  store.exhausted[token] = true;
  saveTokenStatusStore(store);
};

// --- API Execution Wrapper ---

const runWithTokenRetry = async <T>(operation: (token: string | null) => Promise<T>): Promise<T> => {
  const tokens = getTokens();

  // If no tokens configured, run once with no token (public quota)
  if (tokens.length === 0) {
    return operation(null);
  }

  let lastError: any;
  let attempts = 0;
  // Limit loops to number of tokens
  const maxAttempts = tokens.length + 1;

  while (attempts < maxAttempts) {
    attempts++;
    const token = getNextAvailableToken();

    // If we have tokens configured but all are exhausted
    if (!token) {
      throw new Error(QUOTA_ERROR_KEY);
    }

    try {
      return await operation(token);
    } catch (error: any) {
      lastError = error;

      // Don't retry if aborted by user
      if (error.name === 'AbortError') {
        throw error;
      }

      const isQuotaError =
        error.message === QUOTA_ERROR_KEY ||
        error.message?.includes("429") ||
        error.status === 429;

      if (isQuotaError && token) {
        console.warn(`Token ${token.substring(0, 8)}... exhausted. Switching to next token.`);
        markTokenExhausted(token);
        continue; // Retry loop with next token
      }

      // If it's not a quota error, or we are not using a token, rethrow immediately
      throw error;
    }
  }

  throw lastError || new Error("error_api_connection");
};

// --- Gradio File Upload Helper ---

export const uploadToGradio = async (baseUrl: string, image: string | Blob, token: string | null, signal?: AbortSignal): Promise<string> => {
    const formData = new FormData();
    formData.append('files', image);
    
    const headers: Record<string, string> = {};
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}/gradio_api/upload`, {
        method: 'POST',
        headers,
        body: formData,
        signal
    });

    if (!response.ok) {
        throw new Error(`Failed to upload image to Gradio: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result || !result[0]) {
        throw new Error('Invalid upload response from Gradio');
    }

    return result[0]; // Returns the filename/path relative to the Gradio space
};

// --- Gradio Queue Helper (New Logic) ---

interface GradioPayload {
    data: any[];
    fn_index: number;
    trigger_id: number;
    session_hash: string;
    event_data: null;
}

const runGradioTask = async <T>(
    baseUrl: string,
    data: any[],
    fn_index: number,
    trigger_id: number,
    token: string | null,
    signal?: AbortSignal
): Promise<T> => {
    const session_hash = Date.now().toString(16);
    
    // 1. Join Queue
    const payload: GradioPayload = {
        data,
        fn_index,
        trigger_id,
        session_hash,
        event_data: null
    };

    const joinResponse = await fetch(`${baseUrl}/gradio_api/queue/join`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload),
        signal
    });

    if (!joinResponse.ok) {
        // Handle 429 or other errors as quota exhausted if applicable
        if (joinResponse.status === 429) throw new Error(QUOTA_ERROR_KEY);
        throw new Error(`Gradio Join Error: ${joinResponse.status}`);
    }

    // 2. Listen for Result via SSE
    const sseResponse = await fetch(`${baseUrl}/gradio_api/queue/data?session_hash=${session_hash}`, {
        headers: {
            'Accept': 'text/event-stream',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        signal
    });

    if (!sseResponse.ok) {
        if (sseResponse.status === 429) throw new Error(QUOTA_ERROR_KEY);
        throw new Error(`Gradio SSE Error: ${sseResponse.status}`);
    }

    const reader = sseResponse.body?.getReader();
    if (!reader) throw new Error("No response body from Gradio stream");

    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep partial line for next chunk

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6).trim();
                    try {
                        const msg = JSON.parse(jsonStr);
                        
                        if (msg.msg === 'process_completed') {
                            if (msg.success) {
                                return msg.output as T;
                            } else {
                                // Enhanced Error Handling
                                const errorType = msg.output?.error || 'Error';
                                const errorTitle = msg.title || msg.output?.title || 'Gradio task process failed';
                                throw new Error(`${errorTitle} (${errorType})`);
                            }
                        }
                        
                        if (msg.msg === 'close_stream') {
                            // Stream closed, loop will terminate naturally or we throw if no result found
                        }
                    } catch (e) {
                        // If it's our own error, rethrow
                        if (e instanceof Error && (e.message === QUOTA_ERROR_KEY || e.message.includes('process failed') || e.message.includes('Error'))) {
                            throw e;
                        }
                        // Otherwise ignore parse errors or irrelevant messages
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    throw new Error("Gradio stream closed without result");
};

// --- Service Logic ---

const getBaseDimensions = (ratio: AspectRatioOption) => {
  switch (ratio) {
    case "16:9": return { width: 1024, height: 576 };
    case "4:3": return { width: 1024, height: 768 };
    case "3:2": return { width: 960, height: 640 };
    case "9:16": return { width: 576, height: 1024 };
    case "3:4": return { width: 768, height: 1024 };
    case "2:3": return { width: 640, height: 960 };
    case "1:1": default: return { width: 1024, height: 1024 };
  }
}

const getDimensions = (ratio: AspectRatioOption, enableHD: boolean): { width: number; height: number } => {
  const base = getBaseDimensions(ratio);

  if (enableHD) {
    // Both Z-Image Turbo and Flux models use 2x multiplier for HD
    return {
      width: Math.round(base.width * 2),
      height: Math.round(base.height * 2)
    };
  }

  return base;
}

const generateZImage = async (
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed: number = Math.round(Math.random() * 2147483647),
  enableHD: boolean = false,
  steps: number = 9
): Promise<GeneratedImage> => {
  let { width, height } = getDimensions(aspectRatio, enableHD);

  return runWithTokenRetry(async (token) => {
    try {
      const output: any = await runGradioTask(
          ZIMAGE_BASE_API_URL,
          [prompt, height, width, steps, seed, false],
          1, // fn_index
          16, // trigger_id
          token
      );

      const data = output.data;
      if (!data || !data[0] || !data[0].url) throw new Error("error_invalid_response");

      return {
        id: generateUUID(),
        url: data[0].url,
        model: 'z-image-turbo',
        prompt,
        aspectRatio,
        timestamp: Date.now(),
        seed,
        steps
      };
    } catch (error) {
      console.error("Z-Image Turbo Generation Error:", error);
      throw error;
    }
  });
};

const generateFluxSchnellImage = async (
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed: number = Math.round(Math.random() * 2147483647),
  enableHD: boolean = false,
  steps: number = 4
): Promise<GeneratedImage> => {
  let { width, height } = getDimensions(aspectRatio, enableHD);

  return runWithTokenRetry(async (token) => {
    try {
      // Data: ["Prompt", Seed, Randomize seed (false), Width, Height, steps]
      const output: any = await runGradioTask(
          FLUX_SCHNELL_BASE_API_URL,
          [prompt, seed, false, width, height, steps],
          2, // fn_index
          5, // trigger_id
          token
      );

      const data = output.data;
      if (!data || !data[0] || !data[0].url) throw new Error("error_invalid_response");

      return {
        id: generateUUID(),
        url: data[0].url,
        model: 'flux-1-schnell',
        prompt,
        aspectRatio,
        timestamp: Date.now(),
        seed,
        steps
      };
    } catch (error) {
      console.error("Flux Schnell Generation Error:", error);
      throw error;
    }
  });
};

const generateQwenImage = async (
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed?: number,
  steps: number = 8
): Promise<GeneratedImage> => {

  return runWithTokenRetry(async (token) => {
    try {
      // Logic from legacy: [prompt, seed || 42, seed === undefined, aspectRatio, 3, steps]
      const finalSeed = seed ?? 42;
      const randomize = seed === undefined;
      
      const output: any = await runGradioTask(
          QWEN_IMAGE_BASE_API_URL,
          [prompt, finalSeed, randomize, aspectRatio, 3, steps],
          1, // fn_index
          6, // trigger_id
          token
      );

      const data = output.data;
      if (!data || !data[0] || !data[0].url) throw new Error("error_invalid_response");

      // Extract actual seed if returned in message (legacy did string parsing)
      // New format usually returns clean data, let's try to parse if available or fallback
      let returnedSeed = finalSeed;
      if (typeof data[1] === 'string' && data[1].includes('Seed')) {
          returnedSeed = parseInt(data[1].replace('Seed used for generation: ', ''));
      }

      return {
        id: generateUUID(),
        url: data[0].url,
        model: 'qwen-image',
        prompt,
        aspectRatio,
        timestamp: Date.now(),
        seed: isNaN(returnedSeed) ? finalSeed : returnedSeed,
        steps
      };
    } catch (error) {
      console.error("Qwen Image Fast Generation Error:", error);
      throw error;
    }
  });
};

const generateOvisImage = async (
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed: number = Math.round(Math.random() * 2147483647),
  enableHD: boolean = false,
  steps: number = 24
): Promise<GeneratedImage> => {
  let { width, height } = getDimensions(aspectRatio, enableHD);

  return runWithTokenRetry(async (token) => {
    try {
      const output: any = await runGradioTask(
          OVIS_IMAGE_BASE_API_URL,
          [prompt, height, width, seed, steps, 4],
          2, // fn_index
          5, // trigger_id
          token
      );

      const data = output.data;
      if (!data || !data[0] || !data[0].url) throw new Error("error_invalid_response");

      return {
        id: generateUUID(),
        url: data[0].url,
        model: 'ovis-image',
        prompt,
        aspectRatio,
        timestamp: Date.now(),
        seed,
        steps
      };
    } catch (error) {
      console.error("Ovis Image Generation Error:", error);
      throw error;
    }
  });
};

export const editImageQwen = async (
  imageBlobs: (Blob | string)[],
  prompt: string,
  width: number,
  height: number,
  steps: number = 4,
  guidanceScale: number = 1,
  signal?: AbortSignal
): Promise<GeneratedImage> => {
  return runWithTokenRetry(async (token) => {
    try {
      const seed = Math.round(Math.random() * 2147483647);

      // 1. Upload all Blobs to Gradio first to get temporary paths
      const imagePayloadPromises = imageBlobs.map(async (item) => {
          let blob: Blob;
          if (typeof item === 'string') {
              if (item.startsWith('opfs://')) {
                  blob = await fetchCloudBlob(item);
              } else {
                  blob = await fetchBlob(item);
              }
          } else {
              blob = item;
          }
          const path = await uploadToGradio(QWEN_IMAGE_EDIT_BASE_API_URL, blob, token, signal);
          // Need to include caption: null per spec, inside the nested structure
          return { image: { path, meta: { _type: "gradio.FileData" } }, caption: null };
      });
      
      const imagePayload = await Promise.all(imagePayloadPromises);

      // 2. Call Inference
      const output: any = await runGradioTask(
          QWEN_IMAGE_EDIT_BASE_API_URL,
          [
            imagePayload,
            prompt,
            seed,
            false, // Randomize seed
            guidanceScale,
            steps,
            height,
            width,
            true // Rewrite prompt
          ],
          0, // fn_index
          12, // trigger_id
          token,
          signal
      );

      const data = output.data;
      // Output format: [[{image:{url...}}]] (List of images)
      if (!data || !data[0] || !data[0][0]?.image?.url) {
          throw new Error("error_invalid_response");
      }

      return {
        id: generateUUID(),
        url: data[0][0].image.url,
        model: 'qwen-image-edit',
        prompt,
        aspectRatio: 'custom',
        timestamp: Date.now(),
        seed,
        steps,
        provider: 'huggingface'
      };
    } catch (error) {
      console.error("Qwen Image Edit Error:", error);
      throw error;
    }
  });
};

export const generateImage = async (
  model: ModelOption,
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed?: number,
  enableHD: boolean = false,
  steps?: number,
  guidanceScale?: number
): Promise<GeneratedImage> => {
  const finalSeed = seed ?? Math.round(Math.random() * 2147483647);

  if (model === 'flux-1-schnell') {
    return generateFluxSchnellImage(prompt, aspectRatio, finalSeed, enableHD, steps);
  } else if (model === 'qwen-image') {
    return generateQwenImage(prompt, aspectRatio, seed, steps);
  } else if (model === 'ovis-image') {
    return generateOvisImage(prompt, aspectRatio, finalSeed, enableHD, steps)
  } else {
    // Default to z-image-turbo
    return generateZImage(prompt, aspectRatio, finalSeed, enableHD, steps);
  }
};

export const upscaler = async (url: string): Promise<{ url: string }> => {
  // Fetch image as blob first to upload to Gradio
  const blob = await fetchBlob(url);

  return runWithTokenRetry(async (token) => {
    try {
      // 1. Upload to Gradio
      const filePath = await uploadToGradio(UPSCALER_BASE_API_URL, blob, token);

      // 2. Call inference
      const output: any = await runGradioTask(
          UPSCALER_BASE_API_URL,
          [{ "path": filePath, "meta": { "_type": "gradio.FileData" } }, 'RealESRGAN_x4plus', 0.5, false, 4],
          1, // fn_index
          17, // trigger_id
          token
      );

      const data = output.data;
      if (!data || !data[0] || !data[0].url) throw new Error("error_invalid_response");

      return { url: data[0].url };
    } catch (error) {
      console.error("Upscaler Error:", error);
      throw new Error("error_upscale_failed");
    }
  });
};

export const optimizePrompt = async (originalPrompt: string, model: string = 'openai-fast'): Promise<string> => {
  try {
    // Append the fixed suffix to the user's custom system prompt
    const systemInstruction = getSystemPromptContent() + FIXED_SYSTEM_PROMPT_SUFFIX;
    const apiModel = API_MODEL_MAP.huggingface[model] || model;

    const response = await fetch(POLLINATIONS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    console.error("Prompt Optimization Error:", error);
    throw new Error("error_prompt_optimization_failed");
  }
};

// --- Video Generation Services (HF) ---

const VIDEO_NEGATIVE_PROMPT = "Vivid colors, overexposed, static, blurry details, subtitles, style, artwork, painting, image, still, overall grayish tone, worst quality, low quality, JPEG compression artifacts, ugly, incomplete, extra fingers, poorly drawn hands, poorly drawn face, deformed, disfigured, malformed limbs, fused fingers, still image, cluttered background, three legs, many people in the background, walking backward, Screen shaking";

export const createVideoTaskHF = async (imageInput: string | Blob, seed: number = 42): Promise<string> => {
  return runWithTokenRetry(async (token) => {
    try {
      const finalSeed = seed ?? Math.floor(Math.random() * 2147483647);
      const settings = getVideoSettings('huggingface');
      
      let filePath = '';
      
      if (typeof imageInput === 'string') {
          if (imageInput.startsWith('opfs://')) {
              const blob = await fetchCloudBlob(imageInput);
              filePath = await uploadToGradio(WAN2_VIDEO_API_URL, blob, token);
          } else {
              // Assume it's a remote URL accessible by Gradio, or a path already returned by uploadToGradio
              filePath = imageInput;
          }
      } else {
          filePath = await uploadToGradio(WAN2_VIDEO_API_URL, imageInput, token);
      }

      // Call Inference using Queue
      const output: any = await runGradioTask(
          WAN2_VIDEO_API_URL,
          [
            { "path": filePath, "meta": { "_type": "gradio.FileData" } },
            settings.prompt,
            settings.steps,
            VIDEO_NEGATIVE_PROMPT,
            settings.duration,
            settings.guidance, // 1st guidance
            settings.guidance, // 2nd guidance
            finalSeed,
            false // Randomize seed
          ],
          0, // fn_index
          16, // trigger_id
          token
      );

      const data = output.data;
      if (data && data[0]) {
          const vid = data[0];
          if (vid?.video?.url) return vid.video.url;
          if (vid?.url) return vid.url;
          return vid;
      }
      
      throw new Error("No video output returned");

    } catch (error) {
      console.error("Create Video Task HF Error:", error);
      throw error;
    }
  });
};
