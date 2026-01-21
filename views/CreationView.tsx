
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
    Sparkles, 
    Loader2, 
    RotateCcw 
} from 'lucide-react';
import { PromptInput } from '../components/PromptInput';
import { ControlPanel } from '../components/ControlPanel';
import { PreviewStage } from '../components/PreviewStage';
import { ImageToolbar } from '../components/ImageToolbar';
import { HistoryGallery } from '../components/HistoryGallery';
import { Tooltip } from '../components/Tooltip';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import { GeneratedImage, ModelOption, ProviderOption } from '../types';
import { useCloudUpload } from '../hooks/useCloudUpload';
import { 
    generateGiteeImage, 
    optimizePromptGitee, 
    createVideoTask 
} from '../services/giteeService';
import { 
    generateMSImage, 
    optimizePromptMS 
} from '../services/msService';
import { 
    generateImage, 
    upscaler, 
    createVideoTaskHF, 
    optimizePrompt as optimizePromptHF
} from '../services/hfService';
import { 
    generateA4FImage, 
    optimizePromptA4F 
} from '../services/a4fService';
import { 
    generateCustomImage, 
    generateCustomVideo, 
    optimizePromptCustom, 
    getCustomTaskStatus, 
    upscaleImageCustom 
} from '../services/customService';
import { 
    translatePrompt, 
    generateUUID, 
    getLiveModelConfig, 
    getTextModelConfig, 
    getUpscalerModelConfig, 
    getCustomProviders, 
    getVideoSettings, 
    getServiceMode, 
    fetchBlob, 
    downloadImage,
    getExtensionFromUrl
} from '../services/utils';
import { 
    saveTempFileToOPFS, 
    deleteTempFileFromOPFS, 
    renameTempFileFromOPFS 
} from '../services/storageService';
import { 
    HF_MODEL_OPTIONS, 
    GITEE_MODEL_OPTIONS, 
    MS_MODEL_OPTIONS, 
    A4F_MODEL_OPTIONS, 
    FLUX_MODELS, 
    getModelConfig,
    getGuidanceScaleConfig,
    LIVE_MODELS
} from '../constants';

export const CreationView: React.FC = () => {
    const { 
        language,
        provider, model, setModel,
        prompt, setPrompt,
        aspectRatio, seed, steps, setSteps, guidanceScale, setGuidanceScale,
        autoTranslate, setAutoTranslate,
        history, setHistory,
        cloudHistory,
        currentImage, setCurrentImage,
        isLoading, setIsLoading,
        isTranslating, setIsTranslating,
        isOptimizing, setIsOptimizing,
        isUpscaling, setIsUpscaling,
        isDownloading, setIsDownloading,
        isLiveMode, setIsLiveMode,
        resetSettings,
        error, setError,
        imageDimensions, setImageDimensions
    } = useAppStore();

    const t = translations[language];
    const { handleUploadToCloud, isUploading, uploadError } = useCloudUpload();

    // Local UI State
    const [elapsedTime, setElapsedTime] = useState<number>(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [isComparing, setIsComparing] = useState<boolean>(false);
    const [tempUpscaledImage, setTempUpscaledImage] = useState<string | null>(null);
    const [showInfo, setShowInfo] = useState<boolean>(false);
    const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

    // Sync upload error
    useEffect(() => {
        if (uploadError) setError(uploadError);
    }, [uploadError]);

    // Timer Logic
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

    // Helpers
    const addToPromptHistory = (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        
        let currentHistory: string[] = [];
        try {
            const saved = sessionStorage.getItem('prompt_history');
            currentHistory = saved ? JSON.parse(saved) : [];
        } catch (e) {}

        const filtered = currentHistory.filter(p => p !== trimmed);
        const newHistory = [trimmed, ...filtered].slice(0, 50);

        sessionStorage.setItem('prompt_history', JSON.stringify(newHistory));
    };

    const convertBlobToPng = (blob: Blob): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    URL.revokeObjectURL(url);
                    reject(new Error('Canvas context not available'));
                    return;
                }
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((pngBlob) => {
                    URL.revokeObjectURL(url);
                    if (pngBlob) resolve(pngBlob);
                    else reject(new Error('PNG conversion failed'));
                }, 'image/png');
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Image load failed during conversion'));
            };
            img.src = url;
        });
    };

    // Handlers
    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        addToPromptHistory(prompt);
        setIsLoading(true);
        setError(null);
        setShowInfo(false); 
        setImageDimensions(null);
        setIsComparing(false);
        setTempUpscaledImage(null);
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
            const seedNumber = seed.trim() === '' ? undefined : parseInt(seed, 10);
            const gsConfig = getGuidanceScaleConfig(model, provider);
            const currentGuidanceScale = gsConfig ? guidanceScale : undefined;
            const requestHD = true;

            let result;
            if (provider === 'gitee') {
                result = await generateGiteeImage(model, finalPrompt, aspectRatio, seedNumber, steps, requestHD, currentGuidanceScale);
            } else if (provider === 'modelscope') {
                result = await generateMSImage(model, finalPrompt, aspectRatio, seedNumber, steps, requestHD, currentGuidanceScale);
            } else if (provider === 'huggingface') {
                result = await generateImage(model, finalPrompt, aspectRatio, seedNumber, requestHD, steps, currentGuidanceScale);
            } else if (provider === 'a4f') {
                result = await generateA4FImage(model, finalPrompt, aspectRatio, seedNumber, steps, requestHD, currentGuidanceScale);
            } else {
                const customProviders = getCustomProviders();
                const activeProvider = customProviders.find(p => p.id === provider);
                if (activeProvider) {
                    result = await generateCustomImage(activeProvider, model, finalPrompt, aspectRatio, seedNumber, steps, currentGuidanceScale, requestHD);
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
                    const mimeExt = blob.type.split('/')[1];
                    ext = (mimeExt && mimeExt.length <= 4) ? mimeExt : 'png';
                }

                if (ext.toLowerCase() !== 'png') {
                    try {
                        const pngBlob = await convertBlobToPng(blob);
                        blob = pngBlob;
                        ext = 'png';
                    } catch (convErr) {
                        console.warn("Image conversion to PNG failed, saving as is", convErr);
                    }
                }
                
                fileName = `${result.id}.${ext}`;
                await saveTempFileToOPFS(blob, fileName);
                fileUrl = URL.createObjectURL(blob);
            } catch (e) {
                console.warn("Failed to cache image to OPFS tmp, using original URL", e);
            }

            const newImage = { 
                ...result, 
                url: fileUrl,
                fileName,
                duration, 
                provider, 
                guidanceScale: currentGuidanceScale 
            };
            
            setCurrentImage(newImage);
            setHistory(prev => [newImage, ...prev]);
        } catch (err: any) {
            const errorMessage = (t as any)[err.message] || err.message || t.generationFailed;
            setError(errorMessage);
        } finally {
            stopTimer();
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        resetSettings();
        // Provider specific resets handled in hooks/useAppInit.ts logic based on view switching
        // Or if specific reset logic is needed here:
        if (provider === 'gitee') setModel(GITEE_MODEL_OPTIONS[0].value as ModelOption);
        else if (provider === 'modelscope') setModel(MS_MODEL_OPTIONS[0].value as ModelOption);
        else if (provider === 'huggingface') setModel(HF_MODEL_OPTIONS[0].value as ModelOption);
        else if (provider === 'a4f') setModel(A4F_MODEL_OPTIONS[0].value as ModelOption);
        else {
            const customProviders = getCustomProviders();
            const activeCustom = customProviders.find(p => p.id === provider);
            if (activeCustom?.models?.generate && activeCustom.models.generate.length > 0) {
                setModel(activeCustom.models.generate[0].id as ModelOption);
            }
        }
        const config = getModelConfig(provider, model);
        setSteps(config.default);
        setIsComparing(false);
        setTempUpscaledImage(null);
        setError(null);
    };

    const handleUpscale = async () => {
        if (!currentImage || isUpscaling) return;
        setIsUpscaling(true);
        setError(null);
        try {
            const config = getUpscalerModelConfig(); 
            let newUrl = '';
            if (config.provider === 'huggingface') {
                const result = await upscaler(currentImage.url);
                newUrl = result.url;
            } else {
                const customProviders = getCustomProviders();
                const activeProvider = customProviders.find(p => p.id === config.provider);
                if (activeProvider) {
                    const result = await upscaleImageCustom(activeProvider, config.model, currentImage.url);
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
            const errorMessage = (t as any)[err.message] || err.message || t.error_upscale_failed;
            setError(errorMessage);
        } finally {
            setIsUpscaling(false);
        }
    };

    const handleApplyUpscale = async () => {
        if (!currentImage || !tempUpscaledImage) return;
        
        try {
            // Fetch the upscaled image data
            const blob = await fetchBlob(tempUpscaledImage);
            
            // Create temporary object URL to read dimensions
            const img = new Image();
            const objectUrl = URL.createObjectURL(blob);
            
            img.onload = async () => {
                const width = img.naturalWidth;
                const height = img.naturalHeight;
                URL.revokeObjectURL(objectUrl);

                // Save to OPFS
                let ext = getExtensionFromUrl(tempUpscaledImage) || 'png';
                if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext.toLowerCase())) ext = 'png';
                
                // Keep original ID but append upscaled suffix for filename uniqueness
                const fileName = `${currentImage.id}-upscaled.${ext}`;
                const opfsUrl = await saveTempFileToOPFS(blob, fileName);

                const updatedImage = { 
                    ...currentImage, 
                    url: opfsUrl, 
                    fileName: fileName,
                    isUpscaled: true,
                    width: width,
                    height: height
                };
                
                setCurrentImage(updatedImage);
                setHistory(prev => prev.map(img => img.id === updatedImage.id ? updatedImage : img));
                setImageDimensions({ width, height }); // Update preview dimensions
                
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
            setError(t.error_upscale_failed || "Failed to save upscaled image");
        }
    };

    const handleCancelUpscale = () => {
        setIsComparing(false);
        setTempUpscaledImage(null);
    };

    const handleOptimizePrompt = async () => {
        if (!prompt.trim()) return;
        addToPromptHistory(prompt);
        setIsOptimizing(true);
        setError(null);
        try {
            const config = getTextModelConfig(); 
            let optimized = '';
            if (config.provider === 'gitee') optimized = await optimizePromptGitee(prompt, config.model);
            else if (config.provider === 'modelscope') optimized = await optimizePromptMS(prompt, config.model);
            else if (config.provider === 'a4f') optimized = await optimizePromptA4F(prompt, config.model);
            else if (config.provider === 'huggingface') optimized = await optimizePromptHF(prompt, config.model);
            else {
                const customProviders = getCustomProviders();
                const activeProvider = customProviders.find(p => p.id === config.provider);
                if (activeProvider) optimized = await optimizePromptCustom(activeProvider, config.model, prompt);
                else optimized = await optimizePromptHF(prompt, config.model);
            }
            setPrompt(optimized);
        } catch (err: any) {
            console.error("Optimization failed", err);
            const errorMessage = (t as any)[err.message] || err.message || t.error_prompt_optimization_failed;
            setError(errorMessage);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleHistorySelect = (image: GeneratedImage) => {
        setCurrentImage(image);
        setShowInfo(false); 
        setImageDimensions(null); 
        setIsComparing(false);
        setTempUpscaledImage(null);
        if (image.videoUrl && image.videoStatus === 'success') {
            setIsLiveMode(true);
        } else {
            setIsLiveMode(false);
        }
        setError(null);
    };

    const handleDelete = async () => {
        if (!currentImage) return;
        const filenameToDelete = currentImage.fileName || `${currentImage.id}.png`;
        await deleteTempFileFromOPFS(filenameToDelete);
        
        // Also delete video file if exists
        if (currentImage.videoFileName) {
            await deleteTempFileFromOPFS(currentImage.videoFileName);
        }

        const newHistory = history.filter(img => img.id !== currentImage.id);
        setHistory(newHistory);
        setShowInfo(false);
        setIsComparing(false);
        setTempUpscaledImage(null);
        setError(null);
        if (newHistory.length > 0) {
            const nextImg = newHistory[0];
            setCurrentImage(nextImg);
            if (nextImg.videoUrl && nextImg.videoStatus === 'success') {
                setIsLiveMode(true);
            } else {
                setIsLiveMode(false);
            }
        } else {
            setCurrentImage(null);
            setIsLiveMode(false);
        }
    };

    const handleToggleBlur = async () => {
        if (!currentImage) return;
        const newStatus = !currentImage.isBlurred;
        let newFileName = currentImage.fileName;
        if (currentImage.fileName) {
            const ext = currentImage.fileName.split('.').pop() || 'png';
            const base = currentImage.fileName.replace(`.NSFW.${ext}`, '').replace(`.${ext}`, '');
            const nextFileName = newStatus ? `${base}.NSFW.${ext}` : `${base}.${ext}`;
            const renamed = await renameTempFileFromOPFS(currentImage.fileName, nextFileName);
            if (renamed) newFileName = nextFileName;
        }
        const updatedImage = { ...currentImage, isBlurred: newStatus, fileName: newFileName };
        setCurrentImage(updatedImage);
        setHistory(prev => prev.map(img => img.id === currentImage.id ? updatedImage : img));
    };

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

    const handleLiveClick = async () => {
        if (!currentImage) return;
        if (currentImage.videoStatus === 'generating') return;

        let liveConfig = getLiveModelConfig();
        const serviceMode = getServiceMode();
        const customProviders = getCustomProviders();
        let availableLiveModels: { provider: string, model: string }[] = [];

        if (serviceMode === 'local' || serviceMode === 'hydration') {
            LIVE_MODELS.forEach(m => {
                const parts = m.value.split(':');
                if (parts.length >= 2) availableLiveModels.push({ provider: parts[0], model: parts.slice(1).join(':') });
            });
        }
        if (serviceMode === 'server' || serviceMode === 'hydration') {
            customProviders.forEach(cp => {
                if (cp.models.video) {
                    cp.models.video.forEach(m => availableLiveModels.push({ provider: cp.id, model: m.id }));
                }
            });
        }

        const isConfigValid = availableLiveModels.some(m => m.provider === liveConfig.provider && m.model === liveConfig.model);
        if (!isConfigValid && availableLiveModels.length > 0) {
            liveConfig = availableLiveModels[0];
        } else if (availableLiveModels.length === 0) {
            setError(t.liveNotSupported || "No Live models available");
            return;
        }

        let width = imageDimensions?.width || 1024;
        let height = imageDimensions?.height || 1024;
        const currentVideoProvider = liveConfig.provider as ProviderOption;
        let imageInput: string | Blob = currentImage.url;
        try {
            // Need to handle OPFS blobs correctly for uploads
            if (currentImage.url.startsWith('opfs://')) {
                // If the downstream functions don't support opfs:// string, fetch blob here or let them handle
                // Since we fixed createVideoTaskHF to handle opfs://, we can pass url string.
                // However, fetching blob here is safer if we want to ensure data availability before call.
                // But let's rely on the updated service functions to fetch if needed.
                imageInput = currentImage.url; 
            } else {
                imageInput = await fetchBlob(currentImage.url);
            }
        } catch (e) {
            console.warn("Failed to fetch image blob for Live gen, using original URL", e);
        }

        if (currentVideoProvider === 'gitee') {
            // Gitee requires Blob for upload in createVideoTask
            // If imageInput is still string (opfs), we must fetch it.
            if (typeof imageInput === 'string' && imageInput.startsWith('opfs://')) {
                 try {
                     imageInput = await fetchBlob(imageInput); // fetchBlob via utils/storageService
                 } catch(e) {
                     console.error("Failed to fetch OPFS blob for Gitee", e);
                     setError("Failed to prepare image");
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
            const loadingImage = { ...currentImage, videoStatus: 'generating', videoProvider: currentVideoProvider } as GeneratedImage;
            setCurrentImage(loadingImage);
            setHistory(prev => prev.map(img => img.id === loadingImage.id ? loadingImage : img));

            if (currentVideoProvider === 'gitee') {
                const taskId = await createVideoTask(imageInput, width, height);
                const nextPollTime = Date.now() + 400 * 1000;
                const taskedImage = { ...loadingImage, videoTaskId: taskId, videoNextPollTime: nextPollTime } as GeneratedImage;
                setCurrentImage(taskedImage);
                setHistory(prev => prev.map(img => img.id === taskedImage.id ? taskedImage : img));
            } else if (currentVideoProvider === 'huggingface') {
                const videoUrl = await createVideoTaskHF(imageInput, currentImage.seed);
                
                // Download and Save to OPFS
                const videoBlob = await fetchBlob(videoUrl);
                const videoFileName = `live-${currentImage.id}.mp4`;
                await saveTempFileToOPFS(videoBlob, videoFileName);
                const objectUrl = URL.createObjectURL(videoBlob);

                const successImage = { 
                    ...loadingImage, 
                    videoStatus: 'success', 
                    videoUrl: objectUrl,
                    videoFileName: videoFileName
                } as GeneratedImage;
                
                setHistory(prev => prev.map(img => img.id === successImage.id ? successImage : img));
                setCurrentImage(prev => (prev && prev.id === successImage.id) ? successImage : prev);
                if (useAppStore.getState().currentImage?.id === successImage.id) setIsLiveMode(true);
            } else {
                const customProviders = getCustomProviders();
                const activeProvider = customProviders.find(p => p.id === currentVideoProvider);
                if (activeProvider) {
                    const settings = getVideoSettings(currentVideoProvider);
                    const urlToUse = typeof imageInput === 'string' ? imageInput : currentImage.url;
                    // Custom providers might need Blob if it's a file upload, or URL if accessible
                    // For now assuming custom provider handles URL or we need to upload.
                    // generateCustomVideo expects 'imageUrl' string.
                    const result = await generateCustomVideo(activeProvider, liveConfig.model, urlToUse, settings.prompt, settings.duration, currentImage.seed ?? 42, settings.steps, settings.guidance);
                    if (result.taskId) {
                        const nextPollTime = result.predict ? Date.now() + result.predict * 1000 : undefined;
                        const taskedImage = { ...loadingImage, videoTaskId: result.taskId, videoNextPollTime: nextPollTime } as GeneratedImage;
                        setCurrentImage(taskedImage);
                        setHistory(prev => prev.map(img => img.id === taskedImage.id ? taskedImage : img));
                    } else if (result.url) {
                        // Download and Save to OPFS if URL returned directly
                        const videoBlob = await fetchBlob(result.url);
                        const videoFileName = `live-${currentImage.id}.mp4`;
                        await saveTempFileToOPFS(videoBlob, videoFileName);
                        const objectUrl = URL.createObjectURL(videoBlob);

                        const successImage = { 
                            ...loadingImage, 
                            videoStatus: 'success', 
                            videoUrl: objectUrl,
                            videoFileName: videoFileName
                        } as GeneratedImage;
                        
                        setHistory(prev => prev.map(img => img.id === successImage.id ? successImage : img));
                        setCurrentImage(prev => (prev && prev.id === successImage.id) ? successImage : prev);
                        if (useAppStore.getState().currentImage?.id === successImage.id) setIsLiveMode(true);
                    } else {
                        throw new Error("Invalid response from video provider");
                    }
                } else {
                    throw new Error(t.liveNotSupported || "Live provider not supported");
                }
            }
        } catch (e: any) {
            console.error("Video Generation Failed", e);
            const failedImage = { ...currentImage, videoStatus: 'failed', videoError: e.message } as GeneratedImage;
            setCurrentImage(prev => (prev && prev.id === failedImage.id) ? failedImage : prev);
            setHistory(prev => prev.map(img => img.id === failedImage.id ? failedImage : img));
            setError(t.liveError);
        }
    };

    const handleDownload = async () => {
        if (!currentImage) return;
        let imageUrl = currentImage.url;
        let fileName = `generated-${currentImage.id}`;
        
        if (isLiveMode && currentImage.videoUrl) {
            imageUrl = currentImage.videoUrl;
            fileName = fileName + '.mp4';
        } else if (currentImage.fileName) {
            fileName = currentImage.fileName;
        }

        if (isDownloading) return;
        setIsDownloading(true);

        try {
            const hasExtension = fileName.match(/\.[a-zA-Z0-9]+$/);
            let base = hasExtension ? fileName.replace(/\.[a-zA-Z0-9]+$/, '') : fileName;
            let ext = hasExtension ? hasExtension[0] : '.png';
            if (currentImage.isBlurred && !base.toUpperCase().endsWith('.NSFW')) base += '.NSFW';
            fileName = base + ext;
            await downloadImage(imageUrl, fileName);
        } catch (e) {
            console.error("Download failed", e);
            window.open(imageUrl, '_blank');
        } finally {
            setIsDownloading(false);
        }
    };

    const uploadCurrentToCloud = async () => {
        if (currentImage) {
            if (isLiveMode && currentImage.videoUrl) {
                const ext = currentImage.videoUrl.includes('.mp4') ? '.mp4' : '.webm';
                const fileName = `video-${currentImage.id}${ext}`;
                await handleUploadToCloud(currentImage.videoUrl, fileName, { ...currentImage, type: 'video' });
            } else {
                let fileName = currentImage.id || `image-${Date.now()}`;
                if (currentImage.isBlurred) fileName += '.NSFW';
                let ext = getExtensionFromUrl(currentImage.url) || 'png';
                fileName += `.${ext}`;
                await handleUploadToCloud(currentImage.url, fileName);
            }
        }
    };

    // Derived UI states
    const isWorking = isLoading;
    const isLiveGenerating = currentImage?.videoStatus === 'generating';
    const shouldHideToolbar = isWorking; 
    
    const isCurrentUploaded = useMemo(() => {
        if (!currentImage) return false;
        if (isLiveMode && currentImage.videoUrl) {
            return cloudHistory.some(ci => ci.fileName && ci.fileName.includes(`video-${currentImage.id}`));
        } else {
            return cloudHistory.some(ci => ci.fileName && ci.fileName.includes(currentImage.id) && !ci.fileName.includes('video-'));
        }
    }, [currentImage, cloudHistory, isLiveMode]);

    return (
        <main className="w-full max-w-7xl flex-1 flex flex-col-reverse md:items-stretch md:mx-auto md:flex-row gap-4 md:gap-6 px-4 md:px-8 pb-4 md:pb-8 pt-4 md:pt-6">
            {/* Left Column: Controls */}
            <aside className="w-full md:max-w-sm flex-shrink-0 flex flex-col gap-4 md:gap-6">
                <div className="flex-grow space-y-4 md:space-y-6">
                    <div className="relative z-10 bg-black/20 p-4 md:p-6 rounded-xl backdrop-blur-xl border border-white/10 flex flex-col gap-4 md:gap-6 shadow-2xl shadow-black/20">
                        <PromptInput onOptimize={handleOptimizePrompt} />
                        <ControlPanel />
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleGenerate}
                            disabled={isWorking || !prompt.trim() || isTranslating}
                            className="group relative flex-1 flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-xl h-12 px-4 text-white text-lg font-bold leading-normal tracking-[0.015em] transition-all shadow-lg shadow-purple-900/40 generate-button-gradient hover:shadow-purple-700/50 disabled:opacity-70 disabled:cursor-not-allowed disabled:grayscale"
                        >
                            {isLoading || isTranslating ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="animate-spin w-5 h-5" />
                                    <span>{isTranslating ? t.translating : t.dreaming}</span>
                                </div>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 group-hover:animate-pulse" />
                                    <span className="truncate">{t.generate}</span>
                                </span>
                            )}
                        </button>

                        {currentImage && (
                            <Tooltip content={t.reset}>
                                <button 
                                    onClick={handleReset}
                                    className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-lg active:scale-95"
                                >
                                    <RotateCcw className="w-5 h-5" />
                                </button>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </aside>

            {/* Right Column: Preview & Gallery */}
            <div className="flex-1 flex flex-col flex-grow overflow-x-hidden">
                <div className="relative group w-full">
                    <PreviewStage 
                        currentImage={currentImage}
                        isWorking={isWorking}
                        isTranslating={isTranslating}
                        elapsedTime={elapsedTime}
                        error={error}
                        onCloseError={() => setError(null)}
                        isComparing={isComparing}
                        tempUpscaledImage={tempUpscaledImage}
                        showInfo={showInfo}
                        setShowInfo={setShowInfo}
                        imageDimensions={imageDimensions}
                        setImageDimensions={setImageDimensions}
                        isLiveMode={isLiveMode}
                        onToggleLiveMode={() => setIsLiveMode(!isLiveMode)}
                    />

                    {!shouldHideToolbar && (
                        <ImageToolbar 
                            currentImage={currentImage}
                            isComparing={isComparing}
                            showInfo={showInfo}
                            setShowInfo={setShowInfo}
                            isUpscaling={isUpscaling}
                            isDownloading={isDownloading}
                            handleUpscale={handleUpscale}
                            handleToggleBlur={handleToggleBlur}
                            handleDownload={handleDownload}
                            handleDelete={handleDelete}
                            handleCancelUpscale={handleCancelUpscale}
                            handleApplyUpscale={handleApplyUpscale}
                            isLiveMode={isLiveMode}
                            onLiveClick={handleLiveClick}
                            isLiveGenerating={isLiveGenerating}
                            provider={provider}
                            handleUploadToS3={uploadCurrentToCloud}
                            isUploading={isUploading}
                            isUploaded={isCurrentUploaded}
                            imageDimensions={imageDimensions}
                            copiedPrompt={copiedPrompt}
                            handleCopyPrompt={handleCopyPrompt}
                        />
                    )}
                </div>

                <HistoryGallery onSelect={handleHistorySelect} />
            </div>
        </main>
    );
};
