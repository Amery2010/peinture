import { useState, useEffect } from "react";
import { useSettingsStore } from "../store/settingsStore";
import { useConfigStore } from "../store/configStore";
import {
  CustomProvider,
  RemoteModelList,
  ServiceMode,
  VideoSettings,
  UnifiedModelOption,
} from "../types";
import {
  getSystemPromptContent,
  saveSystemPromptContent,
  getTranslationPromptContent,
  saveTranslationPromptContent,
  getVideoSettings,
  saveVideoSettings,
  DEFAULT_VIDEO_SETTINGS,
  getEditModelConfig,
  saveEditModelConfig,
  getLiveModelConfig,
  saveLiveModelConfig,
  getTextModelConfig,
  saveTextModelConfig,
  getUpscalerModelConfig,
  saveUpscalerModelConfig,
  getCustomProviders,
  addCustomProvider,
  removeCustomProvider,
  saveCustomProviders,
  generateUUID,
  getServiceMode,
  saveServiceMode,
} from "../services/utils";
import { transformModelList } from "../services/customService";
import {
  HF_MODEL_OPTIONS,
  GITEE_MODEL_OPTIONS,
  MS_MODEL_OPTIONS,
  A4F_MODEL_OPTIONS,
  EDIT_MODELS,
  LIVE_MODELS,
  TEXT_MODELS,
  UPSCALER_MODELS,
} from "../constants";
import { useTokensForm } from "./useTokensForm";
import { useStorageForm } from "./useStorageForm";

export const useSettingsForm = (isOpen: boolean, onClose: () => void) => {
  const { provider, setProvider, model, setModel } = useSettingsStore();
  const {
    setProviderTokens,
    openaiConfig: initialOpenaiConfig,
    googleConfig: initialGoogleConfig,
    setOpenAIConfig,
    setGoogleConfig,
  } = useConfigStore();

  // Composed sub-hooks
  const tokensForm = useTokensForm();
  const storageForm = useStorageForm();

  // -- State --
  const [activeTab, setActiveTab] = useState<
    "general" | "provider" | "models" | "prompt" | "live" | "s3" | "webdav"
  >("general");
  const [serviceMode, setServiceMode] = useState<ServiceMode>("local");

  const [openaiConfigState, setOpenAIConfigState] =
    useState(initialOpenaiConfig);
  const [googleConfigState, setGoogleConfigState] =
    useState(initialGoogleConfig);

  // Custom Providers
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
  const [newProviderName, setNewProviderName] = useState("");
  const [newProviderUrl, setNewProviderUrl] = useState("");
  const [newProviderToken, setNewProviderToken] = useState("");
  const [fetchStatus, setFetchStatus] = useState<
    "idle" | "loading" | "success" | "failed"
  >("idle");
  const [fetchedModels, setFetchedModels] = useState<RemoteModelList | null>(
    null,
  );
  const [refreshingProviders, setRefreshingProviders] = useState<
    Record<string, boolean>
  >({});
  const [refreshSuccessProviders, setRefreshSuccessProviders] = useState<
    Record<string, boolean>
  >({});
  const [refreshErrorProviders, setRefreshErrorProviders] = useState<
    Record<string, boolean>
  >({});

  // Prompts
  const [systemPrompt, setSystemPrompt] = useState("");
  const [translationPrompt, setTranslationPrompt] = useState("");

  // Unified Models
  const [creationModelValue, setCreationModelValue] = useState<string>("");
  const [editModelValue, setEditModelValue] = useState<string>("");
  const [liveModelValue, setLiveModelValue] = useState<string>("");
  const [textModelValue, setTextModelValue] = useState<string>("");
  const [upscalerModelValue, setUpscalerModelValue] = useState<string>("");

  // Video
  const [videoSettings, setVideoSettings] = useState<VideoSettings>(
    DEFAULT_VIDEO_SETTINGS["huggingface"],
  );

  // Helper to refresh a single provider's models
  const performModelRefresh = async (p: CustomProvider) => {
    setRefreshingProviders((prev) => ({ ...prev, [p.id]: true }));
    setRefreshSuccessProviders((prev) => ({ ...prev, [p.id]: false }));
    setRefreshErrorProviders((prev) => ({ ...prev, [p.id]: false }));

    try {
      const url = p.apiUrl.replace(/\/$/, "") + "/v1/models";
      const headers: Record<string, string> = {};
      if (p.token) headers["Authorization"] = `Bearer ${p.token}`;
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error("Fetch failed");
      const rawData = await response.json();
      const transformedData = transformModelList(rawData);

      setCustomProviders((prev) =>
        prev.map((cp) =>
          cp.id === p.id ? { ...cp, models: transformedData } : cp,
        ),
      );
      setRefreshSuccessProviders((prev) => ({ ...prev, [p.id]: true }));
      setTimeout(
        () =>
          setRefreshSuccessProviders((prev) => ({ ...prev, [p.id]: false })),
        2500,
      );
    } catch (e) {
      console.error(`Failed to refresh models for ${p.name}`, e);
      setRefreshErrorProviders((prev) => ({ ...prev, [p.id]: true }));
    } finally {
      setRefreshingProviders((prev) => ({ ...prev, [p.id]: false }));
    }
  };

  // -- Initialization --
  // Only re-run when the dialog opens or when the provider/model changes.
  // tokensForm/storageForm are NOT included as deps because they are new
  // object references on every render, which would cause an infinite loop.
  useEffect(() => {
    if (isOpen) {
      setServiceMode(getServiceMode());

      // Pull latest config from store
      setOpenAIConfigState(useConfigStore.getState().openaiConfig);
      setGoogleConfigState(useConfigStore.getState().googleConfig);

      // Initialize composed sub-hooks
      tokensForm.initializeTokens();
      storageForm.initializeStorage();

      const initProviders = getCustomProviders();
      setCustomProviders(initProviders);

      // Auto-refresh custom providers
      initProviders.forEach((p) => {
        if (p.enabled) {
          performModelRefresh(p);
        }
      });

      setSystemPrompt(getSystemPromptContent());
      setTranslationPrompt(getTranslationPromptContent());

      setVideoSettings(getVideoSettings(provider));

      const editConfig = getEditModelConfig();
      setEditModelValue(`${editConfig.provider}:${editConfig.model}`);

      const liveConfig = getLiveModelConfig();
      setLiveModelValue(`${liveConfig.provider}:${liveConfig.model}`);

      const textConfig = getTextModelConfig();
      setTextModelValue(`${textConfig.provider}:${textConfig.model}`);

      const upscalerConfig = getUpscalerModelConfig();
      setUpscalerModelValue(
        `${upscalerConfig.provider}:${upscalerConfig.model}`,
      );

      if (provider && model) {
        setCreationModelValue(`${provider}:${model}`);
      }
    } else {
      setActiveTab("general");
      setNewProviderName("");
      setNewProviderUrl("");
      setNewProviderToken("");
      setFetchedModels(null);
      setFetchStatus("idle");
      setRefreshErrorProviders({});
      setRefreshSuccessProviders({});
      setRefreshingProviders({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, provider, model]);

  // -- Validation Effect --
  useEffect(() => {
    const getValidValues = (
      type: "generate" | "edit" | "video" | "text" | "upscaler",
      baseList: UnifiedModelOption[],
    ) => {
      const valid = new Set<string>();
      const isLocal = serviceMode === "local" || serviceMode === "hydration";
      const isServer = serviceMode === "server" || serviceMode === "hydration";

      if (isLocal) {
        baseList
          .filter((m) => m.provider === "huggingface")
          .forEach((m) => valid.add(m.value));
        if (
          tokensForm.giteeToken ||
          useConfigStore.getState().tokens.gitee?.length > 0
        )
          baseList
            .filter((m) => m.provider === "gitee")
            .forEach((m) => valid.add(m.value));
        if (
          tokensForm.msToken ||
          useConfigStore.getState().tokens.modelscope?.length > 0
        )
          baseList
            .filter((m) => m.provider === "modelscope")
            .forEach((m) => valid.add(m.value));
        if (
          tokensForm.a4fToken ||
          useConfigStore.getState().tokens.a4f?.length > 0
        )
          baseList
            .filter((m) => m.provider === "a4f")
            .forEach((m) => valid.add(m.value));
        if (
          tokensForm.openaiToken ||
          useConfigStore.getState().tokens.openai?.length > 0
        )
          baseList
            .filter((m) => m.provider === "openai")
            .forEach((m) => valid.add(m.value));
        if (
          tokensForm.googleToken ||
          useConfigStore.getState().tokens.google?.length > 0
        )
          baseList
            .filter((m) => m.provider === "google")
            .forEach((m) => valid.add(m.value));
      }

      if (isServer) {
        customProviders.forEach((cp) => {
          const models = cp.models[type];
          if (models) {
            models.forEach((m) => valid.add(`${cp.id}:${m.id}`));
          }
        });
      }
      return Array.from(valid);
    };

    const baseCreationList: UnifiedModelOption[] = [
      ...HF_MODEL_OPTIONS.map((m) => ({
        label: m.label,
        value: `huggingface:${m.value}`,
        provider: "huggingface" as any,
      })),
      ...GITEE_MODEL_OPTIONS.map((m) => ({
        label: m.label,
        value: `gitee:${m.value}`,
        provider: "gitee" as any,
      })),
      ...MS_MODEL_OPTIONS.map((m) => ({
        label: m.label,
        value: `modelscope:${m.value}`,
        provider: "modelscope" as any,
      })),
      ...A4F_MODEL_OPTIONS.map((m) => ({
        label: m.label,
        value: `a4f:${m.value}`,
        provider: "a4f" as any,
      })),
    ];

    const validCreation = getValidValues("generate", baseCreationList);
    if (
      validCreation.length > 0 &&
      (!creationModelValue || !validCreation.includes(creationModelValue))
    ) {
      setCreationModelValue(validCreation[0]);
    }

    const validEdit = getValidValues("edit", EDIT_MODELS);
    if (
      validEdit.length > 0 &&
      (!editModelValue || !validEdit.includes(editModelValue))
    ) {
      setEditModelValue(validEdit[0]);
    }

    const validLive = getValidValues("video", LIVE_MODELS);
    if (
      validLive.length > 0 &&
      (!liveModelValue || !validLive.includes(liveModelValue))
    ) {
      setLiveModelValue(validLive[0]);
    }

    const validText = getValidValues("text", TEXT_MODELS);
    if (
      validText.length > 0 &&
      (!textModelValue || !validText.includes(textModelValue))
    ) {
      setTextModelValue(validText[0]);
    }

    const validUpscaler = getValidValues("upscaler", UPSCALER_MODELS);
    if (
      validUpscaler.length > 0 &&
      (!upscalerModelValue || !validUpscaler.includes(upscalerModelValue))
    ) {
      setUpscalerModelValue(validUpscaler[0]);
    }
  }, [
    creationModelValue,
    customProviders,
    editModelValue,
    liveModelValue,
    serviceMode,
    textModelValue,
    tokensForm.a4fToken,
    tokensForm.giteeToken,
    tokensForm.googleToken,
    tokensForm.msToken,
    tokensForm.openaiToken,
    upscalerModelValue,
  ]);

  // -- Handlers --

  const handleServiceModeChange = (newMode: ServiceMode) => {
    setServiceMode(newMode);
    if (newMode === "local") {
      const customList = getCustomProviders();
      const currentProviderIsCustom = customList.some(
        (cp) => cp.id === provider,
      );
      if (currentProviderIsCustom) {
        setProvider("huggingface");
        setModel(HF_MODEL_OPTIONS[0].value as any);
        setCreationModelValue(`huggingface:${HF_MODEL_OPTIONS[0].value}`);
      }
    }
  };

  const handleFetchCustomModels = async () => {
    if (!newProviderUrl) return;
    setFetchStatus("loading");
    try {
      const url = newProviderUrl.replace(/\/$/, "") + "/v1/models";
      const headers: Record<string, string> = {};
      if (newProviderToken)
        headers["Authorization"] = `Bearer ${newProviderToken}`;
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error("Fetch failed");
      const rawData = await response.json();
      const transformedData = transformModelList(rawData);
      setFetchedModels(transformedData);
      setFetchStatus("success");
    } catch (e) {
      console.error("Failed to fetch models", e);
      setFetchStatus("failed");
      setFetchedModels(null);
    }
  };

  const handleAddCustomProvider = () => {
    if (!newProviderUrl || !fetchedModels) return;
    let finalName = newProviderName.trim();
    if (!finalName) {
      try {
        const urlStr = newProviderUrl.startsWith("http")
          ? newProviderUrl
          : `https://${newProviderUrl}`;
        const url = new URL(urlStr);
        const parts = url.hostname.split(".");
        finalName = parts.length >= 2 ? parts[parts.length - 2] : url.hostname;
        finalName = finalName.charAt(0).toUpperCase() + finalName.slice(1);
      } catch {
        finalName = "Custom";
      }
    }
    const newProvider: CustomProvider = {
      id: generateUUID(),
      name: finalName,
      apiUrl: newProviderUrl,
      token: newProviderToken,
      models: fetchedModels,
      enabled: true,
    };
    addCustomProvider(newProvider);
    setCustomProviders(getCustomProviders());

    setNewProviderName("");
    setNewProviderUrl("");
    setNewProviderToken("");
    setFetchStatus("idle");
    setFetchedModels(null);
  };

  const handleUpdateCustomProvider = (
    id: string,
    updates: Partial<CustomProvider>,
  ) => {
    setCustomProviders((prev) =>
      prev.map((cp) => (cp.id === id ? { ...cp, ...updates } : cp)),
    );
  };

  const handleDeleteCustomProvider = (id: string) => {
    removeCustomProvider(id);
    setCustomProviders(getCustomProviders());
  };

  const handleRefreshCustomModels = async (id: string) => {
    const p = customProviders.find((cp) => cp.id === id);
    if (!p) return;
    performModelRefresh(p);
  };

  const handleSave = () => {
    // Dispatch actions to update store tokens
    setProviderTokens("huggingface", tokensForm.token);
    setProviderTokens("gitee", tokensForm.giteeToken);
    setProviderTokens("modelscope", tokensForm.msToken);
    setProviderTokens("a4f", tokensForm.a4fToken);
    setProviderTokens("openai", tokensForm.openaiToken);
    setProviderTokens("google", tokensForm.googleToken);

    setOpenAIConfig(openaiConfigState);
    setGoogleConfig(googleConfigState);

    saveSystemPromptContent(systemPrompt);
    saveTranslationPromptContent(translationPrompt);
    saveVideoSettings(provider, videoSettings);

    storageForm.saveStorage();

    saveEditModelConfig(editModelValue);
    saveLiveModelConfig(liveModelValue);
    saveTextModelConfig(textModelValue);
    saveUpscalerModelConfig(upscalerModelValue);

    saveServiceMode(serviceMode);
    saveCustomProviders(customProviders);

    if (creationModelValue) {
      const [newProvider, newModel] = creationModelValue.split(":");
      setProvider(newProvider as any);
      setModel(newModel as any);
    }

    onClose();
  };

  return {
    activeTab,
    setActiveTab,
    serviceMode,
    handleServiceModeChange,

    // Tokens (from composed hook)
    ...tokensForm,

    customProviders,
    handleUpdateCustomProvider,
    handleDeleteCustomProvider,
    handleRefreshCustomModels,
    refreshingProviders,
    refreshSuccessProviders,
    refreshErrorProviders,

    openaiConfig: openaiConfigState,
    setOpenaiConfig: setOpenAIConfigState,
    googleConfig: googleConfigState,
    setGoogleConfig: setGoogleConfigState,

    newProviderName,
    setNewProviderName,
    newProviderUrl,
    setNewProviderUrl,
    newProviderToken,
    setNewProviderToken,
    fetchStatus,
    fetchedModels,
    handleFetchCustomModels,
    handleAddCustomProvider,
    handleClearAddForm: () => {
      setNewProviderName("");
      setNewProviderUrl("");
      setNewProviderToken("");
      setFetchedModels(null);
      setFetchStatus("idle");
    },
    systemPrompt,
    setSystemPrompt,
    translationPrompt,
    setTranslationPrompt,
    creationModelValue,
    setCreationModelValue,
    editModelValue,
    setEditModelValue,
    liveModelValue,
    setLiveModelValue,
    textModelValue,
    setTextModelValue,
    upscalerModelValue,
    setUpscalerModelValue,
    videoSettings,
    setVideoSettings,

    // Storage (from composed hook)
    ...storageForm,

    handleSave,
  };
};
