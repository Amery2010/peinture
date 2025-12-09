

export interface GeneratedImage {
    id: string;
    url: string;
    prompt: string;
    aspectRatio: string;
    timestamp: number;
    model: string;
    seed?: number;
    steps?: number;
    duration?: number;
    isBlurred?: boolean;
    isUpscaled?: boolean;
    provider?: ProviderOption;
}

export type AspectRatioOption = "1:1" | "3:2" | "2:3" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9";

export type ModelOption = 
    | "z-image-turbo" 
    | "qwen-image-fast" 
    | "ovis-image" 
    | "Qwen-Image"
    | "Tongyi-MAI/Z-Image-Turbo"
    | "Qwen/Qwen-Image";

export type ProviderOption = "huggingface" | "gitee" | "modelscope";

export interface GenerationParams {
    model: ModelOption;
    prompt: string;
    aspectRatio: AspectRatioOption;
    seed?: number;
    steps?: number;
}