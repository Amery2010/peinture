import React, { useRef, useState, useEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { ImageComparison } from "./ImageComparison";
import { Paintbrush, Sparkles, Film, Image as ImageIcon } from "lucide-react";
import { GeneratedImage } from "../types";
import { useSettingsStore } from "../store/settingsStore";
import { useUIStore } from "../store/uiStore";
import { translations } from "../translations";

interface PreviewStageProps {
  currentImage: GeneratedImage | null;
  isWorking: boolean;
  isTranslating: boolean;
  isComparing: boolean;
  tempUpscaledImage: string | null;
  showInfo: boolean;
  setShowInfo: (val: boolean) => void;
  imageDimensions: { width: number; height: number } | null;
  setImageDimensions: (val: { width: number; height: number } | null) => void;
  children?: React.ReactNode;
  // New Props for Live
  isLiveMode?: boolean;
  onToggleLiveMode?: () => void;
  isGeneratingVideoPrompt?: boolean;
}

const TimerDisplay = () => {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, []);
  return (
    <p className="mt-2 font-mono text-purple-300 text-lg">
      {elapsed.toFixed(1)}s
    </p>
  );
};

export const PreviewStage: React.FC<PreviewStageProps> = ({
  currentImage,
  isWorking,
  isTranslating,
  isComparing,
  tempUpscaledImage,
  setImageDimensions,
  children,
  isLiveMode,
  onToggleLiveMode,
  isGeneratingVideoPrompt,
}) => {
  const { language } = useSettingsStore();
  const t = translations[language];
  const videoRef = useRef<HTMLVideoElement>(null);
  const isOpfsHydrated = useUIStore((s) => s.isOpfsHydrated);

  // -- Animation Logic State --
  // We buffer the image to display so we can animate the old one fading out
  // before swapping to the new one.
  const [displayImage, setDisplayImage] = useState<GeneratedImage | null>(
    currentImage,
  );
  const isTransitioningRef = useRef(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // If the ID changes (different image selected)
    if (currentImage?.id !== displayImage?.id) {
      if (!displayImage) {
        // Initial load or first generation: no fade out needed
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDisplayImage(currentImage);
      } else {
        // 1. Start Fade Out
        if (!isTransitioningRef.current) {
          isTransitioningRef.current = true;
          setIsTransitioning(true);
        }

        const timer = setTimeout(() => {
          // 2. Swap Data after fade out completes
          setDisplayImage(currentImage);
          // Fade in on next frame
          requestAnimationFrame(() => {
            isTransitioningRef.current = false;
            setIsTransitioning(false);
          });
        }, 300);

        return () => clearTimeout(timer);
      }
    } else {
      // IDs match — immediate update for same-image property changes
      // (e.g., upscale status, blur toggle, video generation)
      if (currentImage !== displayImage) {
        setDisplayImage(currentImage);
      }
    }
  }, [currentImage, displayImage]);

  const isLiveGenerating = displayImage?.videoStatus === "generating";

  return (
    <section className="relative w-full flex flex-col h-[360px] md:h-[480px] items-center justify-center bg-black/20 rounded-xl backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/20 overflow-hidden group">
      {isWorking ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/40 backdrop-blur-sm animate-in fade-in duration-500">
          <div className="relative">
            <div className="h-24 w-24 rounded-full border-4 border-white/10 border-t-purple-500 animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Paintbrush className="text-purple-400 animate-pulse w-8 h-8" />
            </div>
          </div>
          <p className="mt-8 text-white/80 font-medium animate-pulse text-lg">
            {isTranslating ? t.translating : t.dreaming}
          </p>
          {!isTranslating && <TimerDisplay />}
        </div>
      ) : null}
      {displayImage ? (
        <div
          // Removed key={currentImage.id} to allow internal CSS transition
          // Removed bg-black/40 to make background transparent
          className={`w-full h-full flex items-center justify-center relative transition-opacity duration-300 ease-in-out ${isTransitioning ? "opacity-0" : "opacity-100"}`}
        >
          {/* Image View, Comparison View, or Video View */}
          {isComparing && tempUpscaledImage ? (
            <div className="w-full h-full">
              <ImageComparison
                beforeImage={displayImage.url}
                afterImage={tempUpscaledImage}
                alt={displayImage.prompt}
                labelBefore={t.compare_original}
                labelAfter={t.compare_upscaled}
              />
            </div>
          ) : isLiveMode && displayImage.videoUrl ? (
            <div className="w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                src={displayImage.videoUrl}
                className={`max-w-full max-h-full object-contain shadow-2xl transition-all duration-300 ${displayImage.isBlurred ? "blur-lg scale-105" : ""}`}
                autoPlay
                loop
                playsInline
              />
            </div>
          ) : (
            <TransformWrapper
              initialScale={1}
              minScale={1}
              maxScale={8}
              centerOnInit={true}
              key={displayImage.id} // Keep key here to reset Zoom state on image swap
              wheel={{ step: 0.5 }}
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
                {isOpfsHydrated ? (
                  <img
                    src={displayImage.url}
                    alt={displayImage.prompt}
                    className={`max-w-full max-h-full object-contain shadow-2xl cursor-grab active:cursor-grabbing transition-all duration-300 ${displayImage.isBlurred ? "blur-lg scale-105" : ""}`}
                    onContextMenu={(e) => e.preventDefault()}
                    onLoad={(e) => {
                      setImageDimensions({
                        width: e.currentTarget.naturalWidth,
                        height: e.currentTarget.naturalHeight,
                      });
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center animate-pulse">
                    <ImageIcon className="w-16 h-16 text-white/10" />
                  </div>
                )}
              </TransformComponent>
            </TransformWrapper>
          )}

          {/* Live Generation Overlay for both Prompt and Video generation phases */}
          {(isGeneratingVideoPrompt || isLiveGenerating) && !isLiveMode && (
            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur text-white/80 text-xs px-2 py-1 rounded flex items-center gap-1.5 border border-white/10 z-20">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
              {isGeneratingVideoPrompt
                ? t.liveGeneratingDesc
                : t.liveGenerating}
            </div>
          )}

          {/* Live/Image Toggle Button (Top Right, persistent if video exists) */}
          {displayImage.videoStatus === "success" &&
            displayImage.videoUrl &&
            !isComparing && (
              <div className="absolute top-4 right-4 z-20">
                <button
                  onClick={onToggleLiveMode}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur border border-white/20 text-white/90 hover:bg-white/10 transition-all shadow-lg active:scale-95"
                >
                  {isLiveMode ? (
                    <>
                      <ImageIcon className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-medium">Image</span>
                    </>
                  ) : (
                    <>
                      <Film className="w-4 h-4 text-red-400" />
                      <span className="text-xs font-medium">Live</span>
                    </>
                  )}
                </button>
              </div>
            )}

          {children}
        </div>
      ) : (
        !isWorking && (
          <div className="text-center text-white/60 p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="relative inline-block">
              <Sparkles className="w-20 h-20 text-white/10" />
              <Sparkles className="w-20 h-20 text-purple-500/40 absolute top-0 left-0 blur-lg animate-pulse" />
            </div>
            <h2 className="mt-6 text-2xl font-bold text-white/90">
              {t.galleryEmptyTitle}
            </h2>
            <p className="mt-2 text-base text-white/40 max-w-xs mx-auto">
              {t.galleryEmptyDesc}
            </p>
          </div>
        )
      )}
    </section>
  );
};
