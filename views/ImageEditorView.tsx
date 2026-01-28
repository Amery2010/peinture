import React, { useRef, useEffect, useCallback, useState } from 'react';
import { 
    Upload,
    X, 
    LogOut,
    Keyboard,
    Minus,
    Plus,
    Loader2,
    Image as ImageIcon,
    AlignCenter,
    Download,
    RotateCcw,
    History,
    Paintbrush,
    CloudUpload,
    Cloud,
    Sparkles,
    Clock
} from 'lucide-react';
import { Tooltip } from '../components/Tooltip';
import { isStorageConfigured, listCloudFiles, getStorageType, fetchCloudBlob, getS3Config } from '../services/storageService';
import { CloudFile } from '../types';
import { ImageComparison } from '../components/ImageComparison';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import { useEditorStore, ToolType } from '../store/editorStore';
import { useEditorCanvas } from '../hooks/useEditorCanvas';
import { useEditorGeneration } from '../hooks/useEditorGeneration';
import { fetchBlob, downloadImage } from '../services/utils';
import { EditorToolbar } from '../components/editor/EditorToolbar';
import { EditorBottomBar } from '../components/editor/EditorBottomBar';

interface ImageEditorViewProps {
    onOpenSettings: () => void;
    handleUploadToS3?: (blob: Blob, fileName: string, metadata?: any) => Promise<void>;
}

export const ImageEditorView: React.FC<ImageEditorViewProps> = ({ onOpenSettings, handleUploadToS3 }) => {
    const { language, provider, history } = useAppStore();
    const t = translations[language];

    // Store State
    const { 
        activeTool, setActiveTool, 
        scale, offset,
        showShortcuts, setShowShortcuts,
        showHistoryModal, setShowHistoryModal,
        showGalleryModal, setShowGalleryModal,
        showExitDialog, setShowExitDialog,
        resetEditor
    } = useEditorStore();

    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const activeObjectUrlRef = useRef<string | null>(null);

    // Custom Hooks
    const { 
        canvasRef, image, historyIndex,
        handleMouseDown, handleMouseMove, handleMouseUp,
        initCanvas, resetCanvas, undo, redo,
        zoomIn, zoomOut, zoomReset, centerView,
    } = useEditorCanvas(containerRef);

    const {
        isGenerating, isOptimizing, isDownloading, isUploading,
        elapsedTime, generatedResult, setGeneratedResult,
        handleGenerate, handleOptimize, handleDownloadResult, onCloudUpload,
        getMergedLayer
    } = useEditorGeneration(image, canvasRef, historyIndex, handleUploadToS3);

    // Local UI State
    const [isDragOver, setIsDragOver] = useState(false);
    const [isSourceNSFW, setIsSourceNSFW] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
    
    // Gallery State
    const [galleryFiles, setGalleryFiles] = useState<CloudFile[]>([]);
    const [galleryLoading, setGalleryLoading] = useState(false);
    const [galleryLimit, setGalleryLimit] = useState(20);
    const [galleryLocalUrls, setGalleryLocalUrls] = useState<Record<string, string>>({});
    const [isStorageEnabled, setIsStorageEnabled] = useState(false);

    // Cleanup active URL
    const cleanupActiveObjectUrl = () => {
        if (activeObjectUrlRef.current) {
            URL.revokeObjectURL(activeObjectUrlRef.current);
            activeObjectUrlRef.current = null;
        }
    };

    // Init Logic
    useEffect(() => {
        const checkStorage = () => setIsStorageEnabled(isStorageConfigured());
        checkStorage();
        window.addEventListener('storage', checkStorage);
        return () => {
            window.removeEventListener('storage', checkStorage);
            cleanupActiveObjectUrl();
            Object.values(galleryLocalUrls).forEach(url => URL.revokeObjectURL(url));
            resetEditor(); // Reset store on unmount
        };
    }, []);

    // File Handling
    const processFile = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) return;
        setIsSourceNSFW(file.name.toUpperCase().includes('.NSFW'));
        cleanupActiveObjectUrl();
        const objectUrl = URL.createObjectURL(file);
        activeObjectUrlRef.current = objectUrl;
        
        const img = new Image();
        img.onload = () => initCanvas(img);
        img.onerror = () => {
            console.error("Failed to load image");
            cleanupActiveObjectUrl();
        };
        img.src = objectUrl;
    }, [initCanvas]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
            e.target.value = '';
        }
    };

    const loadEditorImage = async (url: string) => {
        try {
            // Use fetchCloudBlob to support opfs:// and private cloud urls
            const blob = await fetchCloudBlob(url);
            cleanupActiveObjectUrl();
            const objectUrl = URL.createObjectURL(blob);
            activeObjectUrlRef.current = objectUrl;
            
            const img = new Image();
            img.onload = () => {
                resetEditor(); // Reset tools/prompt
                initCanvas(img);
            };
            img.src = objectUrl;
        } catch (e) {
            console.error("Failed to fetch image", e);
        }
    };

    // Exit
    const handleExit = () => {
        cleanupActiveObjectUrl();
        resetCanvas();
        resetEditor();
        setGeneratedResult(null);
        setIsSourceNSFW(false);
    };

    // Drag & Drop
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    };

    // Paste
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (e.clipboardData && e.clipboardData.files.length > 0) {
                const file = e.clipboardData.files[0];
                if (file.type.startsWith('image/')) {
                    e.preventDefault();
                    processFile(file);
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [processFile]);

    // Shortcuts
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const MOD_KEY = isMac ? 'Cmd' : 'Alt'; 

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMod = isMac ? e.metaKey : e.altKey;
            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

            if (e.key === 'Escape') {
                if (generatedResult) setGeneratedResult(null);
                else if (contextMenu) setContextMenu(null);
                else if (showShortcuts) setShowShortcuts(false);
                else if (showHistoryModal) setShowHistoryModal(false);
                else if (showGalleryModal) setShowGalleryModal(false);
                else if (showExitDialog) setShowExitDialog(false);
                else if (image) setShowExitDialog(true);
                return;
            }

            // Global Send Shortcut (Shift+Enter)
            if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                handleGenerate();
                return;
            }

            if (isInput) return;

            // Tool Shortcuts
            if (!isMod) {
                const k = e.key.toLowerCase();
                switch(k) {
                    case '0': case 'm': e.preventDefault(); setActiveTool(activeTool === 'move' ? 'select' : 'move'); break;
                    case '1': case 'd': e.preventDefault(); setActiveTool('brush'); break;
                    case '2': case 'r': e.preventDefault(); setActiveTool('rect'); break;
                    case '3': case 'e': e.preventDefault(); setActiveTool('eraser'); break;
                    case '5': case 'c': 
                        e.preventDefault(); 
                        document.getElementById('editor-color-picker')?.click(); 
                        break;
                    case '+': case '=': e.preventDefault(); zoomIn(); break;
                    case '-': case '_': e.preventDefault(); zoomOut(); break;
                }
            } else {
                if (e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) redo();
                    else undo();
                }
                if (e.key === '0') {
                    e.preventDefault();
                    zoomReset();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTool, generatedResult, contextMenu, showShortcuts, showHistoryModal, showGalleryModal, showExitDialog, image, zoomIn, zoomOut, zoomReset, redo, undo, setActiveTool, handleGenerate]);

    // Gallery Loading
    useEffect(() => {
        if (showGalleryModal && isStorageEnabled) {
            setGalleryLoading(true);
            listCloudFiles().then(files => {
                setGalleryFiles(files.filter(f => f.type === 'image').sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime()));
                setGalleryLoading(false);
            });
        }
    }, [showGalleryModal, isStorageEnabled]);

    // Preload Gallery Thumbnails
    useEffect(() => {
        if (!showGalleryModal || !isStorageEnabled) return;

        const type = getStorageType();
        // For OPFS, WebDAV, or Private S3, we need to fetch blobs to display them
        const useProxyLoading = type === 'webdav' || type === 'opfs' || (type === 's3' && !getS3Config().publicDomain);
        
        if (!useProxyLoading) return;

        let isCancelled = false;
        // Fix line 101: Explicitly type the visibleFiles array to ensure iterator is correctly inferred and avoid 'unknown' errors
        const visibleFiles: CloudFile[] = galleryFiles.slice(0, galleryLimit);

        const loadImagesSequentially = async () => {
            for (const file of visibleFiles) {
                if (isCancelled) break;
                // Skip if already loaded
                if (galleryLocalUrls[file.key]) continue;

                try {
                    const blob = await fetchCloudBlob(file.url);
                    if (!isCancelled) {
                        const url = URL.createObjectURL(blob);
                        setGalleryLocalUrls(prev => ({ ...prev, [file.key]: url }));
                    }
                } catch (e) {
                    console.error(`Failed to load thumbnail: ${file.key}`);
                }
            }
        };

        if (visibleFiles.length > 0) {
            loadImagesSequentially();
        }

        return () => { isCancelled = true; };
    }, [showGalleryModal, galleryFiles, galleryLimit, isStorageEnabled]);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        if (image) setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleDownloadExport = () => {
        const merged = getMergedLayer();
        if (merged) handleDownloadResult(merged.toDataURL('image/png'), false);
        setContextMenu(null);
    };

    const ShortcutRow = ({ label, keys }: { label: string, keys: React.ReactNode[] }) => (
        <div className="flex items-center justify-between text-sm group">
            <span className="text-white/60">{label}</span>
            <div className="flex gap-1 items-center">
                {keys.map((k, i) => (
                    typeof k === 'string' && ['+', '-', 'Cmd', 'Alt', 'Shift', 'Enter', 'ESC', 'Z', 'M', '0', '1', '2', '3', '5', 'C', 'D', 'R', 'E'].includes(k) 
                    ? <span key={i} className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-xs">{k}</span>
                    : <span key={i} className="text-white/40 text-xs">{k}</span>
                ))}
            </div>
        </div>
    );

    return (
        <div className="w-full h-full flex flex-grow flex-col md:max-w-7xl md:mx-auto relative">
            {/* Main Canvas Area */}
            <div 
                ref={containerRef}
                onContextMenu={handleContextMenu}
                className="flex-1 w-full relative overflow-hidden bg-[#0D0B14] cursor-crosshair rounded-none border-none md:rounded-xl md:border md:border-white/5"
                style={{ backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)', backgroundSize: '20px 20px' }}
            >
                {isGenerating && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="relative">
                            <div className="h-24 w-24 rounded-full border-4 border-white/10 border-t-purple-500 animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center"><Paintbrush className="text-purple-400 animate-pulse w-8 h-8" /></div>
                        </div>
                        <p className="mt-8 text-white/80 font-medium animate-pulse text-lg">{t.dreaming}</p>
                        <p className="mt-2 font-mono text-purple-300 text-lg">{elapsedTime.toFixed(1)}s</p>
                    </div>
                )}

                {!image && (
                    <div className="absolute z-40 inset-0 flex flex-col items-center justify-center p-6 md:p-12">
                        <div className="w-full max-w-lg space-y-4">
                            <label
                                className={`cursor-pointer group flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all duration-300 animate-in zoom-in-95 ${
                                    isDragOver ? 'border-purple-500 bg-purple-500/10 scale-105' : 'border-white/20 bg-white/[0.02] hover:bg-white/[0.05] hover:border-purple-500/50'
                                }`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleImageUpload} />
                                <div className="mb-6 p-5 rounded-full bg-white/5 group-hover:bg-purple-500/20 group-hover:scale-110 transition-all duration-300 shadow-lg">
                                    <Upload className={`w-10 h-10 transition-colors ${isDragOver ? 'text-purple-400' : 'text-white/40 group-hover:text-purple-400'}`} />
                                </div>
                                <p className="text-white/60 font-medium text-lg group-hover:text-white/90 transition-colors">{t.upload_image_cta}</p>
                            </label>
                            <div className="flex gap-4">
                                <button onClick={() => setShowHistoryModal(true)} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white border border-white/10 rounded-xl transition-all shadow-lg active:scale-95">
                                    <History className="w-4 h-4" /><span className="font-medium text-sm">{t.select_from_history}</span>
                                </button>
                                {isStorageEnabled && (
                                    <button onClick={() => setShowGalleryModal(true)} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white border border-white/10 rounded-xl transition-all shadow-lg active:scale-95">
                                        <Cloud className="w-4 h-4" /><span className="font-medium text-sm">{t.select_from_gallery}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div 
                    className={`absolute inset-0 origin-top-left touch-none transition-opacity duration-300 ${image ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
                    onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                    onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp} // Simplified touch for brevity
                >
                    {image && <img src={image.src} alt="Layer" className="absolute top-0 left-0 pointer-events-none select-none shadow-2xl" style={{ width: image.width, height: image.height, maxWidth: 'none' }} draggable={false} />}
                    <canvas ref={canvasRef} className={`relative z-10 ${activeTool === 'move' ? 'cursor-grab active:cursor-grabbing' : (activeTool === 'select' ? 'cursor-default' : 'cursor-crosshair')}`} />
                </div>

                {generatedResult && image && (
                    <div className="absolute inset-0 z-50 bg-[#0D0B14] animate-in fade-in duration-300">
                        <div className="relative w-full h-full overflow-hidden">
                             <ImageComparison beforeImage={image.src} afterImage={generatedResult} alt="Comparison" labelBefore={t.compare_original} labelAfter={t.compare_edited} />
                             <div className="absolute bottom-6 inset-x-0 flex justify-center pointer-events-none z-40">
                                <div className="pointer-events-auto max-w-[90%] overflow-x-auto scrollbar-hide rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                                    <div className="flex items-center gap-1 p-1.5 min-w-max">
                                        <Tooltip content={t.re_edit}>
                                            <button onClick={() => setGeneratedResult(null)} className="flex items-center justify-center w-10 h-10 rounded-xl text-white/70 hover:text-purple-400 hover:bg-white/10 transition-all"><RotateCcw className="w-5 h-5" /></button>
                                        </Tooltip>
                                        <div className="w-px h-5 bg-white/10 mx-1"></div>
                                        {isStorageEnabled && provider !== 'modelscope' && (
                                            <>
                                                <Tooltip content={isUploading ? t.uploading : t.upload}>
                                                    <button onClick={() => onCloudUpload(isSourceNSFW)} disabled={isUploading} className="flex items-center justify-center w-10 h-10 rounded-xl text-white/70 hover:text-green-400 hover:bg-white/10 transition-all">
                                                        {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CloudUpload className="w-5 h-5" />}
                                                    </button>
                                                </Tooltip>
                                                <div className="w-px h-5 bg-white/10 mx-1"></div>
                                            </>
                                        )}
                                        <Tooltip content={t.menu_download}>
                                            <button onClick={() => handleDownloadResult(generatedResult, isSourceNSFW)} disabled={isDownloading} className="flex items-center justify-center w-10 h-10 rounded-xl text-white/70 hover:text-blue-400 hover:bg-white/10 transition-all">
                                                {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                            </button>
                                        </Tooltip>
                                        <div className="w-px h-5 bg-white/10 mx-1"></div>
                                        <Tooltip content={t.menu_exit}>
                                            <button onClick={() => setShowExitDialog(true)} className="flex items-center justify-center w-10 h-10 rounded-xl text-white/70 hover:text-red-400 hover:bg-red-500/10 transition-all"><LogOut className="w-5 h-5" /></button>
                                        </Tooltip>
                                    </div>
                                </div>
                             </div>
                        </div>
                    </div>
                )}

                {contextMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
                        <div className="fixed z-50 min-w-[160px] bg-black/60 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-150" style={{ left: contextMenu.x, top: contextMenu.y }}>
                            <button onClick={() => { setContextMenu(null); fileInputRef.current?.click(); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 rounded-lg transition-colors text-left group"><ImageIcon className="w-4 h-4 text-purple-400 group-hover:scale-110" />{t.menu_replace}</button>
                            <button onClick={centerView} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 rounded-lg transition-colors text-left group"><AlignCenter className="w-4 h-4 text-blue-400 group-hover:scale-110" />{t.menu_center}</button>
                            <button onClick={handleDownloadExport} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 rounded-lg transition-colors text-left group"><Download className="w-4 h-4 text-green-400 group-hover:scale-110" />{t.menu_download}</button>
                            <div className="h-px bg-white/10 my-1 mx-1" />
                            <button onClick={() => { setContextMenu(null); setShowExitDialog(true); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-left group"><LogOut className="w-4 h-4 text-red-400 group-hover:scale-110" />{t.menu_exit}</button>
                        </div>
                    </>
                )}

                {image && (
                    <div className="absolute bottom-6 left-6 hidden md:flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-white/70 shadow-lg z-20">
                        <Tooltip content={t.sc_zoom_out}><button onClick={zoomOut} className="p-2 hover:bg-white/10 hover:text-white transition-colors rounded-s-full"><Minus className="w-4 h-4" /></button></Tooltip>
                        <Tooltip content={t.sc_reset_view}><button onClick={zoomReset} className="p-2 text-xs font-mono min-w-[3rem] text-center outline-0 select-none hover:bg-white/10 hover:text-white transition-colors">{Math.round(scale * 100)}%</button></Tooltip>
                        <Tooltip content={t.sc_zoom_in}><button onClick={zoomIn} className="p-2 hover:bg-white/10 hover:text-white transition-colors rounded-e-full"><Plus className="w-4 h-4" /></button></Tooltip>
                    </div>
                )}

                <div className="absolute bottom-6 right-6 hidden md:block z-20">
                    <Tooltip content={t.shortcuts_title} position="left">
                        <button onClick={() => setShowShortcuts(true)} className="p-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors shadow-lg"><Keyboard className="w-5 h-5" /></button>
                    </Tooltip>
                </div>

                <EditorToolbar onUndo={undo} canUndo={historyIndex > 0} />
                <EditorBottomBar 
                    isGenerating={isGenerating} 
                    isOptimizing={isOptimizing} 
                    onGenerate={handleGenerate} 
                    onOptimize={handleOptimize} 
                    imageLoaded={!!image} 
                />
            </div>

            {showExitDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1A1625] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-white mb-2">{t.exit_dialog_title}</h3>
                        <p className="text-white/60 text-sm mb-6">{t.exit_dialog_desc}</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowExitDialog(false)} className="px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium">{t.cancel}</button>
                            <button onClick={handleExit} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors text-sm font-medium">{t.confirm}</button>
                        </div>
                    </div>
                </div>
            )}

            {showHistoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowHistoryModal(false)}>
                    <div className="bg-[#1A1625] border border-white/10 rounded-2xl p-0 max-w-3xl w-[90vw] h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/5">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2"><History className="w-5 h-5 text-purple-400" />{t.history_modal_title}</h3>
                            <button onClick={() => setShowHistoryModal(false)} className="text-white/40 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-[#0D0B14]">
                            {history.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-white/30 space-y-4"><Sparkles className="w-12 h-12 opacity-50" /><p>{t.no_history_images}</p></div> : 
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{history.map((img) => (
                                    <button key={img.id} onClick={() => { setIsSourceNSFW(!!img.isBlurred); loadEditorImage(img.url); setShowHistoryModal(false); }} className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-purple-500 transition-all hover:ring-4 hover:ring-purple-500/20 focus:outline-0">
                                        <img src={img.url} alt={img.prompt} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3"><p className="text-xs text-white/90 line-clamp-2 text-left">{img.prompt}</p><div className="flex items-center gap-2 mt-1 text-[10px] text-white/50"><Clock className="w-3 h-3" /><span>{new Date(img.timestamp).toLocaleDateString()}</span></div></div>
                                    </button>
                                ))}</div>}
                        </div>
                    </div>
                </div>
            )}

            {showGalleryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowGalleryModal(false)}>
                    <div className="bg-[#1A1625] border border-white/10 rounded-2xl p-0 max-w-3xl w-[90vw] h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/5">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Cloud className="w-5 h-5 text-purple-400" />{t.gallery_modal_title}</h3>
                            <button onClick={() => setShowGalleryModal(false)} className="text-white/40 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-[#0D0B14]">
                            {galleryLoading ? <div className="flex flex-col items-center justify-center h-full text-white/30 space-y-4"><Loader2 className="w-10 h-10 animate-spin" /></div> : galleryFiles.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-white/30 space-y-4"><CloudUpload className="w-12 h-12 opacity-50" /><p>{t.no_gallery_images}</p></div> : 
                                <>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{galleryFiles.slice(0, galleryLimit).map((file) => (
                                    <button key={file.key} onClick={() => { setIsSourceNSFW(file.key.includes('.NSFW')); loadEditorImage(galleryLocalUrls[file.key] || file.url); setShowGalleryModal(false); }} className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-purple-500 transition-all hover:ring-4 hover:ring-purple-500/20 focus:outline-0 bg-white/5">
                                        <img src={galleryLocalUrls[file.key] || file.url} alt={file.key} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                                    </button>
                                ))}</div>
                                {galleryLimit < galleryFiles.length && <div className="mt-6 flex justify-center"><button onClick={() => setGalleryLimit(prev => prev + 20)} className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white/80 rounded-lg text-sm font-medium transition-colors">{t.load_more}</button></div>}
                                </>}
                        </div>
                    </div>
                </div>
            )}

            {showShortcuts && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowShortcuts(false)}>
                    <div className="bg-[#1A1625] border border-white/10 rounded-2xl p-4 max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Keyboard className="w-5 h-5 text-purple-400" />{t.shortcuts_title}</h3>
                            <button onClick={() => setShowShortcuts(false)} className="text-white/40 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                            <ShortcutRow label={t.sc_send} keys={['Shift', 'Enter']} />
                            <ShortcutRow label={t.sc_zoom_in} keys={['+']} />
                            
                            <ShortcutRow label={t.sc_zoom_out} keys={['-']} />
                            <ShortcutRow label={t.sc_reset_view} keys={[MOD_KEY, '0']} />
                            
                            <ShortcutRow label={t.sc_move} keys={['M', t.or_conjunction.trim(), '0']} />
                            <ShortcutRow label={t.sc_draw} keys={['D', t.or_conjunction.trim(), '1']} />
                            
                            <ShortcutRow label={t.sc_rect} keys={['R', t.or_conjunction.trim(), '2']} />
                            <ShortcutRow label={t.sc_eraser} keys={['E', t.or_conjunction.trim(), '3']} />
                            
                            <ShortcutRow label={t.sc_undo} keys={[MOD_KEY, 'Z']} />
                            <ShortcutRow label={t.sc_redo} keys={[MOD_KEY, 'Shift', 'Z']} />
                            
                            <ShortcutRow label={t.sc_color} keys={['C', t.or_conjunction.trim(), '5']} />
                            <ShortcutRow label={t.sc_exit} keys={['ESC']} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
