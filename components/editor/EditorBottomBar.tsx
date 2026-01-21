
import React from 'react';
import { X, ImagePlus, Loader2, Sparkles, LoaderCircle, Square, ArrowRight } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { useEditorStore } from '../../store/editorStore';
import { useAppStore } from '../../store/appStore';
import { translations } from '../../translations';

interface EditorBottomBarProps {
    isGenerating: boolean;
    isOptimizing: boolean;
    onGenerate: () => void;
    onOptimize: () => void;
    imageLoaded: boolean;
}

export const EditorBottomBar: React.FC<EditorBottomBarProps> = ({ 
    isGenerating, 
    isOptimizing, 
    onGenerate, 
    onOptimize,
    imageLoaded
}) => {
    const { prompt, setPrompt, attachedImages, removeAttachedImage, addAttachedImage } = useEditorStore();
    const { language } = useAppStore();
    const t = translations[language];

    const handleRefImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            if (attachedImages.length >= 3) return;
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    addAttachedImage(event.target!.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-30 select-none">
            <div className="relative flex items-center h-14 pl-2 pr-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl shadow-black/40 ring-1 ring-white/5">
                
                <div className="flex items-center mr-2">
                        {attachedImages.map((img, idx) => (
                        <Tooltip key={idx} content={t.ref_image_n.replace('{n}', (idx + 1).toString())}>
                            <div 
                                className={`relative w-8 h-8 rounded-full overflow-hidden border border-purple-500/50 group flex-shrink-0 bg-[#0D0B14] ${idx > 0 ? '-ml-3' : ''}`} 
                                style={{ zIndex: 10 + idx }}
                            >
                                <div className="w-full h-full relative">
                                    <img src={img} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                                    <button 
                                        onClick={() => removeAttachedImage(idx)}
                                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3 text-white" />
                                    </button>
                                </div>
                            </div>
                        </Tooltip>
                        ))}
                        
                        {attachedImages.length < 3 && (
                        <div className={`relative flex-shrink-0 ${attachedImages.length > 0 ? 'ml-2' : ''}`} style={{ zIndex: 20 }}>
                            <input 
                                type="file" 
                                id="cmd-image-upload" 
                                accept=".jpg,.jpeg,.png,.webp" 
                                className="hidden" 
                                onChange={handleRefImageSelect}
                            />
                            <Tooltip content={t.upload_ref_image}>
                                <label 
                                    htmlFor="cmd-image-upload"
                                    className="flex items-center justify-center w-8 h-8 rounded-full cursor-pointer transition-all hover:bg-white/10 text-white/50 border border-white/5 hover:border-white/20 hover:text-white"
                                >
                                    <ImagePlus className="w-4 h-4" />
                                </label>
                            </Tooltip>
                        </div>
                        )}
                </div>

                <Tooltip content={t.optimize}>
                    <button 
                        onClick={onOptimize}
                        disabled={isOptimizing || !prompt.trim()}
                        className="flex items-center justify-center w-8 h-full text-purple-500/80 hover:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed mr-1 active:scale-90 transition-transform"
                    >
                        {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    </button>
                </Tooltip>

                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            onGenerate();
                        }
                    }}
                    placeholder={t.editor_placeholder}
                    disabled={isGenerating}
                    className="flex-1 bg-transparent border-0 text-white placeholder:text-white/30 focus:ring-0 h-full text-sm font-medium px-0 min-w-0 disabled:opacity-50"
                />

                <button 
                    onClick={onGenerate}
                    disabled={!imageLoaded || !prompt.trim()}
                    className={`
                        flex items-center justify-center gap-1.5 transition-all duration-500 ease-in-out
                        font-bold shadow-lg active:scale-95 ml-2
                        disabled:grayscale disabled:opacity-50
                        ${isGenerating 
                            ? 'w-11 h-11 rounded-full p-0 flex-shrink-0 bg-white/60 hover:bg-white/80 text-white shadow-white/20 cursor-pointer' 
                            : 'px-4 py-2 rounded-full flex-shrink-0 generate-button-gradient text-white shadow-purple-900/20'
                        }
                    `}
                >
                    {isGenerating ? (
                        <div className="relative">
                            <LoaderCircle className="w-8 h-8 animate-spin" />
                            <Square className="absolute top-1/2 left-1/2 -mt-1.5 -ml-1.5 w-3 h-3 fill-current" />
                        </div>
                    ) : (
                        <>
                            <span className="whitespace-nowrap text-sm">{t.editor_generate}</span>
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
