import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useSettingsStore } from "../store/settingsStore";
import { useUIStore, useCurrentImage, useSetCurrentImage } from "../store/uiStore";
import { useDataStore } from "../store/dataStore";
import { translations } from "../translations";
import { GeneratedImage, ModelOption, ProviderOption } from "../types";
import {
  generateGiteeImage,
  optimizePromptGitee,
  createVideoTask,
} from "../services/giteeService";
import { generateMSImage, optimizePromptMS } from "../services/msService";
import {
  generateImage,
  createVideoTaskHF,
  optimizePrompt as optimizePromptHF,
} from "../services/hfService";
import { generateA4FImage, optimizePromptA4F } from "../services/a4fService";
import { generateOpenAIImage } from "../services/openaiService";
import { generateGoogleImage } from "../services/googleService";
import {
  generateCustomImage,
  generateCustomVideo,
  optimizePromptCustom,
} from "../services/customService";
import {
  translatePrompt,
  getLiveModelConfig,
  getTextModelConfig,
  getCustomProviders,
  getVideoSettings,
  getServiceMode,
  fetchBlob,
  getExtensionFromUrl,
  convertBlobToPng,
  addToPromptHistory,
} from "../services/utils";
import { saveTempFileToOPFS } from "../services/storageService";
import { resolveErrorMessage } from "../services/errorUtils";
import {
  HF_MODEL_OPTIONS,
  GITEE_MODEL_OPTIONS,
  MS_MODEL_OPTIONS,
  A4F_MODEL_OPTIONS,
  getModelConfig,
  getGuidanceScaleConfig,
  LIVE_MODELS,
} from "../constants";

/**
 * Hook that encapsulates all image/video generation logic for CreationView.
 * Handles: generate, optimize prompt, live/video generation, timer, reset.
 */
export const useCreationGeneration = () => {
  const {
    language,
    provider,
    model,
    setModel,
    aspectRatio,
    seed,
    steps,
    setSteps,
    guidanceScale,
    setGuidanceScale,
    autoTranslate,
    resetSettings,
  } = useSettingsStore();

  const {
    prompt,
    setPrompt,
    setIsLoading,
    setIsTranslating,
    setIsOptimizing,
    setIsLiveMode,
    imageDimensions,
    setImageDimensions,
  } = useUIStore();

  const currentImage = useCurrentImage();
  const setCurrentImage = useSetCurrentImage();

  const { setHistory } = useDataStore();

  const t = translations[language];

  // Timer state
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    setElapsedTime(0);
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedTime((Date.now() - startTime) / 1000);
    }, 100);
    return startTime;
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // --- Image Generation ---
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    addToPromptHistory(prompt);
    setIsLoading(true);
    setImageDimensions(null);
    setIsLiveMode(false);

    let finalPrompt = prompt;
    if (autoTranslate) {
      setIsTranslating(true);
      try {
        finalPrompt = await translatePrompt(prompt);
        setPrompt(finalPrompt);
      } catch (err: any) {
        console.error("Translation failed", err);
      } finally {
        setIsTranslating(false);
      }
    }

    const startTime = startTimer();

    try {
      const seedNumber = seed.trim() === "" ? undefined : parseInt(seed, 10);
      const gsConfig = getGuidanceScaleConfig(model, provider);
      const currentGuidanceScale = gsConfig ? guidanceScale : undefined;
      const requestHD = true;

      let result;
      if (provider === "gitee") {
        result = await generateGiteeImage(
          model,
          finalPrompt,
          aspectRatio,
          seedNumber,
          steps,
          requestHD,
          currentGuidanceScale,
        );
      } else if (provider === "modelscope") {
        result = await generateMSImage(
          model,
          finalPrompt,
          aspectRatio,
          seedNumber,
          steps,
          requestHD,
          currentGuidanceScale,
        );
      } else if (provider === "huggingface") {
        result = await generateImage(
          model,
          finalPrompt,
          aspectRatio,
          seedNumber,
          requestHD,
          steps,
          currentGuidanceScale,
        );
      } else if (provider === "a4f") {
        result = await generateA4FImage(
          model,
          finalPrompt,
          aspectRatio,
          seedNumber,
          steps,
          requestHD,
          currentGuidanceScale,
        );
      } else if (provider === "openai") {
        result = await generateOpenAIImage(
          model,
          finalPrompt,
          aspectRatio,
          seedNumber,
          steps,
          requestHD,
          currentGuidanceScale,
        );
      } else if (provider === "google") {
        result = await generateGoogleImage(
          model,
          finalPrompt,
          aspectRatio,
          seedNumber,
          steps,
          requestHD,
          currentGuidanceScale,
        );
      } else {
        const customProviders = getCustomProviders();
        const activeProvider = customProviders.find((p) => p.id === provider);
        if (activeProvider) {
          result = await generateCustomImage(
            activeProvider,
            model,
            finalPrompt,
            aspectRatio,
            seedNumber,
            steps,
            currentGuidanceScale,
            requestHD,
          );
        } else {
          throw new Error("Invalid provider");
        }
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      let fileUrl = result.url;
      let fileName = undefined;

      try {
        let blob = await fetchBlob(result.url);
        const urlExt = getExtensionFromUrl(result.url);
        let ext = urlExt;
        if (!ext) {
          const mimeExt = blob.type.split("/")[1];
          ext = mimeExt && mimeExt.length <= 4 ? mimeExt : "png";
        }

        if (ext.toLowerCase() !== "png") {
          try {
            const pngBlob = await convertBlobToPng(blob);
            blob = pngBlob;
            ext = "png";
          } catch (convErr) {
            console.warn(
              "Image conversion to PNG failed, saving as is",
              convErr,
            );
          }
        }

        fileName = `${result.id}.${ext}`;
        await saveTempFileToOPFS(blob, fileName);
        fileUrl = URL.createObjectURL(blob);
      } catch (e) {
        console.warn(
          "Failed to cache image to OPFS tmp, using original URL",
          e,
        );
      }

      const newImage = {
        ...result,
        url: fileUrl,
        fileName,
        duration,
        provider,
        guidanceScale: currentGuidanceScale,
      };

      setCurrentImage(newImage);
      setHistory((prev) => [newImage, ...prev]);
    } catch (err: any) {
      toast.error(resolveErrorMessage(err, t, "generationFailed"));
    } finally {
      stopTimer();
      setIsLoading(false);
    }
  };

  // --- Prompt Optimization ---
  const handleOptimizePrompt = async () => {
    if (!prompt.trim()) return;
    addToPromptHistory(prompt);
    setIsOptimizing(true);
    try {
      const config = getTextModelConfig();
      let optimized = "";
      if (config.provider === "gitee")
        optimized = await optimizePromptGitee(prompt, config.model);
      else if (config.provider === "modelscope")
        optimized = await optimizePromptMS(prompt, config.model);
      else if (config.provider === "a4f")
        optimized = await optimizePromptA4F(prompt, config.model);
      else if (config.provider === "huggingface")
        optimized = await optimizePromptHF(prompt, config.model);
      else {
        const customProviders = getCustomProviders();
        const activeProvider = customProviders.find(
          (p) => p.id === config.provider,
        );
        if (activeProvider)
          optimized = await optimizePromptCustom(
            activeProvider,
            config.model,
            prompt,
          );
        else optimized = await optimizePromptHF(prompt, config.model);
      }
      setPrompt(optimized);
    } catch (err: any) {
      console.error("Optimization failed", err);
      toast.error(resolveErrorMessage(err, t, "error_prompt_optimization_failed"));
    } finally {
      setIsOptimizing(false);
    }
  };

  // --- Video / Live Generation ---
  const handleLiveClick = async () => {
    if (!currentImage) return;
    if (currentImage.videoStatus === "generating") return;

    let liveConfig = getLiveModelConfig();
    const serviceMode = getServiceMode();
    const customProviders = getCustomProviders();
    const availableLiveModels: { provider: string; model: string }[] = [];

    if (serviceMode === "local" || serviceMode === "hydration") {
      LIVE_MODELS.forEach((m) => {
        const parts = m.value.split(":");
        if (parts.length >= 2)
          availableLiveModels.push({
            provider: parts[0],
            model: parts.slice(1).join(":"),
          });
      });
    }
    if (serviceMode === "server" || serviceMode === "hydration") {
      customProviders.forEach((cp) => {
        if (cp.models.video) {
          cp.models.video.forEach((m) =>
            availableLiveModels.push({ provider: cp.id, model: m.id }),
          );
        }
      });
    }

    const isConfigValid = availableLiveModels.some(
      (m) => m.provider === liveConfig.provider && m.model === liveConfig.model,
    );
    if (!isConfigValid && availableLiveModels.length > 0) {
      liveConfig = availableLiveModels[0];
    } else if (availableLiveModels.length === 0) {
      toast.error(String(t.liveNotSupported || "No Live models available"));
      return;
    }

    let width = imageDimensions?.width || 1024;
    let height = imageDimensions?.height || 1024;
    const currentVideoProvider = liveConfig.provider as ProviderOption;
    let imageInput: string | Blob = currentImage.url;
    try {
      if (currentImage.url.startsWith("opfs://")) {
        imageInput = currentImage.url;
      } else {
        imageInput = await fetchBlob(currentImage.url);
      }
    } catch (e) {
      console.warn(
        "Failed to fetch image blob for Live gen, using original URL",
        e,
      );
    }

    if (currentVideoProvider === "gitee") {
      if (typeof imageInput === "string" && imageInput.startsWith("opfs://")) {
        try {
          imageInput = await fetchBlob(imageInput);
        } catch (e) {
          console.error("Failed to fetch OPFS blob for Gitee", e);
          toast.error("Failed to prepare image");
          return;
        }
      }

      const imgAspectRatio = width / height;
      if (width >= height) {
        height = 720;
        width = Math.round(height * imgAspectRatio);
      } else {
        width = 720;
        height = Math.round(width / imgAspectRatio);
      }
      if (width % 2 !== 0) width -= 1;
      if (height % 2 !== 0) height -= 1;
    }

    try {
      const loadingImage = {
        ...currentImage,
        videoStatus: "generating",
        videoProvider: currentVideoProvider,
      } as GeneratedImage;
      setCurrentImage(loadingImage);
      setHistory((prev) =>
        prev.map((img) => (img.id === loadingImage.id ? loadingImage : img)),
      );

      if (currentVideoProvider === "gitee") {
        const taskId = await createVideoTask(imageInput, width, height);
        const nextPollTime = Date.now() + 400 * 1000;
        const taskedImage = {
          ...loadingImage,
          videoTaskId: taskId,
          videoNextPollTime: nextPollTime,
        } as GeneratedImage;
        setCurrentImage(taskedImage);
        setHistory((prev) =>
          prev.map((img) => (img.id === taskedImage.id ? taskedImage : img)),
        );
      } else if (currentVideoProvider === "huggingface") {
        const videoUrl = await createVideoTaskHF(imageInput, currentImage.seed);

        const videoBlob = await fetchBlob(videoUrl);
        const videoFileName = `live-${currentImage.id}.mp4`;
        await saveTempFileToOPFS(videoBlob, videoFileName);
        const objectUrl = URL.createObjectURL(videoBlob);

        const successImage = {
          ...loadingImage,
          videoStatus: "success",
          videoUrl: objectUrl,
          videoFileName: videoFileName,
        } as GeneratedImage;

        setHistory((prev) =>
          prev.map((img) => (img.id === successImage.id ? successImage : img)),
        );
        setCurrentImage((prev) =>
          prev && prev.id === successImage.id ? successImage : prev,
        );
        if (useUIStore.getState().currentImageId === successImage.id)
          setIsLiveMode(true);
      } else {
        const activeProvider = customProviders.find(
          (p) => p.id === currentVideoProvider,
        );
        if (activeProvider) {
          const settings = getVideoSettings(currentVideoProvider);
          const urlToUse =
            typeof imageInput === "string" ? imageInput : currentImage.url;
          const result = await generateCustomVideo(
            activeProvider,
            liveConfig.model,
            urlToUse,
            settings.prompt,
            settings.duration,
            currentImage.seed ?? 42,
            settings.steps,
            settings.guidance,
          );
          if (result.taskId) {
            const nextPollTime = result.predict
              ? Date.now() + result.predict * 1000
              : undefined;
            const taskedImage = {
              ...loadingImage,
              videoTaskId: result.taskId,
              videoNextPollTime: nextPollTime,
            } as GeneratedImage;
            setCurrentImage(taskedImage);
            setHistory((prev) =>
              prev.map((img) =>
                img.id === taskedImage.id ? taskedImage : img,
              ),
            );
          } else if (result.url) {
            const videoBlob = await fetchBlob(result.url);
            const videoFileName = `live-${currentImage.id}.mp4`;
            await saveTempFileToOPFS(videoBlob, videoFileName);
            const objectUrl = URL.createObjectURL(videoBlob);

            const successImage = {
              ...loadingImage,
              videoStatus: "success",
              videoUrl: objectUrl,
              videoFileName: videoFileName,
            } as GeneratedImage;

            setHistory((prev) =>
              prev.map((img) =>
                img.id === successImage.id ? successImage : img,
              ),
            );
            setCurrentImage((prev) =>
              prev && prev.id === successImage.id ? successImage : prev,
            );
            if (useUIStore.getState().currentImageId === successImage.id)
              setIsLiveMode(true);
          } else {
            throw new Error("Invalid response from video provider");
          }
        } else {
          throw new Error(t.liveNotSupported || "Live provider not supported");
        }
      }
    } catch (e: any) {
      console.error("Video Generation Failed", e);
      const failedImage = {
        ...currentImage,
        videoStatus: "failed",
        videoError: e.message,
      } as GeneratedImage;
      setCurrentImage((prev) =>
        prev && prev.id === failedImage.id ? failedImage : prev,
      );
      setHistory((prev) =>
        prev.map((img) => (img.id === failedImage.id ? failedImage : img)),
      );
      toast.error(String(t.liveError));
    }
  };

  // --- Reset ---
  const handleReset = () => {
    resetSettings();
    let newModel = model;
    
    if (provider === "gitee")
      newModel = GITEE_MODEL_OPTIONS[0].value as ModelOption;
    else if (provider === "modelscope")
      newModel = MS_MODEL_OPTIONS[0].value as ModelOption;
    else if (provider === "huggingface")
      newModel = HF_MODEL_OPTIONS[0].value as ModelOption;
    else if (provider === "a4f")
      newModel = A4F_MODEL_OPTIONS[0].value as ModelOption;
    else {
      const customProviders = getCustomProviders();
      const activeCustom = customProviders.find((p) => p.id === provider);
      if (
        activeCustom?.models?.generate &&
        activeCustom.models.generate.length > 0
      ) {
        newModel = activeCustom.models.generate[0].id as ModelOption;
      }
    }
    
    setModel(newModel);

    let defaultSteps = 9;
    let defaultGs = 7.5;
    let hasGs = false;

    const customProviders = getCustomProviders();
    const activeCustom = customProviders.find((p) => p.id === provider);

    if (activeCustom) {
      const customModel = activeCustom.models.generate?.find(m => m.id === newModel);
      if (customModel) {
        if (customModel.steps) defaultSteps = customModel.steps.default;
        if (customModel.guidance) {
          hasGs = true;
          defaultGs = customModel.guidance.default;
        }
      } else {
        const fallback = getModelConfig(provider, newModel);
        defaultSteps = fallback.default;
        const fallbackGs = getGuidanceScaleConfig(newModel, provider);
        if (fallbackGs) {
          hasGs = true;
          defaultGs = fallbackGs.default;
        }
      }
    } else {
      const config = getModelConfig(provider, newModel);
      defaultSteps = config.default;
      const gsConfig = getGuidanceScaleConfig(newModel, provider);
      if (gsConfig) {
        hasGs = true;
        defaultGs = gsConfig.default;
      }
    }

    setSteps(defaultSteps);
    if (hasGs) {
      setGuidanceScale(defaultGs);
    }
  };

  return {
    elapsedTime,
    handleGenerate,
    handleOptimizePrompt,
    handleLiveClick,
    handleReset,
  };
};
