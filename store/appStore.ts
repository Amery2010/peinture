import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppView } from '../components/Header';
import { Language } from '../translations';
import { AspectRatioOption, CloudImage, GeneratedImage, ModelOption, ProviderOption } from '../types';
import { HF_MODEL_OPTIONS } from '../constants';

// --- Migration Helpers ---
// Reads old localStorage keys to populate initial state if new state doesn't exist
const getLocalItem = <T>(key: string, def: T): T => {
    if (typeof localStorage === 'undefined') return def;
    try {
        const item = localStorage.getItem(key);
        if (item === null) return def;
        // Check if item is JSON
        if (item.startsWith('{') || item.startsWith('[')) {
            return JSON.parse(item);
        }
        return item as unknown as T;
    } catch (e) {
        return def;
    }
};

interface AppState {
    // Settings (Persisted)
    language: Language;
    provider: ProviderOption;
    model: ModelOption;
    aspectRatio: AspectRatioOption;
    seed: string;
    steps: number;
    guidanceScale: number;
    autoTranslate: boolean;
    
    // History (Persisted)
    history: GeneratedImage[];
    cloudHistory: CloudImage[];

    // UI State (Ephemeral - Not Persisted via partialize)
    currentView: AppView;
    prompt: string;
    
    isLoading: boolean;
    isTranslating: boolean;
    isOptimizing: boolean;
    isUpscaling: boolean;
    isDownloading: boolean;
    isUploading: boolean;
    
    currentImage: GeneratedImage | null;
    imageDimensions: { width: number, height: number } | null;
    isLiveMode: boolean;
    error: string | null;
    
    // Actions
    setLanguage: (lang: Language) => void;
    setProvider: (provider: ProviderOption) => void;
    setModel: (model: ModelOption) => void;
    setAspectRatio: (ar: AspectRatioOption) => void;
    setSeed: (seed: string) => void;
    setSteps: (steps: number) => void;
    setGuidanceScale: (scale: number) => void;
    setAutoTranslate: (enabled: boolean) => void;
    
    setHistory: (history: GeneratedImage[] | ((prev: GeneratedImage[]) => GeneratedImage[])) => void;
    setCloudHistory: (history: CloudImage[] | ((prev: CloudImage[]) => CloudImage[])) => void;
    
    setCurrentView: (view: AppView) => void;
    setPrompt: (prompt: string) => void;
    
    setIsLoading: (isLoading: boolean) => void;
    setIsTranslating: (isTranslating: boolean) => void;
    setIsOptimizing: (isOptimizing: boolean) => void;
    setIsUpscaling: (isUpscaling: boolean) => void;
    setIsDownloading: (isDownloading: boolean) => void;
    setIsUploading: (isUploading: boolean) => void;
    
    setCurrentImage: (image: GeneratedImage | null | ((prev: GeneratedImage | null) => GeneratedImage | null)) => void;
    setImageDimensions: (dimensions: { width: number, height: number } | null) => void;
    setIsLiveMode: (isLive: boolean) => void;
    setError: (error: string | null) => void;
    
    // Complex Actions
    resetSettings: () => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            // --- Initial State (with Migration) ---
            language: getLocalItem<Language>('app_language', (() => {
                const browserLang = navigator.language.toLowerCase();
                return browserLang.startsWith('zh') ? 'zh' : 'en';
            })()),
            
            provider: getLocalItem<ProviderOption>('app_provider', 'huggingface'),
            model: getLocalItem<ModelOption>('app_model', HF_MODEL_OPTIONS[0].value as ModelOption),
            aspectRatio: getLocalItem<AspectRatioOption>('app_aspect_ratio', '1:1'),
            
            seed: '',
            steps: 9, // Default will be overridden by ControlPanel logic usually, but good base
            guidanceScale: 3.5,
            autoTranslate: false,
            
            history: getLocalItem<GeneratedImage[]>('ai_image_gen_history', []),
            cloudHistory: getLocalItem<CloudImage[]>('ai_cloud_history', []),
            
            // Ephemeral
            currentView: 'creation',
            prompt: '',
            isLoading: false,
            isTranslating: false,
            isOptimizing: false,
            isUpscaling: false,
            isDownloading: false,
            isUploading: false,
            currentImage: null,
            imageDimensions: null,
            isLiveMode: false,
            error: null,

            // --- Actions ---
            setLanguage: (language) => set({ language }),
            setProvider: (provider) => set({ provider }),
            setModel: (model) => set({ model }),
            setAspectRatio: (aspectRatio) => set({ aspectRatio }),
            setSeed: (seed) => set({ seed }),
            setSteps: (steps) => set({ steps }),
            setGuidanceScale: (guidanceScale) => set({ guidanceScale }),
            setAutoTranslate: (autoTranslate) => set({ autoTranslate }),
            
            setHistory: (historyOrFn) => set((state) => ({ 
                history: typeof historyOrFn === 'function' ? historyOrFn(state.history) : historyOrFn 
            })),
            setCloudHistory: (historyOrFn) => set((state) => ({ 
                cloudHistory: typeof historyOrFn === 'function' ? historyOrFn(state.cloudHistory) : historyOrFn 
            })),
            
            setCurrentView: (currentView) => set({ currentView }),
            setPrompt: (prompt) => set({ prompt }),
            
            setIsLoading: (isLoading) => set({ isLoading }),
            setIsTranslating: (isTranslating) => set({ isTranslating }),
            setIsOptimizing: (isOptimizing) => set({ isOptimizing }),
            setIsUpscaling: (isUpscaling) => set({ isUpscaling }),
            setIsDownloading: (isDownloading) => set({ isDownloading }),
            setIsUploading: (isUploading) => set({ isUploading }),
            
            setCurrentImage: (imageOrFn) => set((state) => ({
                currentImage: typeof imageOrFn === 'function' ? imageOrFn(state.currentImage) : imageOrFn
            })),
            setImageDimensions: (imageDimensions) => set({ imageDimensions }),
            setIsLiveMode: (isLiveMode) => set({ isLiveMode }),
            setError: (error) => set({ error }),
            
            resetSettings: () => set({
                prompt: '',
                seed: '',
                // Note: We might want to keep provider/model/ar as is, or reset them.
                // The original App.tsx handleReset reset aspect ratio to 1:1 but kept provider/model logic separate
                // We'll mimic the lightweight reset here, letting components handle defaults
                aspectRatio: '1:1',
                currentImage: null,
                isLiveMode: false,
                error: null,
                imageDimensions: null
            }),
        }),
        {
            name: 'peinture_storage_v1', // Unified storage key
            storage: createJSONStorage(() => localStorage),
            // Only persist settings and data, ignore UI state
            partialize: (state) => ({
                language: state.language,
                provider: state.provider,
                model: state.model,
                aspectRatio: state.aspectRatio,
                seed: state.seed,
                steps: state.steps,
                guidanceScale: state.guidanceScale,
                autoTranslate: state.autoTranslate,
                history: state.history,
                cloudHistory: state.cloudHistory
            }),
        }
    )
);
