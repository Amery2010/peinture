
import { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useAppStore } from '../store/appStore';
import { fetchBlob, downloadImage, getTextModelConfig, getEditModelConfig, getCustomProviders } from '../services/utils';
import { translations } from '../translations';
import { editImageQwen } from '../services/hfService';
import { editImageGitee, optimizePromptGitee } from '../services/giteeService';
import { editImageMS, optimizePromptMS } from '../services/msService';
import { editImageCustom, optimizePromptCustom } from '../services/customService';
import { optimizeEditPrompt, getExtensionFromUrl } from '../services/utils';
import { saveTempFileToOPFS } from '../services/storageService';

export const useEditorGeneration = (
    image: HTMLImageElement | null, 
    canvasRef: React.RefObject<HTMLCanvasElement>,
    historyIndex: number,
    handleUploadToS3?: (blob: Blob, fileName: string, metadata?: any) => Promise<void>
) => {
    const { prompt, setPrompt, attachedImages } = useEditorStore();
    const { language, provider, isUploading } = useAppStore();
    const t = translations[language];

    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedResult, setGeneratedResult] = useState<string | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Timer
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isGenerating) {
            setElapsedTime(0);
            const startTime = Date.now();
            interval = setInterval(() => {
                setElapsedTime((Date.now() - startTime) / 1000);
            }, 100);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [isGenerating]);

    useEffect(() => {
        return () => abortControllerRef.current?.abort();
    }, []);

    // Helper: Merge Original + Canvas
    const getMergedLayer = (): HTMLCanvasElement | null => {
        if (!image || !canvasRef.current) return null;
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(image, 0, 0);
        ctx.drawImage(canvasRef.current, 0, 0);
        return canvas;
    };

    const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas conversion failed'));
            }, 'image/png');
        });
    };

    const scaleToConstraints = (w: number, h: number, maxVal: number = 2048) => {
        let width = w;
        let height = h;
        const MAX = maxVal;
        const MIN = 256;
        if (width > MAX || height > MAX) {
            const ratio = Math.min(MAX / width, MAX / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
        }
        if (width < MIN || height < MIN) {
            const ratio = Math.max(MIN / width, MIN / height);
            width = Math.ceil(width * ratio);
            height = Math.ceil(height * ratio);
        }
        const normalize = (v: number) => Math.floor(v / 8) * 8;
        return {
            width: normalize(width),
            height: normalize(height),
        };
    };

    const handleOptimize = async () => {
        if (!image || !prompt.trim()) return;
        setIsOptimizing(true);
        try {
            const mergedCanvas = getMergedLayer();
            if (!mergedCanvas) throw new Error("Could not get image data");
            
            // Resize for vision analysis
            const maxDim = 1024;
            let w = mergedCanvas.width;
            let h = mergedCanvas.height;
            if (w > maxDim || h > maxDim) {
                const ratio = Math.min(maxDim / w, maxDim / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            const ctx = tempCanvas.getContext('2d');
            if(ctx) ctx.drawImage(mergedCanvas, 0, 0, w, h);
            
            const base64 = tempCanvas.toDataURL('image/jpeg', 0.8); 
            
            const textConfig = getTextModelConfig();
            let optimized = '';

            if (textConfig.provider === 'huggingface') {
                 optimized = await optimizeEditPrompt(base64, prompt, textConfig.model);
            } else if (textConfig.provider === 'gitee') {
                 optimized = await optimizePromptGitee(prompt, textConfig.model);
            } else if (textConfig.provider === 'modelscope') {
                 optimized = await optimizePromptMS(prompt, textConfig.model);
            } else {
                 const customProviders = getCustomProviders();
                 const activeCustom = customProviders.find(p => p.id === textConfig.provider);
                 if (activeCustom) {
                     optimized = await optimizePromptCustom(activeCustom, textConfig.model, prompt);
                 } else {
                     optimized = await optimizeEditPrompt(base64, prompt, textConfig.model);
                 }
            }

            if (optimized) setPrompt(optimized);
        } catch (e) {
            console.error("Command optimization failed", e);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleGenerate = async () => {
        if (isGenerating) {
            abortControllerRef.current?.abort();
            setIsGenerating(false);
            return;
        }
        if (!image || !prompt.trim()) return;
        setIsGenerating(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {        
            const maxDimension = 2048;
            const { width, height } = scaleToConstraints(image.naturalWidth, image.naturalHeight, maxDimension);
            const hasDrawings = historyIndex > 0;
            const imageBlobs: Blob[] = [];
            let promptSuffix = `\n${t.prompt_original_image}`;
            let currentImageIndexInAPI = 1;
            
            const originalBlob = await fetchBlob(image.src);
            imageBlobs.push(originalBlob);
            
            if (hasDrawings) {
                const mergedCanvas = getMergedLayer();
                if (mergedCanvas) {
                    const mergedBlob = await canvasToBlob(mergedCanvas);
                    imageBlobs.push(mergedBlob);
                    currentImageIndexInAPI++;
                    const editLayerDesc = t.prompt_edit_layer.replace('{n}', currentImageIndexInAPI.toString());
                    promptSuffix += `\n${editLayerDesc}`;
                }
            }
            
            for (let i = 0; i < attachedImages.length; i++) {
                const refBlob = await fetchBlob(attachedImages[i]);
                imageBlobs.push(refBlob);
                currentImageIndexInAPI++;
                const refNumInUI = i + 1;
                const refDesc = t.prompt_ref_image.replace('{n}', currentImageIndexInAPI.toString()).replace('{i}', refNumInUI.toString());
                promptSuffix += `\n${refDesc}`;
            }
            
            const finalPrompt = prompt + promptSuffix;
            let result;

            const config = getEditModelConfig();
            const activeProvider = config.provider;

            if (activeProvider === 'gitee') {
                result = await editImageGitee(imageBlobs, finalPrompt, width, height, 16, 4, controller.signal);
            } else if (activeProvider === 'modelscope') {
                result = await editImageMS(imageBlobs, finalPrompt, width, height, 16, 4, controller.signal);
            } else if (activeProvider === 'huggingface') {
                result = await editImageQwen(imageBlobs, finalPrompt, width, height, 4, 1, controller.signal);
            } else {
                const customProviders = getCustomProviders();
                const activeCustom = customProviders.find(p => p.id === activeProvider);
                if (activeCustom) {
                    result = await editImageCustom(activeCustom, config.model, imageBlobs, finalPrompt, undefined, undefined, undefined);
                } else {
                    result = await editImageQwen(imageBlobs, finalPrompt, width, height, 4, 1, controller.signal);
                }
            }
            
            // Cache result to OPFS and use local Object URL
            let finalUrl = result.url;
            try {
                const blob = await fetchBlob(result.url);
                const fileName = `edit-${Date.now()}.png`; 
                await saveTempFileToOPFS(blob, fileName);
                finalUrl = URL.createObjectURL(blob);
            } catch (e) {
                console.warn("Failed to cache edited image", e);
            }
            
            setGeneratedResult(finalUrl);
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                console.error("Generation failed", e);
            }
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
        }
    };

    const handleDownloadResult = async (url: string, isSourceNSFW: boolean) => {
        setIsDownloading(true);
        try {
            let fileName = `edited_image_${Date.now()}`;
            let base = fileName;
            let ext = '.png';
            if (isSourceNSFW && !base.toUpperCase().endsWith('.NSFW')) {
                base += '.NSFW';
            }
            fileName = base + ext;
            await downloadImage(url, fileName);
        } catch (e) {
            console.error("Download failed", e);
            window.open(url, '_blank');
        } finally {
            setIsDownloading(false);
        }
    };

    const onCloudUpload = async (isSourceNSFW: boolean) => {
        if (!generatedResult || !handleUploadToS3) return;
        try {
            const blob = await fetchBlob(generatedResult);
            const metadata = {
                prompt: prompt,
                provider: provider,
                model: 'Qwen-Image-Edit',
                timestamp: Date.now()
            };
            
            let fileName = `edited-${Date.now()}`;
            if (isSourceNSFW) fileName += '.NSFW';
            const getExt = (url: string) => {
                try {
                    const u = new URL(url);
                    const p = u.pathname.split('.').pop();
                    return p || 'png';
                } catch { return 'png'; }
            }
            fileName += `.${getExt(generatedResult)}`

            await handleUploadToS3(blob, fileName, metadata);
        } catch (e) {
            console.error("Failed to prepare blob for upload", e);
        }
    };

    return {
        isGenerating,
        isOptimizing,
        isDownloading,
        isUploading,
        elapsedTime,
        generatedResult,
        setGeneratedResult,
        handleGenerate,
        handleOptimize,
        handleDownloadResult,
        onCloudUpload,
        getMergedLayer
    };
};
