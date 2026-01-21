
import { ModelOption, ProviderOption, UnifiedModelOption } from './types';

// Map standardized UI IDs to Provider Specific API Strings
export const API_MODEL_MAP: Record<ProviderOption, Record<string, string>> = {
  huggingface: {
    'z-image-turbo': 'z-image-turbo',
    'qwen-image': 'qwen-image-fast',
    'ovis-image': 'ovis-image',
    'flux-1-schnell': 'flux-1-schnell',
    'openai-fast': 'openai-fast', // text
    'qwen-image-edit': 'qwen-image-edit', // edit (placeholder/internal)
    'wan2_2-i2v': 'wan2.2', // video (internal/HF space convention)
    'RealESRGAN_x4plus': 'RealESRGAN_x4plus', // upscaler
  },
  gitee: {
    'z-image-turbo': 'z-image-turbo',
    'qwen-image': 'Qwen-Image',
    'flux-2': 'FLUX.2-dev',
    'flux-1-schnell': 'flux-1-schnell',
    'flux-1-krea': 'FLUX_1-Krea-dev',
    'flux-1': 'FLUX.1-dev',
    'deepseek-3_2': 'DeepSeek-V3.2', // text
    'qwen-3': 'Qwen3-Next-80B-A3B-Instruct', // text
    'qwen-image-edit': 'Qwen-Image-Edit', // edit
    'wan2_2-i2v': 'Wan2_2-I2V-A14B', // video
  },
  modelscope: {
    // 'z-image-turbo': 'Tongyi-MAI/Z-Image-Turbo',
    // 'flux-2': 'black-forest-labs/FLUX.2-dev',
    // 'flux-1-krea': 'black-forest-labs/FLUX.1-Krea-dev',
    // 'flux-1': 'MusePublic/489_ckpt_FLUX_1',
    'deepseek-3_2': 'deepseek-ai/DeepSeek-V3.2', // text
    'qwen-3': "Qwen/Qwen3-Next-80B-A3B-Instruct", // text
    'qwen-image-edit': 'Qwen/Qwen-Image-Edit-2509', // edit
  },
  a4f: {
    'z-image-turbo': 'provider-8/z-image',
    'gemini-2.5-flash-lite': 'provider-5/gemini-2.5-flash-lite', // text
    'gemini-2.0-flash': 'provider-8/gemini-2.0-flash', // text
    'deepseek-v3.1': 'provider-2/deepseek-v3.1', // text
    'deepseek-r1': 'provider-2/deepseek-r1', // text
    'qwen-3': 'provider-8/qwen3-235b', // text
    'glm-4.5': 'provider-8/glm-4.5', // text
    'kimi-k2': 'provider-8/kimi-k2-0905', // text
  }
};

export const HF_MODEL_OPTIONS = [
  { value: 'z-image-turbo', label: 'Z-Image Turbo' },
  { value: 'qwen-image', label: 'Qwen Image' },
  { value: 'ovis-image', label: 'Ovis Image' },
  { value: 'flux-1-schnell', label: 'FLUX.1 Schnell' }
];

export const GITEE_MODEL_OPTIONS = [
  { value: 'z-image-turbo', label: 'Z-Image Turbo' },
  { value: 'qwen-image', label: 'Qwen Image' },
  { value: 'flux-2', label: 'FLUX.2' },
  { value: 'flux-1-schnell', label: 'FLUX.1 Schnell' },
  { value: 'flux-1-krea', label: 'FLUX.1 Krea' },
  { value: 'flux-1', label: 'FLUX.1' }
];

export const MS_MODEL_OPTIONS = [
  // { value: 'z-image-turbo', label: 'Z-Image Turbo' },
  // { value: 'flux-2', label: 'FLUX.2' },
  // { value: 'flux-1-krea', label: 'FLUX.1 Krea' },
  // { value: 'flux-1', label: 'FLUX.1' }
];

export const A4F_MODEL_OPTIONS = [
  { value: 'z-image-turbo', label: 'Z-Image Turbo' }
];

export const PROVIDER_OPTIONS = [
    { value: 'huggingface', label: 'Hugging Face' },
    { value: 'gitee', label: 'Gitee AI' },
    { value: 'modelscope', label: 'Model Scope' },
    { value: 'a4f', label: 'A4F' }
];

export const FLUX_MODELS = [
    'flux-1-schnell', 
    'flux-1-krea', 
    'flux-1',
    'flux-2'
];

export const Z_IMAGE_MODELS = ['z-image-turbo'];

export const getModelConfig = (provider: ProviderOption, model: ModelOption) => {
  if (provider === 'gitee') {
    if (model === 'z-image-turbo') return { min: 1, max: 20, default: 9 };
    if (model === 'qwen-image') return { min: 4, max: 50, default: 20 };
    if (model === 'flux-1-schnell') return { min: 1, max: 50, default: 8 };
    if (model === 'flux-1-krea') return { min: 1, max: 50, default: 20 };
    if (model === 'flux-1') return { min: 1, max: 50, default: 20 };
    if (model === 'flux-2') return { min: 1, max: 50, default: 20 };
  } else if (provider === 'modelscope') {
    if (model === 'z-image-turbo') return { min: 1, max: 20, default: 9 };
    if (model === 'flux-2') return { min: 1, max: 50, default: 20 };
    if (model === 'flux-1-krea') return { min: 1, max: 50, default: 20 };
    if (model === 'flux-1') return { min: 1, max: 50, default: 20 };
  } else if (provider === 'a4f') {
    return { min: 1, max: 20, default: 9 }; // A4F mostly ignores steps via API, using reasonable default
  } else {
    // Hugging Face
    if (model === 'z-image-turbo') return { min: 1, max: 20, default: 9 };
    if (model === 'flux-1-schnell') return { min: 1, max: 50, default: 8 };
    if (model === 'qwen-image') return { min: 4, max: 28, default: 8 };
    if (model === 'ovis-image') return { min: 1, max: 50, default: 20 };
  }
  return { min: 1, max: 20, default: 9 }; // fallback
};

export const getGuidanceScaleConfig = (model: ModelOption, provider: ProviderOption) => {
  if (provider === 'gitee') {
    if (model === 'flux-1-schnell') return { min: 0, max: 50, step: 0.1, default: 7.5 };
    if (model === 'flux-1-krea') return { min: 0, max: 20, step: 0.1, default: 4.5 };
    if (model === 'flux-1') return { min: 0, max: 20, step: 0.1, default: 4.5 };
    if (model === 'flux-2') return { min: 1, max: 10, step: 0.1, default: 3.5 };
  } else if (provider === 'modelscope') {
    if (model === 'flux-2') return { min: 1, max: 10, step: 0.1, default: 3.5 };
    if (model === 'flux-1-krea') return { min: 1, max: 20, step: 0.1, default: 3.5 };
    if (model === 'flux-1') return { min: 1, max: 20, step: 0.1, default: 3.5 };
  }
  return null;
};

// --- Unified Model Lists ---

export const EDIT_MODELS: UnifiedModelOption[] = [
    { label: 'Qwen Image Edit', value: 'huggingface:qwen-image-edit', provider: 'huggingface' },
    { label: 'Qwen Image Edit', value: 'gitee:qwen-image-edit', provider: 'gitee' },
    { label: 'Qwen Image Edit', value: 'modelscope:qwen-image-edit', provider: 'modelscope' },
];

export const LIVE_MODELS: UnifiedModelOption[] = [
    { label: 'Wan 2.2', value: 'huggingface:wan2_2-i2v', provider: 'huggingface' },
    { label: 'Wan 2.2', value: 'gitee:wan2_2-i2v', provider: 'gitee' },
];

export const TEXT_MODELS: UnifiedModelOption[] = [
    { label: 'OpenAI 4o mini', value: 'huggingface:openai-fast', provider: 'huggingface' },
    { label: 'DeepSeek V3.2', value: 'gitee:deepseek-3_2', provider: 'gitee' },
    { label: 'Qwen 3', value: 'gitee:qwen-3', provider: 'gitee' },
    { label: 'DeepSeek V3.2', value: 'modelscope:deepseek-3_2', provider: 'modelscope' },
    { label: 'Qwen 3', value: 'modelscope:qwen-3', provider: 'modelscope' },
    { label: 'Gemini 2.5 Flash Lite', value: 'a4f:gemini-2.5-flash-lite', provider: 'a4f' },
    { label: 'DeepSeek V3.1', value: 'a4f:deepseek-v3.1', provider: 'a4f' },
    { label: 'DeepSeek R1', value: 'a4f:deepseek-r1', provider: 'a4f' },
    { label: 'Qwen 3', value: 'a4f:qwen-3', provider: 'a4f' },
    { label: 'GLM 4.5', value: 'a4f:glm-4.5', provider: 'a4f' },
    { label: 'Kimi K2', value: 'a4f:kimi-k2', provider: 'a4f' },
];

export const UPSCALER_MODELS: UnifiedModelOption[] = [
    { label: 'RealESRGAN x4 Plus', value: 'huggingface:RealESRGAN_x4plus', provider: 'huggingface' },
];
