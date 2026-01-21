
import { useRef, useState, useCallback, useEffect } from 'react';
import { useEditorStore, ToolType } from '../store/editorStore';

export const useEditorCanvas = (containerRef: React.RefObject<HTMLDivElement>) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const snapshotRef = useRef<ImageData | null>(null);
    const lastTouchDistance = useRef<number | null>(null);
    
    // Store
    const { 
        activeTool, brushColor, scale, offset, 
        setScale, setOffset, setActiveTool 
    } = useEditorStore();

    // Local State
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [historyStates, setHistoryStates] = useState<ImageData[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isDragging, setIsDragging] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });
    const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });

    // History Logic
    const saveToHistory = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
        const imageData = ctx.getImageData(0, 0, width, height);
        const newHistory = historyStates.slice(0, historyIndex + 1);
        newHistory.push(imageData);
        if (newHistory.length > 20) {
            newHistory.shift();
        } else {
            setHistoryIndex(newHistory.length - 1);
        }
        setHistoryStates(newHistory);
    }, [historyStates, historyIndex]);

    const undo = useCallback(() => {
        if (historyIndex > 0 && canvasRef.current) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) ctx.putImageData(historyStates[newIndex], 0, 0);
        }
    }, [historyStates, historyIndex]);

    const redo = useCallback(() => {
        if (historyIndex < historyStates.length - 1 && canvasRef.current) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) ctx.putImageData(historyStates[newIndex], 0, 0);
        }
    }, [historyStates, historyIndex]);

    const initCanvas = useCallback((img: HTMLImageElement) => {
        // Set the image state first to ensure it's available
        setImage(img);

        if (canvasRef.current && containerRef.current) {
            canvasRef.current.width = img.width;
            canvasRef.current.height = img.height;
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, img.width, img.height);
                // Try catch for CORS tainted images
                try {
                    const initialData = ctx.getImageData(0, 0, img.width, img.height);
                    setHistoryStates([initialData]);
                    setHistoryIndex(0);
                } catch (e) {
                    setHistoryStates([]);
                    setHistoryIndex(-1);
                }
            }
            
            // Auto Fit
            const { width: contW, height: contH } = containerRef.current.getBoundingClientRect();
            const scaleH = contH / img.height;
            const scaleW = contW / img.width;
            const newScale = Math.min(scaleH, scaleW, 1);
            
            setScale(newScale);
            setOffset({
                x: (contW - img.width * newScale) / 2,
                y: (contH - img.height * newScale) / 2
            });
        }
    }, [containerRef, setScale, setOffset]);

    // Draw Helpers
    const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        return {
            x: (clientX - rect.left) * (canvasRef.current.width / rect.width),
            y: (clientY - rect.top) * (canvasRef.current.height / rect.height)
        };
    };

    const getDynamicLineWidth = (baseSize: number) => baseSize / scale;

    // Event Handlers
    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        const coords = getCanvasCoordinates(e);

        if (activeTool === 'move') {
            setIsDragging(true);
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
            setLastPosition({ x: clientX, y: clientY });
        } else if (['brush', 'eraser', 'rect'].includes(activeTool)) {
            setIsDrawing(true);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (activeTool === 'brush') {
                ctx.globalCompositeOperation = 'source-over';
                ctx.lineWidth = getDynamicLineWidth(2);
                ctx.strokeStyle = brushColor;
                ctx.beginPath();
                ctx.moveTo(coords.x, coords.y);
            } else if (activeTool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = getDynamicLineWidth(16);
                ctx.beginPath();
                ctx.moveTo(coords.x, coords.y);
            } else if (activeTool === 'rect') {
                ctx.globalCompositeOperation = 'source-over';
                ctx.lineWidth = getDynamicLineWidth(2);
                ctx.strokeStyle = brushColor;
                setStartPosition(coords);
                snapshotRef.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!canvasRef.current) return;
        
        if (isDragging && activeTool === 'move') {
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
            const dx = clientX - lastPosition.x;
            const dy = clientY - lastPosition.y;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setLastPosition({ x: clientX, y: clientY });
        } else if (isDrawing) {
            const ctx = canvasRef.current.getContext('2d');
            if (!ctx) return;
            const coords = getCanvasCoordinates(e);
            
            if (['brush', 'eraser'].includes(activeTool)) {
                ctx.lineTo(coords.x, coords.y);
                ctx.stroke();
            } else if (activeTool === 'rect' && snapshotRef.current) {
                ctx.putImageData(snapshotRef.current, 0, 0);
                const width = coords.x - startPosition.x;
                const height = coords.y - startPosition.y;
                ctx.strokeRect(startPosition.x, startPosition.y, width, height);
            }
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        lastTouchDistance.current = null;
        if (isDrawing) {
            setIsDrawing(false);
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx && canvasRef.current) {
                if (['brush', 'eraser'].includes(activeTool)) ctx.closePath();
                ctx.globalCompositeOperation = 'source-over';
                saveToHistory(ctx, canvasRef.current.width, canvasRef.current.height);
                snapshotRef.current = null;
            }
        }
    };

    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const delta = e.deltaY > 0 ? 0.95 : 1.05;
        const newScale = Math.min(Math.max(0.1, scale * delta), 10);
        const newOffsetX = cx - (cx - offset.x) * (newScale / scale);
        const newOffsetY = cy - (cy - offset.y) * (newScale / scale);
        setScale(newScale);
        setOffset({ x: newOffsetX, y: newOffsetY });
    }, [scale, offset, containerRef, setScale, setOffset]);

    // Zoom Helpers
    const zoomIn = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const newScale = Math.min(scale * 1.1, 10);
        
        const newOffsetX = cx - (cx - offset.x) * (newScale / scale);
        const newOffsetY = cy - (cy - offset.y) * (newScale / scale);
        
        setScale(newScale);
        setOffset({ x: newOffsetX, y: newOffsetY });
    };

    const zoomOut = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const newScale = Math.max(scale * 0.9, 0.1);
        
        const newOffsetX = cx - (cx - offset.x) * (newScale / scale);
        const newOffsetY = cy - (cy - offset.y) * (newScale / scale);
        
        setScale(newScale);
        setOffset({ x: newOffsetX, y: newOffsetY });
    };

    const zoomReset = () => {
        if (image) initCanvas(image);
        else {
            setScale(1);
            setOffset({ x: 0, y: 0 });
        }
    };
    const centerView = () => {
        if (image && containerRef.current) {
            const { width: contW, height: contH } = containerRef.current.getBoundingClientRect();
            setOffset({
                x: (contW - image.width * scale) / 2,
                y: (contH - image.height * scale) / 2
            });
        }
    }

    const resetCanvas = () => {
        setImage(null);
        setHistoryStates([]);
        setHistoryIndex(-1);
    };

    // Attach passive: false wheel listener
    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('wheel', handleWheel, { passive: false });
        }
        return () => {
            if (container) {
                container.removeEventListener('wheel', handleWheel);
            }
        };
    }, [handleWheel, containerRef]);

    return {
        canvasRef,
        image,
        setImage,
        historyIndex,
        historyStates,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        initCanvas,
        resetCanvas,
        undo,
        redo,
        zoomIn,
        zoomOut,
        zoomReset,
        centerView,
        activeTool, // Re-export for convenience if needed by component logic
        activeScale: scale,
        activeOffset: offset
    };
};
