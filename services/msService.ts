import { GeneratedImage, AspectRatioOption, ModelOption } from "../types";
import { getDimensions } from "./dimensions";
import {
  generateUUID,
  getSystemPromptContent,
  FIXED_SYSTEM_PROMPT_SUFFIX,
} from "./utils";
import { uploadToGradio } from "./hfService";
import { API_MODEL_MAP } from "../constants";

import { runWithTokenRetry } from "./tokenRetry";

const MS_BASE_URL = "https://api-inference.modelscope.cn/";
const MS_GENERATE_ENDPOINT = `${MS_BASE_URL}v1/images/generations`;
const MS_CHAT_API_URL =
  "https://api-inference.modelscope.cn/v1/chat/completions";

// Constants for image upload via HF Space
const QWEN_EDIT_HF_BASE = "https://linoyts-qwen-image-edit-2511-fast.hf.space";
const QWEN_EDIT_HF_FILE_PREFIX =
  "https://prithivmlmods-qwen-image-edit-2511-loras-fast/gradio_api/file=";

// Token retry delegates to shared service
const runWithMsTokenRetry = <T>(
  operation: (token: string) => Promise<T>,
): Promise<T> => {
  return runWithTokenRetry(
    "modelscope",
    operation as (token: string | null) => Promise<T>,
  );
};

// --- Polling Helper for Async Tasks ---

const MAX_POLL_ATTEMPTS = 60; // 60 × 5s = 5 minutes max

const pollMsTask = async (
  taskId: string,
  token: string,
  signal?: AbortSignal,
): Promise<string[]> => {
  const statusUrl = `${MS_BASE_URL}v1/tasks/${taskId}`;
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    attempts++;
    if (signal?.aborted) throw new Error("AbortError");

    const response = await fetch(statusUrl, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-ModelScope-Task-Type": "image_generation",
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to check task status: ${response.status}`);
    }

    const data = await response.json();
    const status = data.task_status;

    if (status === "SUCCEED") {
      if (!data.output_images || data.output_images.length === 0) {
        throw new Error("error_invalid_response");
      }
      return data.output_images;
    } else if (status === "FAILED") {
      throw new Error(data.message || "Model Scope generation task failed");
    }

    // Wait 5 seconds before next poll
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error("Model Scope generation timed out after 5 minutes");
};

// --- Service Logic ---

export const generateMSImage = async (
  model: ModelOption,
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed?: number,
  steps?: number,
  enableHD: boolean = false,
  guidanceScale?: number,
): Promise<GeneratedImage> => {
  const { width, height } = getDimensions(aspectRatio, enableHD);
  const finalSeed = seed ?? Math.floor(Math.random() * 2147483647);
  const finalSteps = steps ?? 9;
  const sizeString = `${width}x${height}`;

  const apiModel = API_MODEL_MAP.modelscope[model];
  if (!apiModel) {
    throw new Error(`Model ${model} not supported on Model Scope`);
  }

  return runWithMsTokenRetry(async (token) => {
    try {
      const requestBody: any = {
        prompt,
        model: apiModel,
        size: sizeString,
        seed: finalSeed,
        steps: finalSteps,
      };

      if (guidanceScale !== undefined) {
        requestBody.guidance = guidanceScale;
      }

      const response = await fetch(MS_GENERATE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-ModelScope-Async-Mode": "true",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.message || `Model Scope API Error: ${response.status}`,
        );
      }

      const initData = await response.json();
      if (!initData.task_id) {
        throw new Error("error_invalid_response");
      }

      // Start Polling
      const outputImages = await pollMsTask(initData.task_id, token);
      const imageUrl = outputImages[0];

      return {
        id: generateUUID(),
        url: imageUrl,
        model,
        prompt,
        aspectRatio,
        timestamp: Date.now(),
        seed: finalSeed,
        steps: finalSteps,
        guidanceScale,
        provider: "modelscope",
      };
    } catch (error) {
      console.error("Model Scope Image Generation Error:", error);
      throw error;
    }
  });
};

export const editImageMS = async (
  imageBlobs: Blob[],
  prompt: string,
  width?: number,
  height?: number,
  steps: number = 16,
  guidanceScale: number = 4,
  signal?: AbortSignal,
): Promise<GeneratedImage> => {
  // 1. Upload images to Gradio space to get public URLs.
  const uploadedFilenames = await Promise.all(
    imageBlobs.map((blob) =>
      uploadToGradio(QWEN_EDIT_HF_BASE, blob, null, signal),
    ),
  );
  const imageUrls = uploadedFilenames.map(
    (name) => `${QWEN_EDIT_HF_FILE_PREFIX}${name}`,
  );

  // 2. Perform generation on Model Scope
  return runWithMsTokenRetry(async (token) => {
    try {
      const apiModel = API_MODEL_MAP.modelscope["qwen-image-edit"];
      const requestBody: any = {
        prompt,
        model: apiModel,
        image_url: imageUrls,
        seed: Math.floor(Math.random() * 2147483647),
        steps: steps,
        guidance: guidanceScale,
      };

      const response = await fetch(MS_GENERATE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-ModelScope-Async-Mode": "true",
        },
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.message || `Model Scope Image Edit Error: ${response.status}`,
        );
      }

      const initData = await response.json();
      if (!initData.task_id) {
        throw new Error("error_invalid_response");
      }

      // Start Polling
      const outputImages = await pollMsTask(initData.task_id, token, signal);
      const imageUrl = outputImages[0];

      return {
        id: generateUUID(),
        url: imageUrl,
        model: "qwen-image-edit",
        prompt,
        aspectRatio: "custom",
        timestamp: Date.now(),
        steps,
        guidanceScale,
        provider: "modelscope",
      };
    } catch (error) {
      console.error("Model Scope Image Edit Error:", error);
      throw error;
    }
  });
};

export const optimizePromptMS = async (
  originalPrompt: string,
  model: string = "deepseek-3_2",
): Promise<string> => {
  return runWithMsTokenRetry(async (token) => {
    try {
      const systemInstruction =
        getSystemPromptContent() + FIXED_SYSTEM_PROMPT_SUFFIX;
      const apiModel = API_MODEL_MAP.modelscope[model] || model;

      const response = await fetch(MS_CHAT_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: apiModel,
          messages: [
            {
              role: "system",
              content: systemInstruction,
            },
            {
              role: "user",
              content: originalPrompt,
            },
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error("error_prompt_optimization_failed");
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      return content || originalPrompt;
    } catch (error) {
      console.error("Model Scope Prompt Optimization Error:", error);
      throw error;
    }
  });
};
