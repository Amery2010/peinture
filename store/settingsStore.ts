import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Language } from "../translations";
import { ProviderOption, ModelOption, AspectRatioOption } from "../types";
import { HF_MODEL_OPTIONS } from "../constants";

export interface SettingsState {
  language: Language;
  provider: ProviderOption;
  model: ModelOption;
  aspectRatio: AspectRatioOption;
  seed: string;
  steps: number;
  guidanceScale: number;
  autoTranslate: boolean;
  enableHD: boolean;

  setLanguage: (lang: Language) => void;
  setProvider: (provider: ProviderOption) => void;
  setModel: (model: ModelOption) => void;
  setAspectRatio: (ar: AspectRatioOption) => void;
  setSeed: (seed: string) => void;
  setSteps: (steps: number) => void;
  setGuidanceScale: (scale: number) => void;
  setAutoTranslate: (enabled: boolean) => void;
  setEnableHD: (enabled: boolean) => void;
  resetImagineParams: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: (() => {
        const browserLang = navigator.language.toLowerCase();
        return browserLang.startsWith("zh") ? "zh" : "en";
      })(),
      provider: "huggingface",
      model: HF_MODEL_OPTIONS[0].value as ModelOption,
      aspectRatio: "1:1",
      seed: "",
      steps: 9,
      guidanceScale: 3.5,
      autoTranslate: false,
      enableHD: false,

      setLanguage: (language) => set({ language }),
      setProvider: (provider) => set({ provider }),
      setModel: (model) => set({ model }),
      setAspectRatio: (aspectRatio) => set({ aspectRatio }),
      setSeed: (seed) => set({ seed }),
      setSteps: (steps) => set({ steps }),
      setGuidanceScale: (guidanceScale) => set({ guidanceScale }),
      setAutoTranslate: (autoTranslate) => set({ autoTranslate }),
      setEnableHD: (enableHD) => set({ enableHD }),

      resetImagineParams: () =>
        set({
          seed: "",
          aspectRatio: "1:1",
          enableHD: false,
          // Keep language, provider, model, steps, guidanceScale, autoTranslate
        }),
    }),
    {
      name: "peinture_settings_v1",
    },
  ),
);
