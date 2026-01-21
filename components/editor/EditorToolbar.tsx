
import React from 'react';
import { Hand, Brush, Eraser, Square, Undo2, LogOut } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { useEditorStore } from '../../store/editorStore';
import { useAppStore } from '../../store/appStore';
import { translations } from '../../translations';

interface EditorToolbarProps {
    onUndo: () => void;
    canUndo: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ onUndo, canUndo }) => {
    const { activeTool, setActiveTool, brushColor, setBrushColor, setShowExitDialog } = useEditorStore();
    const { language } = useAppStore();
    const t = translations[language];

    const drawingTools = [
        { id: 'brush', icon: Brush, label: t.tool_brush },
        { id: 'rect', icon: Square, label: t.tool_rect },
        { id: 'eraser', icon: Eraser, label: t.tool_eraser },
    ];

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-0.5 p-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-30 max-w-[95vw]">
            <Tooltip content={activeTool === 'move' ? t.tool_select : t.tool_move} position="bottom">
                <button
                    onClick={() => setActiveTool(activeTool === 'move' ? 'select' : 'move')}
                    className={`p-2 rounded-xl transition-all ${
                        activeTool === 'move' 
                        ? 'bg-purple-600 text-white shadow-lg' 
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                >
                    <Hand className="w-5 h-5" />
                </button>
            </Tooltip>

            <div className="w-px h-5 bg-white/10 mx-1" />

            {drawingTools.map((tool) => {
                const Icon = tool.icon;
                return (
                    <Tooltip key={tool.id} content={tool.label} position="bottom">
                        <button
                            onClick={() => setActiveTool(tool.id as any)}
                            className={`p-2 rounded-xl transition-all ${
                                activeTool === tool.id 
                                ? 'bg-purple-600 text-white shadow-lg' 
                                : 'text-white/60 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <Icon className="w-5 h-5" />
                        </button>
                    </Tooltip>
                );
            })}
            
            <div className="w-px h-5 bg-white/10 mx-1" />
            
            <Tooltip content={t.tool_undo} position="bottom">
                <button 
                    onClick={onUndo} 
                    disabled={!canUndo}
                    className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed group"
                >
                    <Undo2 className="w-5 h-5" />
                </button>
            </Tooltip>

            <Tooltip content={t.tool_color} position="bottom">
                <label className="cursor-pointer block relative">
                    <input 
                        id="editor-color-picker"
                        type="color" 
                        value={brushColor} 
                        onChange={(e) => setBrushColor(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <div 
                            className="w-5 h-5 rounded-full border-2 border-white/20 shadow-sm" 
                            style={{ backgroundColor: brushColor }}
                        ></div>
                    </div>
                </label>
            </Tooltip>

            <div className="w-px h-5 bg-white/10 mx-1" />
            
            <Tooltip content={t.tool_exit} position="bottom">
                    <button 
                    onClick={() => setShowExitDialog(true)}
                    className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </Tooltip>
        </div>
    );
};
