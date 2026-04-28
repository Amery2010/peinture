import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSettingsStore } from "../store/settingsStore";
import { useUIStore, useSetCurrentImage } from "../store/uiStore";
import { useDataStore } from "../store/dataStore";
import { useConfigStore } from "../store/configStore";
import {
  initOpfsDirs,
  readTempFileFromOPFS,
  deleteTempFileFromOPFS,
  saveTempFileToOPFS,
  cleanupOldTempFiles,
} from "../services/storageService";
import { GeneratedImage, CustomProvider, ModelOption } from "../types";
import {
  getServiceMode,
  getCustomProviders,
  addCustomProvider,
  generateUUID,
  fetchBlob,
} from "../services/utils";
import { getDefaultModelParams } from "../services/modelUtils";
import {
  fetchServerModels,
  getCustomTaskStatus,
} from "../services/customService";
import { getGiteeTaskStatus } from "../services/giteeService";
import {
  HF_MODEL_OPTIONS,
  GITEE_MODEL_OPTIONS,
  MS_MODEL_OPTIONS,
  A4F_MODEL_OPTIONS,
} from "../constants";

export const useAppInit = () => {
  const { provider, setProvider, model, setModel, setSteps, setGuidanceScale } =
    useSettingsStore();
  const { setIsLiveMode, currentView } = useUIStore();
  const setCurrentImage = useSetCurrentImage();
  const setHistory = useDataStore((s) => s.setHistory);
  const setServiceMode = useConfigStore((s) => s.setServiceMode);
  const _hasHydrated = useConfigStore((s) => s._hasHydrated);

  // Guard to prevent duplicate server mode initialization
  const serverInitRef = useRef(false);

  // Track previous provider/model to distinguish hydration from user-initiated changes.
  // On initial mount (null), we skip overwriting steps/guidance so persisted values survive.
  const prevProviderModelRef = useRef<{ provider: string; model: string } | null>(null);

  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [accessPassword, setAccessPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // 1. Hydrate history from OPFS on mount
  useEffect(() => {
    const hydrateHistory = async () => {
      await initOpfsDirs();
      await cleanupOldTempFiles();

      const currentHistory = useDataStore.getState().history;
      const now = Date.now();
      const oneDayInMs = 24 * 60 * 60 * 1000;

      const validHistory: GeneratedImage[] = [];
      let hasChanges = false;

      for (const img of currentHistory) {
        if (now - img.timestamp >= oneDayInMs) {
          const filenameToDelete = img.fileName || `${img.id}.png`;
          await deleteTempFileFromOPFS(filenameToDelete);
          if (img.videoFileName)
            await deleteTempFileFromOPFS(img.videoFileName);
          // Revoke stale blob URLs from previous session
          if (img.url?.startsWith("blob:")) URL.revokeObjectURL(img.url);
          if (img.videoUrl?.startsWith("blob:")) URL.revokeObjectURL(img.videoUrl);
          hasChanges = true;
        } else {
          const filenameToLoad = img.fileName || `${img.id}.png`;
          const opfsBlob = await readTempFileFromOPFS(filenameToLoad);

          if (opfsBlob) {
            const hydratedImg = { ...img };
            // Revoke previous blob URL before creating a new one
            if (hydratedImg.url?.startsWith("blob:")) URL.revokeObjectURL(hydratedImg.url);
            hydratedImg.url = URL.createObjectURL(opfsBlob);

            // Hydrate video URL if exists locally
            if (hydratedImg.videoFileName) {
              const videoBlob = await readTempFileFromOPFS(hydratedImg.videoFileName);
              if (videoBlob) {
                if (hydratedImg.videoUrl?.startsWith("blob:")) URL.revokeObjectURL(hydratedImg.videoUrl);
                hydratedImg.videoUrl = URL.createObjectURL(videoBlob);
              }
            }

            validHistory.push(hydratedImg);
            hasChanges = true;
          } else {
            if (!img.url.startsWith("blob:")) {
              validHistory.push(img);
            } else {
              URL.revokeObjectURL(img.url);
              hasChanges = true;
            }
          }
        }
      }

      if (hasChanges || validHistory.length !== currentHistory.length) {
        setHistory(validHistory);
      }

      const currentImgId = useUIStore.getState().currentImageId;
      if (validHistory.length > 0 && !currentImgId) {
        const firstImg = validHistory[0];
        setCurrentImage(firstImg);
        if (firstImg.videoUrl && firstImg.videoStatus === "success") {
          setIsLiveMode(true);
        }
      }

      useUIStore.getState().setIsOpfsHydrated(true);
    };

    hydrateHistory();
  }, [setCurrentImage, setHistory, setIsLiveMode]);

  // 2. Server Mode Initialization (run once after hydration)
  useEffect(() => {
    if (showPasswordModal || !_hasHydrated || serverInitRef.current) return;

    const initServiceMode = async () => {
      const mode = getServiceMode();

      if (mode === "server") {
        serverInitRef.current = true;
        try {
          const customProviders = getCustomProviders();
          const existingServer = customProviders.find(
            (p) => p.name === "Server" && p.apiUrl === "/api",
          );
          const storedToken = existingServer?.token;

          const models = await fetchServerModels(storedToken);

          const serverProvider: CustomProvider = {
            id: existingServer ? existingServer.id : generateUUID(),
            name: "Server",
            apiUrl: "/api",
            token: storedToken || "",
            models,
            enabled: true,
          };

          addCustomProvider(serverProvider);

          if (models.generate && models.generate.length > 0) {
            const currentProviderIsCustom = customProviders.some(
              (p) => p.id === provider,
            );
            if (
              !provider ||
              provider === "huggingface" ||
              (currentProviderIsCustom && !existingServer)
            ) {
              setProvider(serverProvider.id);
              setModel(models.generate[0].id);
            }
          }
        } catch (e: any) {
          serverInitRef.current = false; // Allow retry on error
          if (e.message === "401") {
            setShowPasswordModal(true);
          } else {
            console.error("Failed to init server mode", e);
          }
        }
      }
    };

    initServiceMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, showPasswordModal]);

  // 3. Password Handlers
  const handlePasswordSubmit = async () => {
    setPasswordError(false);
    try {
      const models = await fetchServerModels(accessPassword);

      const customProviders = getCustomProviders();
      const existing = customProviders.find(
        (p) => p.name === "Server" && p.apiUrl === "/api",
      );

      const serverProvider: CustomProvider = {
        id: existing ? existing.id : generateUUID(),
        name: "Server",
        apiUrl: "/api",
        token: accessPassword,
        models,
        enabled: true,
      };

      addCustomProvider(serverProvider);
      setServiceMode("server"); // Use Store Action

      if (models.generate && models.generate.length > 0) {
        setProvider(serverProvider.id);
        setModel(models.generate[0].id);
      }

      setShowPasswordModal(false);
    } catch {
      setPasswordError(true);
    }
  };

  const handleSwitchToLocal = () => {
    setServiceMode("local"); // Use Store Action
    setShowPasswordModal(false);
    setProvider("huggingface");
    setModel(HF_MODEL_OPTIONS[0].value);
  };

  // 4. Polling for Video Tasks
  useEffect(() => {
    let isMounted = true;
    let timeoutId: any;

    const poll = async () => {
      if (!isMounted) return;

      const currentHist = useDataStore.getState().history;

      const pendingVideos = currentHist.filter(
        (img) => img.videoStatus === "generating" && img.videoTaskId,
      );

      if (pendingVideos.length === 0) {
        // No pending videos — stop polling. New video tasks will re-trigger via useEffect deps.
        return;
      }

      const now = Date.now();
      const MAX_POLL_TIME = 10 * 60 * 1000; // 10 minutes

      const readyToPoll = pendingVideos.filter((img) => {
        if (img.videoTimestamp && now - img.videoTimestamp > MAX_POLL_TIME) {
          return true; // We will handle timeout in the map function
        }
        return !img.videoNextPollTime || now >= img.videoNextPollTime;
      });

      if (readyToPoll.length === 0) {
        const nextTimes = pendingVideos.map(
          (img) => img.videoNextPollTime || 5000,
        );
        const minTime = Math.min(...nextTimes);
        const delay = Math.max(5000, minTime - now);
        timeoutId = setTimeout(poll, delay);
        return;
      }

      const updates = await Promise.all(
        readyToPoll.map(async (img) => {
          if (!img.videoTaskId) return null;
          
          if (img.videoTimestamp && now - img.videoTimestamp > MAX_POLL_TIME) {
            return { id: img.id, status: "failed", error: "Generation timed out" };
          }

          try {
            let result = null;
            if (img.videoProvider === "gitee") {
              result = await getGiteeTaskStatus(img.videoTaskId);
            } else if (img.videoProvider) {
              const customProviders = getCustomProviders();
              const provider = customProviders.find(
                (p) => p.id === img.videoProvider,
              );
              if (provider) {
                result = await getCustomTaskStatus(provider, img.videoTaskId);
              }
            }

            if (
              result &&
              (result.status === "success" || result.status === "failed")
            ) {
              // If success, download video to OPFS
              if (result.status === "success" && result.videoUrl) {
                try {
                  const videoBlob = await fetchBlob(result.videoUrl);
                  const videoFileName = `live-${img.id}.mp4`;
                  await saveTempFileToOPFS(videoBlob, videoFileName);
                  const objectUrl = URL.createObjectURL(videoBlob);
                  return {
                    id: img.id,
                    ...result,
                    videoUrl: objectUrl,
                    videoFileName,
                  };
                } catch (e) {
                  console.error("Failed to cache video", e);
                  return { id: img.id, ...result };
                }
              }
              return { id: img.id, ...result };
            }
            return null;
          } catch (e) {
            console.error("Failed to poll task", img.videoTaskId, e);
            return null;
          }
        }),
      );

      const validUpdates = updates.filter((u) => u !== null) as {
        id: string;
        status: string;
        videoUrl?: string;
        error?: string;
        videoFileName?: string;
      }[];

      if (validUpdates.length > 0 && isMounted) {
        setHistory((prev) =>
          prev.map((item) => {
            const update = validUpdates.find((u) => u.id === item.id);
            if (!update) return item;

            if (update.status === "success" && update.videoUrl) {
              return {
                ...item,
                videoStatus: "success",
                videoUrl: update.videoUrl,
                videoFileName: update.videoFileName,
              };
            } else if (update.status === "failed") {
              const failMsg = update.error || "Video generation failed";
              return { ...item, videoStatus: "failed", videoError: failMsg };
            }
            return item;
          }),
        );

        const currImgId = useUIStore.getState().currentImageId;
        if (currImgId) {
          const relevantUpdate = validUpdates.find((u) => u.id === currImgId);
          if (relevantUpdate) {
            if (
              relevantUpdate.status === "success" &&
              relevantUpdate.videoUrl
            ) {
              setCurrentImage((prev) =>
                prev
                  ? {
                      ...prev,
                      videoStatus: "success",
                      videoUrl: relevantUpdate.videoUrl,
                      videoFileName: relevantUpdate.videoFileName,
                    }
                  : null,
              );
              setIsLiveMode(true);
            } else if (relevantUpdate.status === "failed") {
              setCurrentImage((prev) =>
                prev
                  ? {
                      ...prev,
                      videoStatus: "failed",
                      videoError:
                        relevantUpdate.error || "Video generation failed",
                    }
                  : null,
              );
              toast.error(
                String(relevantUpdate.error || "Video generation failed"),
              );
            }
          }
        }
      }

      if (isMounted) timeoutId = setTimeout(poll, 5000);
    };

    poll();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [setCurrentImage, setHistory, setIsLiveMode]);

  // 5. Model/Steps Initialization on View Change
  useEffect(() => {
    if (currentView === "creation") {
      let options: { value: string; label: string }[] = [];
      if (provider === "gitee") options = GITEE_MODEL_OPTIONS;
      else if (provider === "modelscope") options = MS_MODEL_OPTIONS;
      else if (provider === "huggingface") options = HF_MODEL_OPTIONS;
      else if (provider === "a4f") options = A4F_MODEL_OPTIONS;
      else {
        const customProviders = getCustomProviders();
        const activeCustom = customProviders.find((p) => p.id === provider);
        if (activeCustom?.models?.generate) {
          options = activeCustom.models.generate.map((m) => ({
            value: m.id,
            label: m.name,
          }));
        }
      }

      if (options.length > 0) {
        const isValid = options.some((o) => o.value === model);
        if (!isValid) {
          const defaultModel = options[0].value as ModelOption;
          setModel(defaultModel);
        }
      }
    }
  }, [currentView, provider, model, setModel]);

  // 6. Update steps/guidance when provider/model changes (but NOT on initial hydration)
  useEffect(() => {
    const prev = prevProviderModelRef.current;

    // On first mount / hydration: record current values without overwriting persisted settings
    if (prev === null) {
      prevProviderModelRef.current = { provider, model };
      return;
    }

    // If neither provider nor model actually changed, nothing to do
    if (prev.provider === provider && prev.model === model) {
      return;
    }

    // User actively switched provider or model — update the ref and reset to model defaults
    prevProviderModelRef.current = { provider, model };

    const { defaultSteps, defaultGs, hasGs } = getDefaultModelParams(provider, model);

    // Reset to default to ensure parameters do not exceed bounds of the active model
    setSteps(defaultSteps);
    if (hasGs) {
      setGuidanceScale(defaultGs);
    }
  }, [provider, model, setSteps, setGuidanceScale]);

  return {
    showPasswordModal,
    accessPassword,
    passwordError,
    setAccessPassword,
    handlePasswordSubmit,
    handleSwitchToLocal,
  };
};
