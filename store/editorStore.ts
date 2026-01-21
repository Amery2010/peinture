
import { create } from 'zustand';

export type ToolType = 'select' | 'move' | 'brush' | 'eraser' | 'rect';

interface EditorState {
    // Tool State
    activeTool: ToolType;
    brushColor: string;
    setActiveTool: (tool: ToolType) => void;
    setBrushColor: (color: string) => void;

    // Viewport State
    scale: number;
    offset: { x: number; y: number };
    setScale: (scale: number | ((prev: number) => number)) => void;
    setOffset: (offset: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
    resetView: () => void;

    // Generation State
    prompt: string;
    attachedImages: string[];
    setPrompt: (prompt: string) => void;
    addAttachedImage: (img: string) => void;
    removeAttachedImage: (index: number) => void;
    setAttachedImages: (images: string[]) => void;

    // UI Toggles
    showShortcuts: boolean;
    setShowShortcuts: (show: boolean) => void;
    showHistoryModal: boolean;
    setShowHistoryModal: (show: boolean) => void;
    showGalleryModal: boolean;
    setShowGalleryModal: (show: boolean) => void;
    showExitDialog: boolean;
    setShowExitDialog: (show: boolean) => void;

    // Actions
    resetEditor: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
    // Tool State
    activeTool: 'move',
    brushColor: '#60A5FA', // Default blue-400
    setActiveTool: (activeTool) => set({ activeTool }),
    setBrushColor: (brushColor) => set({ brushColor }),

    // Viewport State
    scale: 1,
    offset: { x: 0, y: 0 },
    setScale: (scale) => set((state) => ({ scale: typeof scale === 'function' ? scale(state.scale) : scale })),
    setOffset: (offset) => set((state) => ({ offset: typeof offset === 'function' ? offset(state.offset) : offset })),
    resetView: () => set({ scale: 1, offset: { x: 0, y: 0 } }),

    // Generation State
    prompt: '',
    attachedImages: [],
    setPrompt: (prompt) => set({ prompt }),
    addAttachedImage: (img) => set((state) => ({ attachedImages: [...state.attachedImages, img] })),
    removeAttachedImage: (index) => set((state) => ({ attachedImages: state.attachedImages.filter((_, i) => i !== index) })),
    setAttachedImages: (attachedImages) => set({ attachedImages }),

    // UI Toggles
    showShortcuts: false,
    setShowShortcuts: (showShortcuts) => set({ showShortcuts }),
    showHistoryModal: false,
    setShowHistoryModal: (showHistoryModal) => set({ showHistoryModal }),
    showGalleryModal: false,
    setShowGalleryModal: (showGalleryModal) => set({ showGalleryModal }),
    showExitDialog: false,
    setShowExitDialog: (showExitDialog) => set({ showExitDialog }),

    resetEditor: () => set({
        activeTool: 'move',
        scale: 1,
        offset: { x: 0, y: 0 },
        prompt: '',
        attachedImages: [],
        showExitDialog: false
    })
}));
