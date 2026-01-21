
import { GeneratedImage, AspectRatioOption, ModelOption } from "../types";
import { generateUUID, getSystemPromptContent, FIXED_SYSTEM_PROMPT_SUFFIX, getVideoSettings } from "./utils";
import { API_MODEL_MAP } from "../constants";

const GITEE_GENERATE_API_URL = "https://ai.gitee.com/v1/images/generations";
const GITEE_EDIT_API_URL = "https://ai.gitee.com/v1/images/edits";
const GITEE_CHAT_API_URL = "https://ai.gitee.com/v1/chat/completions";
const GITEE_VIDEO_TASK_API_URL = "https://ai.gitee.com/v1/async/videos/image-to-video";
const GITEE_TASK_STATUS_API_URL = "https://ai.gitee.com/api/v1/task";

// --- Token Management System (Reused logic pattern for Gitee) ---

const TOKEN_STORAGE_KEY = 'giteeToken';
const TOKEN_STATUS_KEY = 'gitee_token_status';

interface TokenStatusStore {
  date: string; // YYYY-MM-DD
  exhausted: Record<string, boolean>;
}

// Get Date string for Beijing Time (UTC+8)
const getBeijingDateString = () => {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const nd = new Date(utc + (3600000 * 8));
  return nd.toISOString().split('T')[0];
};

const getTokenStatusStore = (): TokenStatusStore => {
  const defaultStore = { date: getBeijingDateString(), exhausted: {} };
  if (typeof localStorage === 'undefined') return defaultStore;
  
  try {
    const raw = localStorage.getItem(TOKEN_STATUS_KEY);
    if (!raw) return defaultStore;
    const store = JSON.parse(raw);
    if (store.date !== getBeijingDateString()) {
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

export const getGiteeTokens = (rawInput?: string | null): string[] => {
  const input = rawInput !== undefined ? rawInput : (typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : '');
  if (!input) return [];
  return input.split(',').map(t => t.trim()).filter(t => t.length > 0);
};

export const getGiteeTokenStats = (rawInput: string) => {
  const tokens = getGiteeTokens(rawInput);
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
  const tokens = getGiteeTokens();
  const store = getTokenStatusStore();
  return tokens.find(t => !store.exhausted[t]) || null;
};

const markTokenExhausted = (token: string) => {
  const store = getTokenStatusStore();
  store.exhausted[token] = true;
  saveTokenStatusStore(store);
};

const runWithGiteeTokenRetry = async <T>(operation: (token: string) => Promise<T>): Promise<T> => {
  const tokens = getGiteeTokens();
  
  if (tokens.length === 0) {
      throw new Error("error_gitee_token_required");
  }

  let lastError: any;
  let attempts = 0;
  const maxAttempts = tokens.length + 1; 

  while (attempts < maxAttempts) {
    attempts++;
    const token = getNextAvailableToken();
    
    if (!token) {
       throw new Error("error_gitee_token_exhausted");
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
        error.message?.includes("quota") ||
        error.message?.includes("credit");

      if (isQuotaError && token) {
        console.warn(`Gitee AI Token ${token.substring(0, 8)}... exhausted/error. Switching to next token.`);
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

  let multiplier = 2; // Default multiplier for Z-Image Turbo
  if (['flux-1-schnell', 'flux-1-krea', 'flux-1', 'flux-2'].includes(model)) {
      multiplier = 1.5;
  }

  return {
      width: Math.round(base.width * multiplier),
      height: Math.round(base.height * multiplier)
  };
};

// --- Service Logic ---

export const generateGiteeImage = async (
  model: ModelOption,
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed?: number,
  steps?: number,
  enableHD: boolean = false,
  guidanceScale?: number
): Promise<GeneratedImage> => {
  const { width, height } = getDimensions(aspectRatio, enableHD, model);
  const finalSeed = seed ?? Math.floor(Math.random() * 2147483647);
  // Default steps logic handled in App.tsx, but good to have fallback here
  const finalSteps = steps ?? 9; 

  // Get the actual API model string from the map
  const apiModel = API_MODEL_MAP.gitee[model];
  if (!apiModel) {
      throw new Error(`Model ${model} not supported on Gitee AI`);
  }

  return runWithGiteeTokenRetry(async (token) => {
    try {
      const requestBody: any = {
        prompt,
        model: apiModel,
        width,
        height,
        seed: finalSeed,
        num_inference_steps: finalSteps,
        response_format: "url"
      };

      if (guidanceScale !== undefined) {
        requestBody.guidance_scale = guidanceScale;
      }

      const response = await fetch(GITEE_GENERATE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Gitee AI API Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.data || !data.data[0] || !data.data[0].url) {
        throw new Error("error_invalid_response");
      }

      return {
        id: generateUUID(),
        url: data.data[0].url,
        model, // Return the standardized ID for UI consistency
        prompt,
        aspectRatio,
        timestamp: Date.now(),
        seed: finalSeed,
        steps: finalSteps,
        guidanceScale,
        provider: 'gitee'
      };
    } catch (error) {
      console.error("Gitee AI Image Generation Error:", error);
      throw error;
    }
  });
};

export const editImageGitee = async (
  imageBlobs: Blob[],
  prompt: string,
  width?: number,
  height?: number,
  steps: number = 16,
  guidanceScale: number = 4,
  signal?: AbortSignal
): Promise<GeneratedImage> => {
  return runWithGiteeTokenRetry(async (token) => {
    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      
      imageBlobs.forEach((blob) => {
        formData.append('image', blob);
      });

      const apiModel = API_MODEL_MAP.gitee['qwen-image-edit'];
      formData.append('model', apiModel);
      // formData.append('width', width.toString());
      // formData.append('height', height.toString());
      formData.append('num_inference_steps', steps.toString());
      formData.append('cfg_scale', guidanceScale.toString());
      formData.append('seed', Math.floor(Math.random() * 2147483647).toString());
      formData.append('response_format', 'url');
      formData.append('lora_weights', JSON.stringify({
        url: "https://gitee.com/realhugh/materials/raw/master/Qwen-Image-Edit-Lightning-8steps-V1.0.safetensors",
        weight: 1
      }));

      const response = await fetch(GITEE_EDIT_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
        signal
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Gitee AI Image Edit Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.data || !data.data[0] || !data.data[0].url) {
        throw new Error("error_invalid_response");
      }

      return {
        id: generateUUID(),
        url: data.data[0].url,
        model: 'qwen-image-edit', // Unified ID
        prompt,
        aspectRatio: 'custom',
        timestamp: Date.now(),
        steps,
        guidanceScale,
        provider: 'gitee'
      };
    } catch (error) {
      console.error("Gitee AI Image Edit Error:", error);
      throw error;
    }
  });
};

export const optimizePromptGitee = async (originalPrompt: string, model: string = 'deepseek-3_2'): Promise<string> => {
  return runWithGiteeTokenRetry(async (token) => {
    try {
      // Append the fixed suffix to the user's custom system prompt
      const systemInstruction = getSystemPromptContent() + FIXED_SYSTEM_PROMPT_SUFFIX;
      const apiModel = API_MODEL_MAP.gitee[model] || model;

      const response = await fetch(GITEE_CHAT_API_URL, {
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
      console.error("Gitee AI Prompt Optimization Error:", error);
      throw error;
    }
  });
};

// --- Video Generation Services ---

const VIDEO_NEGATIVE_PROMPT = "Vivid colors, overexposed, static, blurry details, subtitles, style, artwork, painting, image, still, overall grayish tone, worst quality, low quality, JPEG compression artifacts, ugly, incomplete, extra fingers, poorly drawn hands, poorly drawn face, deformed, disfigured, malformed limbs, fused fingers, still image, cluttered background, three legs, many people in the background, walking backward, Screen shaking";

export const createVideoTask = async (
  imageInput: string | Blob, 
  width: number, 
  height: number
): Promise<string> => {
  return runWithGiteeTokenRetry(async (token) => {
    try {
      const settings = getVideoSettings('gitee');
      // Convert Duration (seconds) to Frames. 1s = 16 frames.
      const numFrames = Math.round(settings.duration * 16);
      const apiModel = API_MODEL_MAP.gitee['wan2_2-i2v'];

      const formData = new FormData();
      formData.append('image', imageInput); 
      formData.append('prompt', settings.prompt);
      formData.append('negative_prompt', VIDEO_NEGATIVE_PROMPT);
      formData.append('model', apiModel);
      formData.append('num_inferenece_steps', settings.steps.toString());
      formData.append('num_frames', numFrames.toString());
      formData.append('guidance_scale', settings.guidance.toString());
      formData.append('height', height.toString());
      formData.append('width', width.toString());

      const response = await fetch(GITEE_VIDEO_TASK_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Video task creation failed');
      }

      const data = await response.json();
      if (!data.task_id) throw new Error('No task ID returned');

      return data.task_id;
    } catch (error) {
      console.error("Create Video Task Error:", error);
      throw error;
    }
  });
};

export const getGiteeTaskStatus = async (taskId: string): Promise<{status: string, videoUrl?: string, error?: string}> => {
  return runWithGiteeTokenRetry(async (token) => {
    try {
      const response = await fetch(`${GITEE_TASK_STATUS_API_URL}/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to check task status');

      const data = await response.json();
      // status can be "waiting", "is_process", "success", "failure"
      
      const result: {status: string, videoUrl?: string, error?: string} = { status: data.status };
      
      if (data.status === 'success' && data.output?.file_url) {
        result.videoUrl = data.output.file_url;
      } else if (data.status === 'failure') {
        result.status = 'failed';
        result.error = data.output?.error || data.output?.message || 'Video generation failed';
      }
      
      return result;
    } catch (error) {
      console.error("Check Task Status Error:", error);
      return { status: 'failed', error: 'Network error checking status' };
    }
  });
};
