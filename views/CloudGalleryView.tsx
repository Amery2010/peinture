import React, { useEffect, useState, useRef, useMemo } from "react";
import { CloudFile } from "../types";
import {
  CloudUpload,
  Image as ImageIcon,
  Loader2,
  Download,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  X,
  Check,
  Settings,
} from "lucide-react";
import {
  isStorageConfigured,
  listCloudFiles,
  deleteCloudFile,
  getStorageType,
  fetchCloudBlob,
  renameCloudFile,
  getFileId,
  getS3Config,
} from "../services/storageService";
import { downloadImage, generateUUID } from "../services/utils";
import { Tooltip } from "../components/Tooltip";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useSettingsStore } from "../store/settingsStore";
import { translations } from "../translations";
import { ImageSkeleton } from "../components/Skeleton";

interface CloudGalleryViewProps {
  handleUploadToS3: (
    blob: Blob,
    fileName: string,
    metadata?: any,
  ) => Promise<void>;
  onOpenSettings: () => void;
}

export const CloudGalleryView: React.FC<CloudGalleryViewProps> = ({
  handleUploadToS3,
  onOpenSettings,
}) => {
  const { language } = useSettingsStore();
  const t = translations[language];

  const [files, setFiles] = useState<CloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingNsfwId, setTogglingNsfwId] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [copyingPromptId, setCopyingPromptId] = useState<string | null>(null);
  const [copyPromptErrorId, setCopyPromptErrorId] = useState<string | null>(
    null,
  );
  const [isConfigured, setIsConfigured] = useState(false);
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({});

  // Fullscreen View
  const [fullscreenImage, setFullscreenImage] = useState<CloudFile | null>(
    null,
  );

  // Pagination / Infinite Scroll State
  const [displayLimit, setDisplayLimit] = useState(30);
  const observerTarget = useRef<HTMLDivElement>(null);

  const loadFiles = async () => {
    setLoading(true);
    if (!isStorageConfigured()) {
      setLoading(false);
      setIsConfigured(false);
      return;
    }
    setIsConfigured(true);

    const cloudFiles = await listCloudFiles();

    // Sort by LastModified Descending (Newest First)
    const sorted = cloudFiles.sort(
      (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
    );

    setFiles(sorted);
    setLoading(false);
  };

  useEffect(() => {
    loadFiles();

    // Listen to storage changes to reload
    const handleStorageChange = () => loadFiles();
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Sequential Loading Effect for WebDAV, Private S3, or OPFS
  useEffect(() => {
    const type = getStorageType();
    const isS3Private = type === "s3" && !getS3Config().publicDomain;
    const isWebDAV = type === "webdav";
    const isOPFS = type === "opfs";

    if (!isWebDAV && !isS3Private && !isOPFS) return;

    let isCancelled = false;
    const createdUrls: { key: string; url: string }[] = [];

    const loadImagesSequentially = async () => {
      const filesToLoad: CloudFile[] = files;
      for (const file of filesToLoad) {
        if (isCancelled) break;
        if (localUrls[file.key]) continue;

        try {
          const blob = await fetchCloudBlob(file.url);
          if (!isCancelled) {
            const url = URL.createObjectURL(blob);
            createdUrls.push({ key: file.key, url });
            setLocalUrls((prev) => ({ ...prev, [file.key]: url }));
          }
        } catch {
          console.error(`Failed to load cloud image: ${file.key}`);
        }
      }
    };

    if (files.length > 0) {
      loadImagesSequentially();
    }

    return () => {
      isCancelled = true;
      // Revoke URLs created during this cancelled run to prevent leaks
      createdUrls.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [files, localUrls]);

  // Cleanup ObjectURLs on unmount
  useEffect(() => {
    return () => {
      Object.values(localUrls).forEach((url) =>
        URL.revokeObjectURL(url as string),
      );
    };
  }, [localUrls]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayLimit((prev) => Math.min(prev + 30, files.length));
        }
      },
      { threshold: 0.1, rootMargin: "200px" },
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [files.length]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploading(true);
      try {
        // 1. Load image to get dimensions
        const img = new Image();
        const url = URL.createObjectURL(file);
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });
        const { width, height } = img;
        URL.revokeObjectURL(url);

        // 2. Generate ID and Filename
        const isNSFW = file.name.toUpperCase().includes(".NSFW");
        const parts = file.name.split(".");
        const ext = parts.length > 1 ? parts.pop() : "";

        let id = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        if (getStorageType() === "opfs") {
          id = generateUUID();
        }

        const fileName = isNSFW
          ? ext
            ? `${id}.NSFW.${ext}`
            : `${id}.NSFW`
          : ext
            ? `${id}.${ext}`
            : id;

        // 3. Prepare Metadata
        const metadata = {
          id,
          width,
          height,
          timestamp: Date.now(),
        };

        // 4. Upload
        await handleUploadToS3(file, fileName, metadata);

        setTimeout(loadFiles, 1000);
      } catch {
        console.error(t.upload_failed);
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    }
  };

  const handleDelete = async (file: CloudFile) => {
    const fileKey = file.key;
    setDeletingId(fileKey);

    try {
      await deleteCloudFile(fileKey);
      // Remove from local state
      setFiles((prev) => prev.filter((f) => f.key !== fileKey));
      setLocalUrls((prev) => {
        const next = { ...prev };
        if (next[fileKey]) {
          URL.revokeObjectURL(next[fileKey]);
          delete next[fileKey];
        }
        return next;
      });
    } catch {
      console.error("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (file: CloudFile) => {
    const fileName = file.key.split("/").pop() || "download";
    const urlToUse = localUrls[file.key] || file.url;

    try {
      let downloadUrl = urlToUse;
      const type = getStorageType();
      if (
        !downloadUrl.startsWith("blob:") &&
        (type === "webdav" ||
          type === "opfs" ||
          (type === "s3" && !getS3Config().publicDomain))
      ) {
        const blob = await fetchCloudBlob(downloadUrl);
        downloadUrl = window.URL.createObjectURL(blob);
        await downloadImage(downloadUrl, fileName);
        setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
      } else {
        await downloadImage(downloadUrl, fileName);
      }
    } catch {
      console.error("Download failed, opening in new tab");
      window.open(urlToUse, "_blank");
    }
  };

  const handleCopyPrompt = async (file: CloudFile) => {
    if (copyingPromptId || copyPromptErrorId === file.key) return;

    const id = getFileId(file.key);
    const baseUrl = file.url.substring(0, file.url.lastIndexOf("/") + 1);
    const metaUrl = `${baseUrl}${id}.metadata.json`;

    setCopyingPromptId(file.key);

    try {
      const blob = await fetchCloudBlob(metaUrl);
      const text = await blob.text();
      const json = JSON.parse(text);
      if (json && json.prompt) {
        await navigator.clipboard.writeText(json.prompt);
        setCopiedPromptId(file.key);
        setTimeout(() => setCopiedPromptId(null), 2000);
      } else {
        setCopyPromptErrorId(file.key);
      }
    } catch {
      console.error("Failed to fetch/parse metadata for prompt copy");
      setCopyPromptErrorId(file.key);
    } finally {
      setCopyingPromptId(null);
    }
  };

  const handleToggleNSFW = async (file: CloudFile) => {
    if (togglingNsfwId) return;
    setTogglingNsfwId(file.key);

    const isNSFW = file.key.includes(".NSFW.");
    const originalExtension = file.key.split(".").pop();

    const newKey = isNSFW
      ? file.key.replace(`.NSFW.${originalExtension}`, `.${originalExtension}`)
      : file.key.replace(`.${originalExtension}`, `.NSFW.${originalExtension}`);

    try {
      const type = getStorageType();
      if (type === "s3") {
        const urlToFetch = localUrls[file.key] || file.url;
        const blob = await fetchCloudBlob(urlToFetch);
        await handleUploadToS3(blob, newKey);
        await deleteCloudFile(file.key);
      } else {
        await renameCloudFile(file.key, newKey);
      }

      setFiles((prev) =>
        prev.map((f) => {
          if (f.key === file.key) {
            const newUrl = f.url.replace(file.key, newKey);
            return { ...f, key: newKey, url: newUrl };
          }
          return f;
        }),
      );

      setLocalUrls((prev) => {
        const next = { ...prev };
        if (next[file.key]) {
          next[newKey] = next[file.key];
          delete next[file.key];
        }
        return next;
      });
    } catch (e: any) {
      console.error("Failed to toggle NSFW status", e);
    } finally {
      setTogglingNsfwId(null);
    }
  };

  const visibleFiles = useMemo(
    () => files.slice(0, displayLimit),
    [files, displayLimit],
  );
  const type = getStorageType();
  const useProxyLoading =
    type === "webdav" ||
    type === "opfs" ||
    (type === "s3" && !getS3Config().publicDomain);

  return (
    <div className="w-full h-full flex flex-col p-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-row items-center justify-between mb-4 gap-4">
        <div className="min-w-0 flex-1 mr-4">
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
            {t.gallery_title}
          </h2>
          <p className="text-white/60 mt-1 text-xs md:text-base truncate">
            {t.gallery_subtitle}
          </p>
        </div>

        <div className="flex-shrink-0">
          {isConfigured ? (
            <label
              className={`
                            flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-2.5 
                            rounded-full font-bold text-white cursor-pointer shadow-lg
                            bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500
                            hover:opacity-90 active:scale-95 transition-all text-sm md:text-base
                            ${uploading ? "opacity-70 cursor-not-allowed" : ""}
                        `}
            >
              <input
                type="file"
                className="hidden"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                disabled={uploading}
              />
              {uploading ? (
                <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
              ) : (
                <CloudUpload className="w-4 h-4 md:w-5 md:h-5" />
              )}
              <span className="hidden md:inline">
                {uploading ? t.uploading : t.upload_media}
              </span>
              <span className="md:hidden">{uploading ? "" : t.upload}</span>
            </label>
          ) : (
            <button
              onClick={onOpenSettings}
              className="
                                flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-2.5 
                                rounded-full font-bold text-white cursor-pointer shadow-lg
                                bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500
                                hover:opacity-90 active:scale-95 transition-all text-sm md:text-base
                            "
            >
              <Settings className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden md:inline">{t.gallery_setup_btn}</span>
              <span className="md:hidden">{t.settings}</span>
            </button>
          )}
        </div>
      </div>

      {!isConfigured ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/30 space-y-4 min-h-[50vh] animate-in fade-in duration-500">
          <div className="text-center space-y-2 max-w-md px-4">
            <h3 className="text-xl font-medium text-white/60">
              {t.gallery_setup_title}
            </h3>
            <p className="text-sm text-white/40 leading-relaxed">
              {t.gallery_setup_desc}
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="w-full">
          <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-2">
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className="break-inside-avoid mb-4 overflow-hidden rounded-xl"
              >
                <ImageSkeleton className="w-full h-auto min-h-[150px] aspect-[4/5]" />
              </div>
            ))}
          </div>
        </div>
      ) : files.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/30 space-y-4 min-h-[50vh] animate-in slide-in-from-bottom-4 duration-500">
          <ImageIcon className="w-16 h-16 opacity-30" />
          <h3 className="text-xl font-medium text-white/50">
            {t.cloud_gallery_empty}
          </h3>
          <p className="text-sm">{t.cloud_gallery_desc}</p>
        </div>
      ) : (
        <div className="w-full">
          <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-2">
            {visibleFiles.map((file) => {
              const displayUrl =
                useProxyLoading && localUrls[file.key]
                  ? localUrls[file.key]
                  : !useProxyLoading
                    ? file.url
                    : "";
              const isNSFW = file.key.includes(".NSFW.");

              return (
                <div
                  key={file.key}
                  className="break-inside-avoid mb-4 group relative overflow-hidden bg-white/[0.02] transition-all duration-500 rounded-xl border border-white/5 hover:border-white/20 animate-in fade-in zoom-in-95 hover:shadow-2xl hover:shadow-purple-500/10"
                >
                  <div
                    className="relative min-h-[150px] bg-white/5 flex items-center justify-center cursor-zoom-in"
                    onClick={() => setFullscreenImage(file)}
                  >
                    {displayUrl ? (
                      file.type === "video" ? (
                        <div className="relative w-full aspect-[9/16] bg-black/40 flex items-center justify-center">
                          <video
                            src={displayUrl}
                            className="w-full h-full object-cover pointer-events-none"
                            muted
                            loop
                            autoPlay
                            playsInline
                            preload="auto"
                          />
                        </div>
                      ) : (
                        <img
                          src={displayUrl}
                          alt={file.key}
                          className={`w-full h-auto object-cover block transition-all duration-700 group-hover:scale-105 ${isNSFW ? "blur-xl" : ""}`}
                          loading="lazy"
                        />
                      )
                    ) : (
                      <div className="flex items-center justify-center w-full h-40">
                        <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 pointer-events-none" />

                    <div className="absolute bottom-0 left-0 right-0 p-1.5 flex items-end justify-between opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none">
                      <div className="hidden md:flex flex-col gap-0.5 text-white/90 drop-shadow-md">
                        <span className="text-[10px] font-medium opacity-80">
                          {file.lastModified.toLocaleDateString()}
                        </span>
                      </div>

                      <div
                        className="flex items-center ml-auto pointer-events-auto gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Tooltip
                          content={isNSFW ? t.unmark_nsfw : t.mark_nsfw}
                          position="top"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleNSFW(file);
                            }}
                            aria-label={isNSFW ? t.unmark_nsfw : t.mark_nsfw}
                            className={`p-2 hover:bg-white/10 active:scale-90 rounded-full transition-all ${isNSFW ? "text-purple-400" : "text-white/80"}`}
                          >
                            {togglingNsfwId === file.key ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isNSFW ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </Tooltip>

                        <Tooltip
                          content={
                            copiedPromptId === file.key
                              ? t.copied
                              : t.copy_prompt
                          }
                          position="top"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyPrompt(file);
                            }}
                            aria-label={copiedPromptId === file.key ? t.copied : t.copy_prompt}
                            className={`p-2 hover:bg-white/10 active:scale-90 rounded-full transition-all ${copyPromptErrorId === file.key ? "text-white/30 cursor-not-allowed" : "text-white/80"}`}
                            disabled={
                              copyingPromptId === file.key ||
                              copyPromptErrorId === file.key
                            }
                          >
                            {copyingPromptId === file.key ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : copiedPromptId === file.key ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </Tooltip>

                        <Tooltip content={t.download} position="top">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file);
                            }}
                            aria-label={t.download}
                            className="p-2 text-white/80 hover:bg-white/10 active:scale-90 rounded-full transition-all"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </Tooltip>

                        <Tooltip content={t.delete} position="top">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(file);
                            }}
                            aria-label={t.delete}
                            className="p-2 text-white/80 hover:text-red-400 hover:bg-red-500/10 active:scale-90 rounded-full transition-all"
                          >
                            {deletingId === file.key ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            ref={observerTarget}
            className="h-20 w-full flex items-center justify-center mt-4"
          >
            {visibleFiles.length < files.length && (
              <div className="flex flex-col items-center gap-2 text-white/30">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Viewer Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-in fade-in duration-300 backdrop-blur-xl">
          <button
            onClick={() => setFullscreenImage(null)}
            aria-label={t.close || "Close"}
            className="absolute top-6 right-6 z-[110] p-3 bg-white/5 hover:bg-white/10 active:scale-90 rounded-full text-white transition-all border border-white/10"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="w-full h-full p-4 flex items-center justify-center">
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={8}
              centerOnInit={true}
            >
              <TransformComponent
                wrapperStyle={{ width: "100%", height: "100%" }}
                contentStyle={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {fullscreenImage.type === "video" ? (
                  <video
                    src={
                      useProxyLoading && localUrls[fullscreenImage.key]
                        ? localUrls[fullscreenImage.key]
                        : !useProxyLoading
                          ? fullscreenImage.url
                          : ""
                    }
                    className="max-w-full max-h-full object-contain shadow-2xl"
                    controls
                    autoPlay
                  />
                ) : (
                  <img
                    src={
                      useProxyLoading && localUrls[fullscreenImage.key]
                        ? localUrls[fullscreenImage.key]
                        : !useProxyLoading
                          ? fullscreenImage.url
                          : ""
                    }
                    alt={fullscreenImage.key}
                    className="max-w-full max-h-full object-contain shadow-2xl"
                  />
                )}
              </TransformComponent>
            </TransformWrapper>
          </div>
        </div>
      )}
    </div>
  );
};
