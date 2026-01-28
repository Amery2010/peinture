
export interface GeneratedImage {
    id: string;
    url: string;
    prompt: string;
    aspectRatio: string;
    timestamp: number;
    model: string;
    seed?: number;
    steps?: number;
    guidanceScale?: number;
    duration?: number;
    isBlurred?: boolean;
    isUpscaled?: boolean;
    width?: number;
    height?: number;
    provider?: ProviderOption;
    fileName?: string; // Local filename in OPFS tmp for the image
    // Video Generation Properties
    videoUrl?: string;
    videoTaskId?: string;
    videoStatus?: 'generating' | 'success' | 'failed';
    videoError?: string;
    videoProvider?: ProviderOption;
    videoNextPollTime?: number; // Timestamp for next poll attempt
    videoFileName?: string; // Local filename in OPFS tmp for the video
}

export interface CloudImage {
    id: string;
    url: string; // Cloud URL
    thumbnailUrl?: string;
    prompt: string;
    timestamp: number;
    fileName: string;
}

export interface CloudFile {
    key: string;
    lastModified: Date;
    size: number;
    url: string;
    type: 'image' | 'video' | 'unknown';
}

export type StorageType = 'off' | 's3' | 'webdav' | 'opfs';

export interface S3Config {
    accessKeyId: string;
    secretAccessKey: string;
    bucket?: string; // Optional
    region?: string; // Optional
    endpoint?: string; // Optional custom endpoint
    publicDomain?: string; // Optional CDN/Public domain
    prefix?: string; // Optional prefix, default 'peinture/'
}

export interface WebDAVConfig {
    url: string;
    username: string;
    password: string;
    directory: string;
}

export type AspectRatioOption = "1:1" | "3:2" | "2:3" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9";

export type ModelOption = 
    | "z-image-turbo" 
    | "z-image"
    | "qwen-image" 
    | "ovis-image" 
    | "flux-2"
    | "flux-1-schnell" 
    | "flux-1-krea"
    | "flux-1"
    | "imagen-4"
    | string; // Allow custom model strings

export type ProviderOption = "huggingface" | "gitee" | "modelscope" | "a4f" | string;

export type ProviderId = 'huggingface' | 'gitee' | 'modelscope' | 'a4f';

export interface TokenStatus {
    date: string;
    exhausted: Record<string, boolean>;
}

export interface GenerationParams {
    model: ModelOption;
    prompt: string;
    aspectRatio: AspectRatioOption;
    seed?: number;
    steps?: number;
    guidanceScale?: number;
}

export interface RemoteModel {
  id: string;
  name: string;
  type: string[];
  steps?: {
    range: [number, number];
    default: number;
  };
  guidance?: {
    range: [number, number];
    default: number;
  };
}

export interface RemoteModelList {
  generate?: RemoteModel[];
  edit?: RemoteModel[];
  video?: RemoteModel[];
  text?: RemoteModel[];
  upscaler?: RemoteModel[];
}

export interface CustomProvider {
    id: string;
    name: string;
    apiUrl: string;
    token?: string;
    models: RemoteModelList;
    enabled: boolean;
}

export type ServiceMode = 'local' | 'server' | 'hydration';

export interface VideoSettings {
  prompt: string;
  duration: number; // in seconds
  steps: number;
  guidance: number;
}

export interface UnifiedModelOption {
    label: string;
    value: string; // provider:modelId
    provider: ProviderOption;
}