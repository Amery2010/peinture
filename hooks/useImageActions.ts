import { useState, useRef } from "react";
import { toast } from "sonner";
import { useSettingsStore } from "../store/settingsStore";
import { useUIStore, useCurrentImage, useSetCurrentImage } from "../store/uiStore";
import { useDataStore } from "../store/dataStore";
import { translations } from "../translations";
import { GeneratedImage } from "../types";
import { useCloudUpload } from "./useCloudUpload";
import { upscaler } from "../services/hfService";
import { upscaleImageCustom } from "../services/customService";
import {
  getUpscalerModelConfig,
  getCustomProviders,
  fetchBlob,
  downloadImage,
  getExtensionFromUrl,
} from "../services/utils";
import {
  saveTempFileToOPFS,
  deleteTempFileFromOPFS,
  renameTempFileFromOPFS,
} from "../services/storageService";
import { resolveErrorMessage } from "../services/errorUtils";

/**
 * Hook that encapsulates all image action handlers for CreationView.
 * Handles: upscale, download, delete, toggle blur, copy prompt, cloud upload.
 */
export const useImageActions = () => {
  const { language } = useSettingsStore();
  const { history, setHistory } = useDataStore();
  const {
    isUpscaling,
    setIsUpscaling,
    isDownloading,
    setIsDownloading,
    isLiveMode,
    setIsLiveMode,
    setImageDimensions,
  } = useUIStore();

  const currentImage = useCurrentImage();
  const setCurrentImage = useSetCurrentImage();

  const t = translations[language];
  const { handleUploadToCloud, isUploading, uploadError } = useCloudUpload();

  // Local UI State
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [tempUpscaledImage, setTempUpscaledImage] = useState<string | null>(
    null,
  );
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  // Track current image id for async race condition protection
  const currentImageIdRef = useRef<string | null>(null);
  if (currentImage) {
    currentImageIdRef.current = currentImage.id;
  }

  // --- Upscale ---
  const handleUpscale = async () => {
    if (!currentImage || isUpscaling) return;
    setIsUpscaling(true);
    try {
      const config = getUpscalerModelConfig();
      let newUrl = "";
      if (config.provider === "huggingface") {
        const result = await upscaler(currentImage.url);
        newUrl = result.url;
      } else {
        const customProviders = getCustomProviders();
        const activeProvider = customProviders.find(
          (p) => p.id === config.provider,
        );
        if (activeProvider) {
          const result = await upscaleImageCustom(
            activeProvider,
            config.model,
            currentImage.url,
          );
          newUrl = result.url;
        } else {
          const result = await upscaler(currentImage.url);
          newUrl = result.url;
        }
      }
      setTempUpscaledImage(newUrl);
      setIsComparing(true);
    } catch (err: any) {
      setTempUpscaledImage(null);
      toast.error(resolveErrorMessage(err, t, "error_upscale_failed"));
    } finally {
      setIsUpscaling(false);
    }
  };

  const handleApplyUpscale = async () => {
    if (!currentImage || !tempUpscaledImage) return;
    const targetImageId = currentImage.id; // Capture for race condition check

    try {
      const blob = await fetchBlob(tempUpscaledImage);
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);

      img.onload = async () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        URL.revokeObjectURL(objectUrl);

        // Race condition guard: check if user switched images
        if (currentImageIdRef.current !== targetImageId) {
          console.warn(
            "Image changed during upscale apply, skipping state update",
          );
          return;
        }

        let ext = getExtensionFromUrl(tempUpscaledImage!) || "png";
        if (!["png", "jpg", "jpeg", "webp"].includes(ext.toLowerCase()))
          ext = "png";

        const fileName = `${targetImageId}-upscaled.${ext}`;
        const opfsUrl = await saveTempFileToOPFS(blob, fileName);

        if (currentImage.url?.startsWith("blob:")) URL.revokeObjectURL(currentImage.url);

        const updatedImage = {
          ...currentImage,
          url: opfsUrl,
          fileName: fileName,
          isUpscaled: true,
          width: width,
          height: height,
        };

        setCurrentImage(updatedImage);
        setHistory((prev) =>
          prev.map((img) => (img.id === updatedImage.id ? updatedImage : img)),
        );
        setImageDimensions({ width, height });

        setIsComparing(false);
        setTempUpscaledImage(null);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        console.error("Failed to load upscaled image for dimensions");
      };

      img.src = objectUrl;
    } catch (e) {
      console.error("Failed to save upscaled image", e);
      toast.error(
        String(t.error_upscale_failed || "Failed to save upscaled image"),
      );
    }
  };

  const handleCancelUpscale = () => {
    setIsComparing(false);
    setTempUpscaledImage(null);
  };

  // --- History Selection ---
  const handleHistorySelect = (image: GeneratedImage) => {
    setCurrentImage(image);
    setShowInfo(false);
    setImageDimensions(null);
    setIsComparing(false);
    setTempUpscaledImage(null);
    if (image.videoUrl && image.videoStatus === "success") {
      setIsLiveMode(true);
    } else {
      setIsLiveMode(false);
    }
  };

  // --- Delete ---
  const handleDelete = async () => {
    if (!currentImage) return;
    const filenameToDelete = currentImage.fileName || `${currentImage.id}.png`;
    await deleteTempFileFromOPFS(filenameToDelete);

    if (currentImage.videoFileName) {
      await deleteTempFileFromOPFS(currentImage.videoFileName);
    }

    // Revoke blob URLs to free memory
    if (currentImage.url?.startsWith("blob:")) URL.revokeObjectURL(currentImage.url);
    if (currentImage.videoUrl?.startsWith("blob:")) URL.revokeObjectURL(currentImage.videoUrl);

    const newHistory = history.filter((img) => img.id !== currentImage.id);
    setHistory(newHistory);
    setShowInfo(false);
    setIsComparing(false);
    setTempUpscaledImage(null);
    if (newHistory.length > 0) {
      const nextImg = newHistory[0];
      setCurrentImage(nextImg);
      if (nextImg.videoUrl && nextImg.videoStatus === "success") {
        setIsLiveMode(true);
      } else {
        setIsLiveMode(false);
      }
    } else {
      setCurrentImage(null);
      setIsLiveMode(false);
    }
  };

  // --- Toggle Blur (NSFW) ---
  const handleToggleBlur = async () => {
    if (!currentImage) return;
    const newStatus = !currentImage.isBlurred;
    let newFileName = currentImage.fileName;
    if (currentImage.fileName) {
      const ext = currentImage.fileName.split(".").pop() || "png";
      const base = currentImage.fileName
        .replace(`.NSFW.${ext}`, "")
        .replace(`.${ext}`, "");
      const nextFileName = newStatus ? `${base}.NSFW.${ext}` : `${base}.${ext}`;
      const renamed = await renameTempFileFromOPFS(
        currentImage.fileName,
        nextFileName,
      );
      if (renamed) newFileName = nextFileName;
    }
    const updatedImage = {
      ...currentImage,
      isBlurred: newStatus,
      fileName: newFileName,
    };
    setCurrentImage(updatedImage);
    setHistory((prev) =>
      prev.map((img) => (img.id === currentImage.id ? updatedImage : img)),
    );
  };

  // --- Copy Prompt ---
  const handleCopyPrompt = async () => {
    if (!currentImage?.prompt) return;
    try {
      await navigator.clipboard.writeText(currentImage.prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  // --- Download ---
  const handleDownload = async () => {
    if (!currentImage) return;
    let imageUrl = currentImage.url;
    let fileName = `generated-${currentImage.id}`;

    if (isLiveMode && currentImage.videoUrl) {
      imageUrl = currentImage.videoUrl;
      fileName = fileName + ".mp4";
    } else if (currentImage.fileName) {
      fileName = currentImage.fileName;
    }

    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const hasExtension = fileName.match(/\.[a-zA-Z0-9]+$/);
      let base = hasExtension
        ? fileName.replace(/\.[a-zA-Z0-9]+$/, "")
        : fileName;
      const ext = hasExtension ? hasExtension[0] : ".png";
      if (currentImage.isBlurred && !base.toUpperCase().endsWith(".NSFW"))
        base += ".NSFW";
      fileName = base + ext;
      await downloadImage(imageUrl, fileName);
    } catch (e) {
      console.error("Download failed", e);
      window.open(imageUrl, "_blank");
    } finally {
      setIsDownloading(false);
    }
  };

  // --- Cloud Upload ---
  const uploadCurrentToCloud = async () => {
    if (currentImage) {
      if (isLiveMode && currentImage.videoUrl) {
        const ext = currentImage.videoUrl.includes(".mp4") ? ".mp4" : ".webm";
        const fileName = `video-${currentImage.id}${ext}`;
        await handleUploadToCloud(currentImage.videoUrl, fileName, {
          ...currentImage,
          type: "video",
        });
      } else {
        let fileName = currentImage.id || `image-${Date.now()}`;
        if (currentImage.isBlurred) fileName += ".NSFW";
        const ext = getExtensionFromUrl(currentImage.url) || "png";
        fileName += `.${ext}`;
        await handleUploadToCloud(currentImage.url, fileName);
      }
    }
  };

  return {
    // Upscale
    isComparing,
    tempUpscaledImage,
    handleUpscale,
    handleApplyUpscale,
    handleCancelUpscale,
    // Info & copy
    showInfo,
    setShowInfo,
    copiedPrompt,
    handleCopyPrompt,
    // Actions
    handleHistorySelect,
    handleDelete,
    handleToggleBlur,
    handleDownload,
    uploadCurrentToCloud,
    // Cloud upload state
    isUploading,
    uploadError,
    // Derived
    setIsComparing,
    setTempUpscaledImage,
  };
};
