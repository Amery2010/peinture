
import { CustomProvider, ServiceMode, VideoSettings } from "../types";

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// --- Service Mode Management ---

const SERVICE_MODE_KEY = 'service_mode';

export const getServiceMode = (): ServiceMode => {
    // If local storage has value, use it.
    if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(SERVICE_MODE_KEY);
        if (stored) return stored as ServiceMode;
    }
    // Fallback to Env Var, then default to 'local'
    return (process.env.VITE_SERVICE_MODE as ServiceMode) || 'local';
};

export const saveServiceMode = (mode: ServiceMode) => {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SERVICE_MODE_KEY, mode);
    }
};

// --- System Prompt Management ---

export const FIXED_SYSTEM_PROMPT_SUFFIX = "\nEnsure the output language matches the language of user's prompt that needs to be optimized.";

export const DEFAULT_SYSTEM_PROMPT_CONTENT = `I am a master AI image prompt engineering advisor, specializing in crafting prompts that yield cinematic, hyper-realistic, and deeply evocative visual narratives, optimized for advanced generative models.
My core purpose is to meticulously rewrite, expand, and enhance user's image prompts.
I transform prompts to create visually stunning images by rigorously optimizing elements such as dramatic lighting, intricate textures, compelling composition, and a distinctive artistic style.
My generated prompt output will be strictly under 300 words. Prior to outputting, I will internally validate that the refined prompt strictly adheres to the word count limit and effectively incorporates the intended stylistic and technical enhancements.
My output will consist exclusively of the refined image prompt text. It will commence immediately, with no leading whitespace.
The text will strictly avoid markdown, quotation marks, conversational preambles, explanations, or concluding remarks. Please describe the content using prose-style sentences.
**The character's face is clearly visible and unobstructed.**`;

export const DEFAULT_TRANSLATION_SYSTEM_PROMPT = `You are a professional language translation engine.
Your sole responsibility is to translate user-provided text into English. Before processing any input, you must first identify its original language.
If the input text is already in English, return the original English text directly without any modification. If the input text is not in English, translate it precisely into English.
Your output must strictly adhere to the following requirements: it must contain only the final English translation or the original English text, without any explanations, comments, descriptions, prefixes, suffixes, quotation marks, or other non-translated content.`;

const SYSTEM_PROMPT_STORAGE_KEY = 'custom_system_prompt';
const TRANSLATION_PROMPT_STORAGE_KEY = 'custom_translation_prompt';

export const getSystemPromptContent = (): string => {
  if (typeof localStorage === 'undefined') return DEFAULT_SYSTEM_PROMPT_CONTENT;
  return localStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY) || DEFAULT_SYSTEM_PROMPT_CONTENT;
};

export const saveSystemPromptContent = (content: string) => {
  if (typeof localStorage !== 'undefined') {
    if (content === DEFAULT_SYSTEM_PROMPT_CONTENT) {
      localStorage.removeItem(SYSTEM_PROMPT_STORAGE_KEY);
    } else {
      localStorage.setItem(SYSTEM_PROMPT_STORAGE_KEY, content);
    }
  }
};

export const getTranslationPromptContent = (): string => {
  if (typeof localStorage === 'undefined') return DEFAULT_TRANSLATION_SYSTEM_PROMPT;
  return localStorage.getItem(TRANSLATION_PROMPT_STORAGE_KEY) || DEFAULT_TRANSLATION_SYSTEM_PROMPT;
};

export const saveTranslationPromptContent = (content: string) => {
  if (typeof localStorage !== 'undefined') {
    if (content === DEFAULT_TRANSLATION_SYSTEM_PROMPT) {
      localStorage.removeItem(TRANSLATION_PROMPT_STORAGE_KEY);
    } else {
      localStorage.setItem(TRANSLATION_PROMPT_STORAGE_KEY, content);
    }
  }
};

// --- Unified Model Configuration ---

const EDIT_MODEL_KEY = 'app_edit_model_config';
const LIVE_MODEL_KEY = 'app_live_model_config';
const TEXT_MODEL_KEY = 'app_text_model_config';
const UPSCALER_MODEL_KEY = 'app_upscaler_model_config';

export const getEditModelConfig = (): { provider: string, model: string } => {
    if (typeof localStorage === 'undefined') return { provider: 'huggingface', model: 'qwen-image-edit' };
    const saved = localStorage.getItem(EDIT_MODEL_KEY);
    if (saved) {
        const [provider, model] = saved.split(':');
        return { provider, model };
    }
    return { provider: 'huggingface', model: 'qwen-image-edit' };
};

export const saveEditModelConfig = (value: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(EDIT_MODEL_KEY, value);
};

export const getLiveModelConfig = (): { provider: string, model: string } => {
    if (typeof localStorage === 'undefined') return { provider: 'huggingface', model: 'wan2_2-i2v' };
    const saved = localStorage.getItem(LIVE_MODEL_KEY);
    if (saved) {
        const [provider, model] = saved.split(':');
        return { provider, model };
    }
    return { provider: 'huggingface', model: 'wan2_2-i2v' };
};

export const saveLiveModelConfig = (value: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LIVE_MODEL_KEY, value);
};

export const getTextModelConfig = (): { provider: string, model: string } => {
    if (typeof localStorage === 'undefined') return { provider: 'huggingface', model: 'openai-fast' };
    const saved = localStorage.getItem(TEXT_MODEL_KEY);
    if (saved) {
        const [provider, model] = saved.split(':');
        return { provider, model };
    }
    return { provider: 'huggingface', model: 'openai-fast' };
};

export const saveTextModelConfig = (value: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(TEXT_MODEL_KEY, value);
};

export const getUpscalerModelConfig = (): { provider: string, model: string } => {
    if (typeof localStorage === 'undefined') return { provider: 'huggingface', model: 'RealESRGAN_x4plus' };
    const saved = localStorage.getItem(UPSCALER_MODEL_KEY);
    if (saved) {
        const [provider, model] = saved.split(':');
        return { provider, model };
    }
    return { provider: 'huggingface', model: 'RealESRGAN_x4plus' };
};

export const saveUpscalerModelConfig = (value: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(UPSCALER_MODEL_KEY, value);
};

// --- Video Settings Management ---

export const DEFAULT_VIDEO_SETTINGS: Record<string, VideoSettings> = {
  huggingface: {
    prompt: "make this image come alive, cinematic motion, smooth animation",
    duration: 3,
    steps: 6,
    guidance: 1
  },
  gitee: {
    prompt: "make this image come alive, cinematic motion, smooth animation",
    duration: 3,
    steps: 10,
    guidance: 4
  },
  modelscope: {
    prompt: "make this image come alive, cinematic motion, smooth animation",
    duration: 3,
    steps: 10,
    guidance: 4
  },
  a4f: {
    prompt: "make this image come alive, cinematic motion, smooth animation",
    duration: 3,
    steps: 10,
    guidance: 4
  }
};

const VIDEO_SETTINGS_STORAGE_PREFIX = 'video_settings_';

export const getVideoSettings = (provider: string): VideoSettings => {
  const defaults = DEFAULT_VIDEO_SETTINGS[provider] || DEFAULT_VIDEO_SETTINGS['huggingface'];
  if (typeof localStorage === 'undefined') return defaults;
  
  try {
    const raw = localStorage.getItem(VIDEO_SETTINGS_STORAGE_PREFIX + provider);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    // Ensure all keys exist by merging with defaults
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
};

export const saveVideoSettings = (provider: string, settings: VideoSettings) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(VIDEO_SETTINGS_STORAGE_PREFIX + provider, JSON.stringify(settings));
  }
};

// --- Custom Provider Management ---

const CUSTOM_PROVIDERS_KEY = 'app_custom_providers';

export const getCustomProviders = (): CustomProvider[] => {
    if (typeof localStorage === 'undefined') return [];
    try {
        const saved = localStorage.getItem(CUSTOM_PROVIDERS_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        console.error("Failed to load custom providers", e);
        return [];
    }
};

export const saveCustomProviders = (providers: CustomProvider[]) => {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CUSTOM_PROVIDERS_KEY, JSON.stringify(providers));
    }
};

export const addCustomProvider = (provider: CustomProvider) => {
    const current = getCustomProviders();
    const existingIndex = current.findIndex(p => p.id === provider.id);
    if (existingIndex >= 0) {
        current[existingIndex] = provider;
    } else {
        current.push(provider);
    }
    saveCustomProviders(current);
};

export const removeCustomProvider = (id: string) => {
    const current = getCustomProviders();
    const updated = current.filter(p => p.id !== id);
    saveCustomProviders(updated);
};

// --- Translation Service ---

const POLLINATIONS_API_URL = "https://text.pollinations.ai/openai";

export const translatePrompt = async (text: string): Promise<string> => {
    try {
        const systemPrompt = getTranslationPromptContent();
        
        const response = await fetch(POLLINATIONS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'openai-fast',
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                stream: false
            }),
        });

        if (!response.ok) {
            throw new Error("Translation request failed");
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        return content || text;
    } catch (error) {
        console.error("Translation Error:", error);
        throw new Error("error_translation_failed");
    }
};

export const optimizeEditPrompt = async (imageBase64: string, prompt: string, model: string = 'openai-fast'): Promise<string> => {
  try {
    // Pollinations AI OpenAI-compatible endpoint
    const response = await fetch(POLLINATIONS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model, // Dynamically use passed model
        messages: [
          {
            role: 'system',
            content: `You are a professional AI image editing assistant.
Your task is to analyze the image provided by the user (which may include user-drawn masks/indicated editing areas) and the user's text request, and deeply understand their intent.
When analyzing the image, you must actively extract and integrate its inherent visual context, including but not limited to the image subject, existing elements, color scheme, lighting conditions, and overall atmosphere, ensuring seamless integration with the optimized editing instructions.
Based on the visual context and text, optimize the user's editing instructions into more precise, descriptive prompts that are easier for the AI ​​model to understand.
When the user's request is vague or incomplete, intelligently infer and supplement specific, reasonable visual details to refine the editing instructions.
When generating optimized prompts, be sure to clearly incorporate descriptions of the expected visual changes, prioritizing the addition of detailed visual styles, precise lighting conditions, reasonable compositional layouts, and specific material textures to ensure the AI ​​model can accurately understand and execute the instructions.
For example: 'Replace the masked area with [specific object], emphasizing its [material], [color], and [lighting effect]', 'Add a [new object] at [specified location], giving it a [specific style] and [compositional relationship]', or 'Adjust the overall image style to [artistic style], keeping [original elements] unchanged, but enhancing [a certain feature]'.
Keep the generated prompts concise and descriptive, prioritizing the use of descriptive keywords and phrases that are easier for AI image models to understand and respond to, to maximize the effectiveness and accuracy of the prompt execution.
Only reply with the optimized prompt text. Do not add any conversational content. Do not include any markdown syntax. Ensure the output language matches the language of the prompt that needs to be optimized.`
          },
          {
            role: 'user',
            content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: imageBase64 } }
            ]
          }
        ],
        stream: false
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to optimize prompt");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    return content || prompt;
  } catch (error) {
    console.error("Optimize Edit Prompt Error:", error);
    throw error;
  }
};

// --- Unified URL/Blob Utilities ---

export const getProxyUrl = (url: string) => `https://peinture-proxy.9th.xyz/?url=${encodeURIComponent(url)}`;

/**
 * Unified function to fetch a Blob from a URL.
 * First tries a direct fetch. If that fails (e.g. CORS), falls back to using the proxy.
 */
export const fetchBlob = async (url: string): Promise<Blob> => {
    // Handle data/blob URLs locally without fetching
    if (url.startsWith('data:') || url.startsWith('blob:')) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Local fetch failed: ${res.status}`);
            return res.blob();
        } catch (e) {
            console.warn("Local blob/data URL fetch failed", e);
            throw new Error("Local resource not found");
        }
    }

    try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`Direct fetch failed: ${response.status}`);
        return await response.blob();
    } catch (e) {
        console.warn("Direct fetch failed, trying proxy...", e);
        const proxyUrl = getProxyUrl(url);
        const proxyResponse = await fetch(proxyUrl);
        if (!proxyResponse.ok) throw new Error(`Proxy fetch failed: ${proxyResponse.status}`);
        return await proxyResponse.blob();
    }
};

/**
 * Unified function to download an image from a URL.
 * - Non-mobile:
 *   - If local (blob/data) or remote: creates <a> tag to download.
 * - Mobile:
 *   - If local: Fetch Blob -> Share -> Fallback to ObjectURL download.
 *   - If remote: Creates <a> tag (direct download).
 * - Fallback: window.open
 */
export const downloadImage = async (url: string, fileName: string) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isLocal = url.startsWith('blob:') || url.startsWith('data:');

    // Helper to trigger download via anchor tag
    const triggerAnchorDownload = (href: string, name: string) => {
        const link = document.createElement('a');
        link.href = href;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isMobile && isLocal) {
        let downloadUrl: string | null = null;
        try {
            const blob = await fetchBlob(url);
            const file = new File([blob], fileName, { type: blob.type });
            const nav = navigator as any;

            // 1. Try Share
            if (nav.canShare && nav.canShare({ files: [file] })) {
                try {
                    await nav.share({
                        files: [file],
                        title: 'Peinture Image',
                    });
                    return; // Share successful
                } catch (e: any) {
                    if (e.name === 'AbortError') return; // User cancelled
                    console.warn("Share failed, falling back to download", e);
                }
            }

            // 2. Fallback to ObjectURL Download
            downloadUrl = URL.createObjectURL(blob);
            triggerAnchorDownload(downloadUrl, fileName);
            
            // Cleanup
            setTimeout(() => {
                if (downloadUrl) URL.revokeObjectURL(downloadUrl);
            }, 1000);

        } catch (e) {
            console.error("Mobile local download failed", e);
            // 3. Final Fallback: Window Open
            const target = downloadUrl || url;
            window.open(target, '_blank');
            if (downloadUrl) {
                setTimeout(() => URL.revokeObjectURL(downloadUrl!), 1000);
            }
        }
    } else {
        // Desktop or Mobile Remote
        try {
            triggerAnchorDownload(url, fileName);
        } catch (e) {
            console.error("Download failed", e);
            window.open(url, '_blank');
        }
    }
};

export const getExtensionFromUrl = (url: string): string | null => {
    let path = url;
    try {
        const urlObj = new URL(url);
        path = urlObj.pathname;
    } catch (e) { /* ignore */ }

    if (url.includes('gradio_api/file=')) {
        const parts = url.split('gradio_api/file=');
        if (parts.length > 1) path = parts[1];
    }
    path = path.split('?')[0];
    const match = path.match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[1] : null;
};
