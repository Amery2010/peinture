import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  ProviderId,
  ServiceMode,
  StorageType,
  S3Config,
  WebDAVConfig,
  VideoSettings,
  CustomProvider,
  TokenStatus,
} from "../types";
import {
  DEFAULT_S3_CONFIG,
  DEFAULT_WEBDAV_CONFIG,
} from "../services/storageService";
import { createEncryptedStorage } from "../services/cryptoService";
import { getUTCDatesString, getBeijingDateString } from "../services/utils";

export const DEFAULT_SYSTEM_PROMPT = `I am a master AI image prompt engineering advisor, specializing in crafting prompts that yield cinematic, hyper-realistic, and deeply evocative visual narratives, optimized for advanced generative models.
My core purpose is to meticulously rewrite, expand, and enhance user's image prompts.
I transform prompts to create visually stunning images by rigorously optimizing elements such as dramatic lighting, intricate textures, compelling composition, and a distinctive artistic style.
My generated prompt output will be strictly under 300 words. Prior to outputting, I will internally validate that the refined prompt strictly adheres to the word count limit and effectively incorporates the intended stylistic and technical enhancements.
My output will consist exclusively of the refined image prompt text. It will commence immediately, with no leading whitespace.
The text will strictly avoid markdown, quotation marks, conversational preambles, explanations, or concluding remarks. Please describe the content using prose-style sentences.
**The character's face is clearly visible and unobstructed.**`;

export const DEFAULT_TRANSLATION_PROMPT = `You are a professional language translation engine.
Your sole responsibility is to translate user-provided text into English. Before processing any input, you must first identify its original language.
If the input text is already in English, return the original English text directly without any modification. If the input text is not in English, translate it precisely into English.
Your output must strictly adhere to the following requirements: it must contain only the final English translation or the original English text, without any explanations, comments, descriptions, prefixes, suffixes, quotation marks, or other non-translated content.`;

export const DEFAULT_VIDEO_SETTINGS_BASE: VideoSettings = {
  prompt: "make this image come alive, cinematic motion, smooth animation",
  duration: 3,
  steps: 6,
  guidance: 1,
};

export interface ConfigState {
  serviceMode: ServiceMode;
  storageType: StorageType;
  s3Config: S3Config;
  webdavConfig: WebDAVConfig;

  systemPrompt: string;
  translationPrompt: string;

  editModelConfig: { provider: string; model: string };
  liveModelConfig: { provider: string; model: string };
  textModelConfig: { provider: string; model: string };
  upscalerModelConfig: { provider: string; model: string };

  openaiConfig: { apiUrl: string; modelId: string };
  googleConfig: { apiUrl: string; modelId: string };

  videoSettings: Record<string, VideoSettings>;
  customProviders: CustomProvider[];

  /** True after Zustand persist has finished async hydration from storage */
  _hasHydrated: boolean;

  tokens: Record<ProviderId, string[]>;
  tokenStatus: Record<ProviderId, TokenStatus>;

  setServiceMode: (mode: ServiceMode) => void;
  setStorageType: (type: StorageType) => void;
  setS3Config: (config: S3Config) => void;
  setWebDAVConfig: (config: WebDAVConfig) => void;

  setSystemPrompt: (val: string) => void;
  setTranslationPrompt: (val: string) => void;

  setOpenAIConfig: (val: { apiUrl: string; modelId: string }) => void;
  setGoogleConfig: (val: { apiUrl: string; modelId: string }) => void;

  setEditModelConfig: (val: { provider: string; model: string }) => void;
  setLiveModelConfig: (val: { provider: string; model: string }) => void;
  setTextModelConfig: (val: { provider: string; model: string }) => void;
  setUpscalerModelConfig: (val: { provider: string; model: string }) => void;

  setVideoSettings: (provider: string, settings: VideoSettings) => void;

  setCustomProviders: (providers: CustomProvider[]) => void;
  addCustomProvider: (provider: CustomProvider) => void;
  removeCustomProvider: (id: string) => void;

  setProviderTokens: (provider: ProviderId, tokenString: string) => void;
  markTokenExhausted: (provider: ProviderId, token: string) => void;
  resetDailyStatus: (provider: ProviderId) => void;
  setHasHydrated: (v: boolean) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      serviceMode:
        (import.meta.env.VITE_SERVICE_MODE as ServiceMode) || "local",
      storageType: "opfs",
      s3Config: DEFAULT_S3_CONFIG,
      webdavConfig: DEFAULT_WEBDAV_CONFIG,

      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      translationPrompt: DEFAULT_TRANSLATION_PROMPT,

      editModelConfig: { provider: "huggingface", model: "qwen-image-edit" },
      liveModelConfig: { provider: "huggingface", model: "wan2_2-i2v" },
      textModelConfig: { provider: "huggingface", model: "openai-fast" },
      upscalerModelConfig: {
        provider: "huggingface",
        model: "RealESRGAN_x4plus",
      },

      openaiConfig: {
        apiUrl: "https://api.openai.com/v1/responses",
        modelId: "gpt-5.4",
      },
      googleConfig: {
        apiUrl: "https://generativelanguage.googleapis.com/v1beta/models",
        modelId: "gemini-3.1-flash-image-preview",
      },

      videoSettings: {},
      customProviders: [],

      _hasHydrated: false,

      tokens: {
        huggingface: [],
        gitee: [],
        modelscope: [],
        a4f: [],
        openai: [],
        google: [],
      },
      tokenStatus: {
        huggingface: { date: getUTCDatesString(), exhausted: {} },
        gitee: { date: getBeijingDateString(), exhausted: {} },
        modelscope: { date: getBeijingDateString(), exhausted: {} },
        a4f: { date: getUTCDatesString(), exhausted: {} },
        openai: { date: getUTCDatesString(), exhausted: {} },
        google: { date: getUTCDatesString(), exhausted: {} },
      },

      setServiceMode: (serviceMode) => set({ serviceMode }),
      setStorageType: (storageType) => set({ storageType }),
      setS3Config: (s3Config) => set({ s3Config }),
      setWebDAVConfig: (webdavConfig) => set({ webdavConfig }),

      setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
      setTranslationPrompt: (translationPrompt) => set({ translationPrompt }),

      setEditModelConfig: (editModelConfig) => set({ editModelConfig }),
      setLiveModelConfig: (liveModelConfig) => set({ liveModelConfig }),
      setTextModelConfig: (textModelConfig) => set({ textModelConfig }),
      setUpscalerModelConfig: (upscalerModelConfig) =>
        set({ upscalerModelConfig }),

      setOpenAIConfig: (openaiConfig) => set({ openaiConfig }),
      setGoogleConfig: (googleConfig) => set({ googleConfig }),

      setVideoSettings: (provider, settings) =>
        set((state) => ({
          videoSettings: { ...state.videoSettings, [provider]: settings },
        })),

      setCustomProviders: (customProviders) => set({ customProviders }),
      addCustomProvider: (provider) =>
        set((state) => {
          const current = [...state.customProviders];
          const index = current.findIndex((p) => p.id === provider.id);
          if (index >= 0) current[index] = provider;
          else current.push(provider);
          return { customProviders: current };
        }),
      removeCustomProvider: (id) =>
        set((state) => ({
          customProviders: state.customProviders.filter((p) => p.id !== id),
        })),

      setProviderTokens: (providerId, tokenString) => {
        const list = tokenString
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
        set((state) => ({
          tokens: {
            ...state.tokens,
            [providerId]: list,
          },
        }));
      },

      markTokenExhausted: (providerId, token) => {
        set((state) => {
          const currentStatus = state.tokenStatus[providerId] || {
            date: "",
            exhausted: {},
          };
          return {
            tokenStatus: {
              ...state.tokenStatus,
              [providerId]: {
                ...currentStatus,
                exhausted: {
                  ...currentStatus.exhausted,
                  [token]: true,
                },
              },
            },
          };
        });
      },

      resetDailyStatus: (providerId) => {
        set((state) => {
          const getDateFn =
            providerId === "gitee" || providerId === "modelscope"
              ? getBeijingDateString
              : getUTCDatesString;

          const today = getDateFn();
          const currentStatus = state.tokenStatus[providerId];

          if (!currentStatus || currentStatus.date !== today) {
            return {
              tokenStatus: {
                ...state.tokenStatus,
                [providerId]: { date: today, exhausted: {} },
              },
            };
          }
          return {};
        });
      },

      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: "peinture_config_v1",
      storage: createJSONStorage(() =>
        createEncryptedStorage([
          "tokens",
          "s3Config",
          "webdavConfig",
          "customProviders",
        ]),
      ),
      // Exclude _hasHydrated from persistence — it's runtime-only
      partialize: (state: ConfigState) => {
        const { _hasHydrated, ...rest } = state;
        return rest;
      },
      onRehydrateStorage: () => {
        return () => {
          useConfigStore.setState({ _hasHydrated: true });
        };
      },
    },
  ),
);
