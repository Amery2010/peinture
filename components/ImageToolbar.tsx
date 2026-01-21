
import React, { useState, useEffect } from 'react';
import { Info as LucideInfo, Eye as LucideEye, EyeOff as LucideEyeOff, Download as LucideDownload, Trash2 as LucideTrash2, X as LucideX, Check as LucideCheck, Loader2 as LucideLoader2, Film as LucideFilm, CloudUpload, Timer, Copy, Check } from 'lucide-react';
import { Icon4x as CustomIcon4x } from './Icons';
import { Tooltip } from './Tooltip';
import { GeneratedImage, ProviderOption } from '../types';
import { isStorageConfigured } from '../services/storageService';
import { getCustomProviders } from '../services/utils';
import { HF_MODEL_OPTIONS, GITEE_MODEL_OPTIONS, MS_MODEL_OPTIONS, A4F_MODEL_OPTIONS } from '../constants';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';

interface ImageToolbarProps {
    currentImage: GeneratedImage | null;
    isComparing: boolean;
    showInfo: boolean;
    setShowInfo: (val: boolean) => void;
    isUpscaling: boolean;
    isDownloading: boolean;
    handleUpscale: () => void;
    handleToggleBlur: () => void;
    handleDownload: () => void;
    handleDelete: () => void;
    handleCancelUpscale: () => void;
    handleApplyUpscale: () => void;
    // New Props for Live
    isLiveMode?: boolean;
    onLiveClick?: () => void;
    isLiveGenerating?: boolean;
    isGeneratingVideoPrompt?: boolean;
    provider?: ProviderOption;
    // Cloud Props
    handleUploadToS3?: () => void;
    isUploading?: boolean;
    isUploaded?: boolean;
    // New Props for Popover
    imageDimensions: { width: number, height: number } | null;
    copiedPrompt: boolean;
    handleCopyPrompt: () => void;
}

export const ImageToolbar: React.FC<ImageToolbarProps> = ({
    currentImage,
    isComparing,
    showInfo,
    setShowInfo,
    isUpscaling,
    isDownloading,
    handleUpscale,
    handleToggleBlur,
    handleDownload,
    handleDelete,
    handleCancelUpscale,
    handleApplyUpscale,
    isLiveMode,
    onLiveClick,
    isLiveGenerating,
    isGeneratingVideoPrompt,
    provider,
    handleUploadToS3,
    isUploading,
    isUploaded,
    imageDimensions,
    copiedPrompt,
    handleCopyPrompt
}) => {
    const { language } = useAppStore();
    const t = translations[language];
    const [isStorageEnabled, setIsStorageEnabled] = useState(false);

    useEffect(() => {
        const checkStorage = () => {
            setIsStorageEnabled(isStorageConfigured());
        };
        checkStorage();
        window.addEventListener('storage', checkStorage);
        // Fallback polling for settings changes
        const interval = setInterval(checkStorage, 2000);
        return () => {
            window.removeEventListener('storage', checkStorage);
            clearInterval(interval);
        };
    }, []);

    if (!currentImage) return null;

    // Use currentImage.provider to determine capabilities relative to the image source
    // Fallback to current provider prop if image provider is missing (should be rare)
    const imgProvider = currentImage.provider || provider;

    // Logic for button visibility:
    // 1. Details, NSFW, Download, Delete -> Always
    // 2. Live -> Always (supported via cross-provider handling)
    // 3. Upscale -> Always available (now uses Settings config)
    // 4. Upload -> If storage configured
    
    // Live button is now enabled for all images
    const showLiveButton = !isLiveMode; // Only hide if actively viewing the video (replaced by 'Image' button in PreviewStage)
    const showUpscaleButton = !isLiveMode; // Upscale is available unless in video mode
    const showUploadButton = isStorageEnabled;
    
    const isBusy = isLiveGenerating || isGeneratingVideoPrompt;
    // Disable live button if busy (generating) OR if already in Live Mode (viewing video)
    const isLiveDisabled = isBusy || isLiveMode;

    const getProviderLabel = (providerId?: string) => {
        if (!providerId) return 'Hugging Face';
        if (providerId === 'gitee') return 'Gitee AI';
        if (providerId === 'modelscope') return 'Model Scope';
        if (providerId === 'a4f') return 'A4F';
        if (providerId === 'huggingface') return 'Hugging Face';
        
        // Check Custom Providers
        const customProviders = getCustomProviders();
        const custom = customProviders.find(p => p.id === providerId);
        return custom ? custom.name : providerId; // Fallback to ID if not found
    };

    const getModelLabel = (modelValue: string, providerId?: string) => {
        // First check standard lists
        const option = [...HF_MODEL_OPTIONS, ...GITEE_MODEL_OPTIONS, ...MS_MODEL_OPTIONS, ...A4F_MODEL_OPTIONS].find(o => o.value === modelValue);
        if (option) return option.label;

        // Then check custom provider models if available
        if (providerId) {
            const customProviders = getCustomProviders();
            const custom = customProviders.find(p => p.id === providerId);
            if (custom) {
                // Search in all categories
                const allModels = [
                    ...(custom.models.generate || []),
                    ...(custom.models.edit || []),
                    ...(custom.models.video || []),
                    ...(custom.models.text || [])
                ];
                const customModel = allModels.find(m => m.id === modelValue);
                if (customModel) return customModel.name;
            }
        }
        
        return modelValue;
    };

    return (
        <div className="absolute bottom-4 md:bottom-6 inset-x-0 flex justify-center pointer-events-none z-40">
            {isComparing ? (
                /* Comparison Controls */
                <div className="pointer-events-auto flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
                    <button
                        onClick={handleCancelUpscale}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all shadow-xl hover:shadow-red-900/10 hover:border-red-500/30"
                    >
                        <LucideX className="w-5 h-5 text-red-400" />
                        <span className="font-medium text-sm">{t.discard}</span>
                    </button>
                    <button
                        onClick={handleApplyUpscale}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all shadow-xl hover:shadow-purple-900/10 hover:border-purple-500/30"
                    >
                        <LucideCheck className="w-5 h-5 text-purple-400" />
                        <span className="font-medium text-sm">{t.apply}</span>
                    </button>
                </div>
            ) : (
                /* Standard Toolbar Container */
                <div className="relative pointer-events-auto">
                    
                    {/* Info Popover (Positioned relative to toolbar) */}
                    {showInfo && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-[90vw] md:w-[400px] bg-[#1A1625]/95 backdrop-blur-md border border-white/10 rounded-xl p-5 shadow-2xl text-sm text-white/80 animate-in slide-in-from-bottom-2 fade-in duration-200 z-50">
                            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                                <h4 className="font-medium text-white">{t.imageDetails}</h4>
                                <button onClick={() => setShowInfo(false)} className="text-white/40 hover:text-white">
                                    <LucideX className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="block text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-0.5">{t.provider}</span>
                                        <p className="text-white/90 capitalize truncate" title={getProviderLabel(currentImage.provider)}>
                                            {getProviderLabel(currentImage.provider)}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="block text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-0.5">{t.model}</span>
                                        <p className="text-white/90 truncate" title={getModelLabel(currentImage.model, currentImage.provider)}>
                                            {getModelLabel(currentImage.model, currentImage.provider)}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="block text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-0.5">{t.dimensions}</span>
                                        <p className="text-white/90">
                                            {imageDimensions ? `${imageDimensions.width} x ${imageDimensions.height}` : currentImage.aspectRatio}
                                            {/* Show aspect ratio if not custom or if dimensions match */}
                                            {currentImage.aspectRatio !== 'custom' && imageDimensions && ` (${currentImage.aspectRatio})`}
                                            {currentImage.isUpscaled && <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 font-bold">HD</span>}
                                        </p>
                                    </div>
                                    {currentImage.duration !== undefined && (
                                        <div>
                                            <span className="block text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-0.5">{t.duration}</span>
                                            <p className="font-mono text-white/90 flex items-center gap-1">
                                                <Timer className="w-3 h-3 text-purple-400" />
                                                {currentImage.duration.toFixed(1)}s
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {currentImage.seed !== undefined && (
                                        <div>
                                            <span className="block text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-0.5">{t.seed}</span>
                                            <p className="font-mono text-white/90">{currentImage.seed}</p>
                                        </div>
                                    )}
                                    {currentImage.guidanceScale !== undefined && (
                                        <div>
                                            <span className="block text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-0.5">{t.guidanceScale}</span>
                                            <p className="font-mono text-white/90">{currentImage.guidanceScale.toFixed(1)}</p>
                                        </div>
                                    )}
                                    {currentImage.steps !== undefined && (
                                        <div>
                                            <span className="block text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-0.5">{t.steps}</span>
                                            <p className="font-mono text-white/90">{currentImage.steps}</p>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="block text-white/40 text-[10px] uppercase tracking-wider font-semibold">{t.prompt}</span>
                                        <button
                                            onClick={handleCopyPrompt}
                                            className="flex items-center gap-1.5 text-[10px] font-medium text-purple-400 hover:text-purple-300 transition-colors"
                                        >
                                            {copiedPrompt ? (
                                                <>
                                                    <Check className="w-3 h-3" />
                                                    {t.copied}
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3 h-3" />
                                                    {t.copy}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <div className="max-h-24 overflow-y-auto custom-scrollbar p-2 bg-black/20 rounded-lg border border-white/5">
                                        <p className="text-xs leading-relaxed text-white/70 italic select-text">{currentImage.prompt}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="max-w-[90vw] overflow-x-auto md:overflow-visible scrollbar-hide rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 shadow-2xl transition-opacity duration-300 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                        <div className="flex items-center gap-1 p-1.5 min-w-max">

                            <Tooltip content={t.details}>
                                <button
                                    onClick={() => setShowInfo(!showInfo)}
                                    className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${showInfo ? 'bg-purple-600 text-white shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                                >
                                    <LucideInfo className="w-5 h-5" />
                                </button>
                            </Tooltip>

                            <div className="w-px h-5 bg-white/10 mx-1"></div>

                            {/* Live Button for Gitee or Hugging Face */}
                            {showLiveButton && (
                                <>
                                    <Tooltip content={isGeneratingVideoPrompt ? t.liveGeneratingDesc : (isLiveGenerating ? t.liveGenerating : t.live)}>
                                        <button
                                            onClick={onLiveClick}
                                            disabled={isLiveDisabled}
                                            className={`
                                                flex items-center justify-center w-10 h-10 rounded-xl transition-all
                                                ${isLiveMode ? 'text-red-400 bg-red-500/10' : 'text-white/70 hover:text-red-400 hover:bg-white/10'}
                                                ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}
                                                ${isLiveMode && !isBusy ? 'cursor-default' : ''}
                                                ${!isLiveMode && !isBusy ? 'cursor-pointer' : ''}
                                            `}
                                        >
                                            {(isLiveGenerating || isGeneratingVideoPrompt) ? (
                                                <LucideLoader2 className="w-5 h-5 animate-spin text-red-400" />
                                            ) : (
                                                <LucideFilm className="w-5 h-5" />
                                            )}
                                        </button>
                                    </Tooltip>
                                    <div className="w-px h-5 bg-white/10 mx-1"></div>
                                </>
                            )}

                            {/* Upscale Button - Always shown if not live mode */}
                            {showUpscaleButton && (
                                <>
                                    <Tooltip content={isUpscaling ? t.upscaling : t.upscale}>
                                        <button
                                            onClick={handleUpscale}
                                            disabled={isUpscaling || currentImage.isUpscaled}
                                            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${currentImage.isUpscaled ? 'text-purple-400 bg-purple-500/10' : 'text-white/70 hover:text-purple-400 hover:bg-white/10'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            {isUpscaling ? (
                                                <LucideLoader2 className="w-5 h-5 animate-spin text-purple-400" />
                                            ) : (
                                                <CustomIcon4x className="w-5 h-5 transition-colors duration-300" />
                                            )}
                                        </button>
                                    </Tooltip>
                                    <div className="w-px h-5 bg-white/10 mx-1"></div>
                                </>
                            )}

                            <Tooltip content={t.toggleBlur}>
                                <button
                                    onClick={handleToggleBlur}
                                    className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${currentImage.isBlurred ? 'text-purple-400 bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                                >
                                    {currentImage.isBlurred ? <LucideEyeOff className="w-5 h-5" /> : <LucideEye className="w-5 h-5" />}
                                </button>
                            </Tooltip>

                            <div className="w-px h-5 bg-white/10 mx-1"></div>

                            {/* Upload Button */}
                            {showUploadButton && (
                                <>
                                    <Tooltip content={isUploading ? t.uploading : (isUploaded ? t.upload_success : t.upload)}>
                                        <button
                                            onClick={handleUploadToS3}
                                            disabled={isUploading}
                                            className={`
                                                flex items-center justify-center w-10 h-10 rounded-xl transition-all 
                                                ${isUploading 
                                                    ? 'text-green-400 bg-green-500/10 cursor-not-allowed' 
                                                    : (isUploaded 
                                                        ? 'text-green-400 bg-green-500/20 border border-green-500/30 shadow-[0_0_10px_-3px_rgba(74,222,128,0.3)] hover:bg-green-500/30' 
                                                        : 'text-white/70 hover:text-green-400 hover:bg-white/10'
                                                    )
                                                }
                                            `}
                                        >
                                            {isUploading ? (
                                                <LucideLoader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <CloudUpload className="w-5 h-5" />
                                            )}
                                        </button>
                                    </Tooltip>
                                    <div className="w-px h-5 bg-white/10 mx-1"></div>
                                </>
                            )}

                            <Tooltip content={t.download}>
                                <button
                                    onClick={handleDownload}
                                    disabled={isDownloading}
                                    className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${isDownloading ? 'text-blue-400 bg-blue-500/10 cursor-not-allowed' : 'text-white/70 hover:text-blue-400 hover:bg-white/10'}`}
                                >
                                    {isDownloading ? (
                                        <LucideLoader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <LucideDownload className="w-5 h-5" />
                                    )}
                                </button>
                            </Tooltip>

                            <div className="w-px h-5 bg-white/10 mx-1"></div>

                            <Tooltip content={t.delete}>
                                <button
                                    onClick={handleDelete}
                                    className="flex items-center justify-center w-10 h-10 rounded-xl text-white/70 hover:text-red-400 hover:bg-white/10 transition-all hover:bg-red-500/10"
                                >
                                    <LucideTrash2 className="w-5 h-5" />
                                </button>
                            </Tooltip>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
