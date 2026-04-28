import { create } from "zustand";
import { useCallback } from "react";
import { AppView } from "../components/Header";
import { GeneratedImage } from "../types";
import { useDataStore } from "./dataStore";

export interface UIState {
  currentView: AppView;
  prompt: string;
  isLoading: boolean;
  isTranslating: boolean;
  isOptimizing: boolean;
  isUpscaling: boolean;
  isDownloading: boolean;
  isUploading: boolean;
  currentImageId: string | null;
  imageDimensions: { width: number; height: number } | null;
  isLiveMode: boolean;
  isOpfsHydrated: boolean;

  setCurrentView: (view: AppView) => void;
  setPrompt: (prompt: string) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsTranslating: (isTranslating: boolean) => void;
  setIsOptimizing: (isOptimizing: boolean) => void;
  setIsUpscaling: (isUpscaling: boolean) => void;
  setIsDownloading: (isDownloading: boolean) => void;
  setIsUploading: (isUploading: boolean) => void;
  setCurrentImageId: (id: string | null) => void;
  setImageDimensions: (
    dimensions: { width: number; height: number } | null,
  ) => void;
  setIsLiveMode: (isLive: boolean) => void;
  setIsOpfsHydrated: (isHydrated: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  currentView: "creation",
  prompt: "",
  isLoading: false,
  isTranslating: false,
  isOptimizing: false,
  isUpscaling: false,
  isDownloading: false,
  isUploading: false,
  currentImageId: null,
  imageDimensions: null,
  isLiveMode: false,
  isOpfsHydrated: false,

  setCurrentView: (currentView) => set({ currentView }),
  setPrompt: (prompt) => set({ prompt }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsTranslating: (isTranslating) => set({ isTranslating }),
  setIsOptimizing: (isOptimizing) => set({ isOptimizing }),
  setIsUpscaling: (isUpscaling) => set({ isUpscaling }),
  setIsDownloading: (isDownloading) => set({ isDownloading }),
  setIsUploading: (isUploading) => set({ isUploading }),
  setCurrentImageId: (currentImageId) => set({ currentImageId }),
  setImageDimensions: (imageDimensions) => set({ imageDimensions }),
  setIsLiveMode: (isLiveMode) => set({ isLiveMode }),
  setIsOpfsHydrated: (isOpfsHydrated) => set({ isOpfsHydrated }),
}));

/**
 * Derived selector: resolves currentImageId to a full GeneratedImage from dataStore.
 * Components should use this instead of storing the full object in uiStore.
 */
export const useCurrentImage = (): GeneratedImage | null => {
  const id = useUIStore((s) => s.currentImageId);
  const history = useDataStore((s) => s.history);
  if (!id) return null;
  return history.find((img) => img.id === id) ?? null;
};

/**
 * Compatibility wrapper: accepts either an image object (sets by ID) or null.
 * Supports the updater function pattern used by existing code.
 */
export const useSetCurrentImage = () => {
  const setId = useUIStore((s) => s.setCurrentImageId);
  const setHistory = useDataStore((s) => s.setHistory);

  return useCallback((
    imageOrFn:
      | GeneratedImage
      | null
      | ((prev: GeneratedImage | null) => GeneratedImage | null),
  ) => {
    if (typeof imageOrFn === "function") {
      // Updater pattern — needed for in-place mutations (e.g. videoUrl update)
      const history = useDataStore.getState().history;
      const currentId = useUIStore.getState().currentImageId;
      const current = currentId
        ? history.find((img) => img.id === currentId) ?? null
        : null;
      const updated = imageOrFn(current);

      if (updated) {
        // Update the image in history
        setHistory(
          history.map((img) => (img.id === updated.id ? updated : img)),
        );
        setId(updated.id);
      } else {
        setId(null);
      }
    } else if (imageOrFn) {
      setId(imageOrFn.id);
    } else {
      setId(null);
    }
  }, [setId, setHistory]);
};
