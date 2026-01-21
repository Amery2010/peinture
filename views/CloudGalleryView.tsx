
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { CloudFile } from '../types';
import { CloudUpload, Image as ImageIcon, Loader2, Download, Trash2, Copy, Eye, EyeOff, X, Check, Settings } from 'lucide-react';
import { isStorageConfigured, listCloudFiles, deleteCloudFile, getStorageType, fetchCloudBlob, renameCloudFile, getFileId, getS3Config } from '../services/storageService';
import { downloadImage } from '../services/utils';
import { Tooltip } from '../components/Tooltip';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';

interface CloudGalleryViewProps {
    handleUploadToS3: (blob: Blob, fileName: string, metadata?: any) => Promise<void>;
    onOpenSettings: () => void;
}

export const CloudGalleryView: React.FC<CloudGalleryViewProps> = ({ handleUploadToS3, onOpenSettings }) => {
    const { language } = useAppStore();
    const t = translations[language];

    const [files, setFiles] = useState<CloudFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [togglingNsfwId, setTogglingNsfwId] = useState<string | null>(null);
    const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
    const [copyingPromptId, setCopyingPromptId] = useState<string | null>(null);
    const [copyPromptErrorId, setCopyPromptErrorId] = useState<string | null>(null);
    const [fileToDelete, setFileToDelete] = useState<CloudFile | null>(null);
    const [isConfigured, setIsConfigured] = useState(false);
    const [localUrls, setLocalUrls] = useState<Record<string, string>>({});
    
    // Fullscreen View
    const [fullscreenImage, setFullscreenImage] = useState<CloudFile | null>(null);
    
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
        const sorted = cloudFiles.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
        
        setFiles(sorted);
        setLoading(false);
    };

    useEffect(() => {
        loadFiles();
        
        // Listen to storage changes to reload
        const handleStorageChange = () => loadFiles();
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Sequential Loading Effect for WebDAV, Private S3, or OPFS
    useEffect(() => {
        const type = getStorageType();
        const isS3Private = type === 's3' && !getS3Config().publicDomain;
        const isWebDAV = type === 'webdav';
        const isOPFS = type === 'opfs';
        
        if (!isWebDAV && !isS3Private && !isOPFS) return;
        
        let isCancelled = false;

        const loadImagesSequentially = async () => {
            for (const file of files) {
                if (isCancelled) break;
                // If we already have a local URL for this file (and it's valid), skip
                if (localUrls[file.key]) continue;

                // Fetch blob and create ObjectURL (handles signed S3 requests and OPFS via fetchCloudBlob)
                try {
                    const blob = await fetchCloudBlob(file.url as string);
                    if (!isCancelled) {
                        const url = URL.createObjectURL(blob);
                        setLocalUrls(prev => ({ ...prev, [file.key]: url }));
                    }
                } catch {
                    // Outputting system error messages is prohibited.
                    console.error(`Failed to load cloud image: ${file.key}`);
                }
            }
        };

        if (files.length > 0) {
            loadImagesSequentially();
        }

        return () => { isCancelled = true; };
    }, [files]);

    // Cleanup ObjectURLs on unmount
    useEffect(() => {
        return () => {
            Object.values(localUrls).forEach(url => URL.revokeObjectURL(url));
        };
    }, []);

    // Infinite Scroll Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting) {
                    setDisplayLimit(prev => Math.min(prev + 30, files.length));
                }
            },
            { threshold: 0.1, rootMargin: '200px' }
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
                // Check if the original file is marked as NSFW
                const isNSFW = file.name.toUpperCase().includes('.NSFW');
                const ext = file.name.split('.').pop();
                const id = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
                
                // If local file has NSFW, append .NSFW to the new filename
                const fileName = isNSFW ? `${id}.NSFW.${ext}` : `${id}.${ext}`;

                // 3. Prepare Metadata
                const metadata = {
                    id,
                    width,
                    height,
                    timestamp: Date.now()
                };

                // 4. Upload
                await handleUploadToS3(file, fileName, metadata);
                
                setTimeout(loadFiles, 1000);
            } catch (err: any) {
                // Outputting system error messages is prohibited.
                console.error(t.upload_failed);
            } finally {
                setUploading(false);
                e.target.value = '';
            }
        }
    };

    const handleDeleteClick = (file: CloudFile) => {
        setFileToDelete(file);
    };

    const confirmDelete = async () => {
        if (!fileToDelete) return;
        
        const fileKey = fileToDelete.key;
        setFileToDelete(null);
        setDeletingId(fileKey);

        try {
            await deleteCloudFile(fileKey);
            // Remove from local state
            setFiles(prev => prev.filter(f => f.key !== fileKey));
            setLocalUrls(prev => {
                const next = { ...prev };
                if (next[fileKey]) {
                    URL.revokeObjectURL(next[fileKey]);
                    delete next[fileKey];
                }
                return next;
            });
        } catch (error: any) {
            // Outputting system error messages is prohibited.
            console.error("Delete failed");
        } finally {
            setDeletingId(null);
        }
    };

    const handleDownload = async (file: CloudFile) => {
        const fileName = file.key.split('/').pop() || 'download';
        const urlToUse = localUrls[file.key] || file.url;
        
        try {
            // Check if we need to fetch blob first (if urlToUse is remote and likely private/CORS protected)
            // Or if it's already an Object URL (blob:...)
            let downloadUrl = urlToUse;
            
            // If it is NOT a local blob url, and it IS a private S3/WebDAV/OPFS link
            // we should have already loaded it into `localUrls`.
            // If `localUrls` is missing (e.g. infinite scroll not reached yet or failed), `urlToUse` is `file.url`.
            
            // Special Case: Private Storage Download via unified `downloadImage`.
            const type = getStorageType();
            if (!downloadUrl.startsWith('blob:') && (type === 'webdav' || type === 'opfs' || (type === 's3' && !getS3Config().publicDomain))) {
                 const blob = await fetchCloudBlob(downloadUrl);
                 downloadUrl = window.URL.createObjectURL(blob);
                 // We will let `downloadImage` handle the download, and then revoke.
                 await downloadImage(downloadUrl, fileName);
                 setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
            } else {
                 // Public URL or already Blob URL
                 await downloadImage(downloadUrl, fileName);
            }

        } catch (e: any) {
            // Outputting system error messages is prohibited.
            console.error("Download failed, opening in new tab");
            window.open(urlToUse, '_blank');
        }
    };

    const handleCopyPrompt = async (file: CloudFile) => {
        if (copyingPromptId || copyPromptErrorId === file.key) return;

        // Construct metadata URL: [id].metadata.json
        // Ignore .NSFW part for ID
        const id = getFileId(file.key);
        // We assume the metadata file is in the same directory/path as the image, 
        // so we can reconstruct the URL by replacing the filename part of the image URL.
        const baseUrl = file.url.substring(0, file.url.lastIndexOf('/') + 1);
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
                console.warn("No prompt found in metadata");
                setCopyPromptErrorId(file.key);
            }
        } catch (e: any) {
            // Outputting system error messages is prohibited.
            console.error("Failed to fetch/parse metadata for prompt copy");
            setCopyPromptErrorId(file.key);
        } finally {
            setCopyingPromptId(null);
        }
    };

    const handleToggleNSFW = async (file: CloudFile) => {
        if (togglingNsfwId) return;
        setTogglingNsfwId(file.key);

        const isNSFW = file.key.includes('.NSFW.');
        const originalExtension = file.key.split('.').pop();
        
        let newKey = '';
        if (isNSFW) {
            // Remove .NSFW
            // Replace `.NSFW.ext` with `.ext`
            newKey = file.key.replace(`.NSFW.${originalExtension}`, `.${originalExtension}`);
        } else {
            // Add .NSFW
            newKey = file.key.replace(`.${originalExtension}`, `.NSFW.${originalExtension}`);
        }

        try {
            const type = getStorageType();
            
            if (type === 's3') {
                // S3 Specific Logic: Download Blob -> Upload New -> Delete Old
                // IMPORTANT: Pass NO metadata to handleUploadToS3 to prevent overwriting existing metadata with wrong name or generic data.
                // The metadata file should remain [id].metadata.json regardless of image rename.
                
                const urlToFetch = localUrls[file.key] || file.url;
                
                const blob = await fetchCloudBlob(urlToFetch);
                
                // Upload with new name, NO metadata
                await handleUploadToS3(blob, newKey); 
                
                // Delete old file
                await deleteCloudFile(file.key);

            } else {
                // WebDAV and OPFS support rename
                await renameCloudFile(file.key, newKey);
            }
            
            // Update Local State
            setFiles(prev => prev.map(f => {
                if (f.key === file.key) {
                    // Update key and URL (rough url update for display)
                    const newUrl = f.url.replace(file.key, newKey);
                    return { ...f, key: newKey, url: newUrl };
                }
                return f;
            }));
            
            // Update local URLs cache key
            setLocalUrls(prev => {
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

    const visibleFiles = useMemo(() => files.slice(0, displayLimit), [files, displayLimit]);
    
    // Use proxy loading if WebDAV OR OPFS OR S3 (private)
    const type = getStorageType();
    const useProxyLoading = type === 'webdav' || type === 'opfs' || (type === 's3' && !getS3Config().publicDomain);

    return (
        <div className="w-full h-full flex flex-col p-4">
             
             {/* Header */}
             <div className="flex flex-row items-center justify-between mb-4 gap-4">
                <div className="min-w-0 flex-1 mr-4">
                    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight truncate">{t.gallery_title}</h2>
                    <p className="text-white/60 mt-1 text-xs md:text-base truncate">{t.gallery_subtitle}</p>
                </div>
                
                <div className="flex-shrink-0">
                    {/* Upload Button handles both file selection and configuration trigger */}
                    {isConfigured ? (
                        <label className={`
                            flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-2.5 
                            rounded-full font-bold text-white cursor-pointer shadow-lg
                            bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500
                            hover:opacity-90 active:scale-95 transition-all text-sm md:text-base
                            ${uploading ? 'opacity-70 cursor-not-allowed' : ''}
                        `}>
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
                            <span className="hidden md:inline">{uploading ? t.uploading : t.upload_media}</span>
                            <span className="md:hidden">{uploading ? '' : t.upload}</span>
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
                         <h3 className="text-xl font-medium text-white/60">{t.gallery_setup_title || "Configure Cloud Gallery"}</h3>
                         <p className="text-sm text-white/40 leading-relaxed">{t.gallery_setup_desc || "Connect your S3 or WebDAV storage to view your generated creations anywhere."}</p>
                     </div>
                 </div>
             ) : loading ? (
                 <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                     <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                 </div>
             ) : files.length === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-white/30 space-y-4 min-h-[50vh]">
                     <ImageIcon className="w-16 h-16 opacity-30" />
                     <h3 className="text-xl font-medium text-white/50">{t.cloud_gallery_empty}</h3>
                     <p className="text-sm">{t.cloud_gallery_desc}</p>
                 </div>
             ) : (
                 <div className="w-full">
                     {/* Masonry Layout using CSS columns */}
                     <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-2">
                         {visibleFiles.map((file) => {
                             const displayUrl = (useProxyLoading && localUrls[file.key]) ? localUrls[file.key] : (!useProxyLoading ? file.url : '');
                             const isNSFW = file.key.includes('.NSFW.');
                             
                             return (
                                 <div 
                                     key={file.key} 
                                     className="break-inside-avoid mb-4 group relative overflow-hidden bg-white/[0.02] hover:shadow-purple-500/10 transition-all duration-300"
                                 >
                                     <div 
                                        className="relative min-h-[150px] bg-white/5 flex items-center justify-center cursor-zoom-in"
                                        onClick={() => setFullscreenImage(file)}
                                     >
                                         {displayUrl ? (
                                             file.type === 'video' ? (
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
                                                     className={`w-full h-auto object-cover block transition-all duration-500 ${isNSFW ? 'blur-xl scale-110' : ''}`}
                                                     loading="lazy"
                                                 />
                                             )
                                         ) : (
                                             <div className="flex items-center justify-center w-full h-40">
                                                 <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
                                             </div>
                                         )}
                                         
                                         {/* Dark overlay on hover */}
                                         <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />

                                         {/* Bottom Toolbar Overlay */}
                                         <div className="absolute bottom-0 left-0 right-0 p-1.5 flex items-end justify-between opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none">
                                             
                                             {/* Left: Time & Size - HIDDEN on mobile */}
                                             <div className="hidden md:flex flex-col gap-0.5 text-white/90 drop-shadow-md">
                                                 <span className="text-xs font-medium">{file.lastModified.toLocaleDateString()}</span>
                                                 <span className="text-[10px] text-white/70">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                                             </div>

                                             {/* Right: Actions - Pointer events enabled */}
                                             <div className="flex items-center ml-auto pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                                                 
                                                 {/* NSFW Toggle */}
                                                 <Tooltip content={isNSFW ? t.unmark_nsfw : t.mark_nsfw} position="top">
                                                     <button 
                                                         onClick={(e) => { e.stopPropagation(); handleToggleNSFW(file); }}
                                                         className={`p-2 hover:text-white hover:bg-white/10 rounded-full transition-all ${isNSFW ? 'text-purple-400' : 'text-white/80'}`}
                                                     >
                                                         {togglingNsfwId === file.key ? <Loader2 className="w-4 h-4 animate-spin" /> : (isNSFW ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />)}
                                                     </button>
                                                 </Tooltip>

                                                 {/* Copy Prompt */}
                                                 <Tooltip content={copiedPromptId === file.key ? t.copied : t.copy_prompt} position="top">
                                                     <button 
                                                         onClick={(e) => { e.stopPropagation(); handleCopyPrompt(file); }}
                                                         className={`p-2 hover:text-white hover:bg-white/10 rounded-full transition-all ${copyPromptErrorId === file.key ? 'text-white/30 cursor-not-allowed' : 'text-white/80'}`}
                                                         disabled={copyingPromptId === file.key || copyPromptErrorId === file.key}
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

                                                 {/* Download */}
                                                 <Tooltip content={t.download} position="top">
                                                     <button 
                                                         onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                                                         className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
                                                     >
                                                         <Download className="w-4 h-4" />
                                                 </button>
                                             </Tooltip>

                                             {/* Delete */}
                                             <Tooltip content={t.delete} position="top">
                                                 <button 
                                                     onClick={(e) => { e.stopPropagation(); handleDeleteClick(file); }}
                                                     className="p-2 text-white/80 hover:text-red-400 hover:bg-white/10 rounded-full transition-all"
                                                 >
                                                     {deletingId === file.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                 </button>
                                             </Tooltip>
                                         </div>
                                     </div>
                                 </div>
                             </div>
                         )})}
                     </div>
                     
                     {/* Infinite Scroll Trigger */}
                     <div ref={observerTarget} className="h-20 w-full flex items-center justify-center mt-4">
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
                <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-in fade-in duration-200">
                    <button 
                        onClick={() => setFullscreenImage(null)}
                        className="absolute top-4 right-4 z-[110] p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
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
                                contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                                {fullscreenImage.type === 'video' ? (
                                    <video 
                                        src={(useProxyLoading && localUrls[fullscreenImage.key]) ? localUrls[fullscreenImage.key] : (!useProxyLoading ? fullscreenImage.url : '')} 
                                        className="max-w-full max-h-full object-contain"
                                        controls
                                        autoPlay
                                    />
                                ) : (
                                    <img
                                        src={(useProxyLoading && localUrls[fullscreenImage.key]) ? localUrls[fullscreenImage.key] : (!useProxyLoading ? fullscreenImage.url : '')} 
                                        alt={fullscreenImage.key}
                                        className="max-w-full max-h-full object-contain"
                                    />
                                )}
                            </TransformComponent>
                        </TransformWrapper>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {fileToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1A1625] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-white mb-2">{t.delete}</h3>
                        <p className="text-white/60 text-sm mb-6">{t.delete_confirm}</p>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setFileToDelete(null)}
                                className="px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                            >
                                {t.cancel}
                            </button>
                            <button 
                                onClick={confirmDelete}
                                className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors text-sm font-medium"
                            >
                                {t.confirm}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
