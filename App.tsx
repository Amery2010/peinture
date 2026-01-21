
import React, { useState, useCallback, memo, useEffect } from 'react';
import { useAppStore } from './store/appStore';
import { useAppInit } from './hooks/useAppInit';
import { useCloudUpload } from './hooks/useCloudUpload';
import { Header } from './components/Header';
import { CreationView } from './views/CreationView';
import { ImageEditorView } from './views/ImageEditorView';
import { CloudGalleryView } from './views/CloudGalleryView';
import { SettingsModal } from './components/SettingsModal';
import { FAQModal } from './components/FAQModal';
import { AuthModal } from './components/AuthModal';

// Memoize Header to prevent re-renders when App re-renders
const MemoizedHeader = memo(Header);

export default function App() {
  const { currentView } = useAppStore();
  
  // Transition State
  const [displayView, setDisplayView] = useState(currentView);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (currentView !== displayView) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setDisplayView(currentView);
        // Allow a frame for render before fading in
        requestAnimationFrame(() => {
            setIsTransitioning(false);
        });
      }, 200); // Wait for fade out
      return () => clearTimeout(timer);
    }
  }, [currentView, displayView]);
  
  // Initialization Logic Hook
  const { 
      showPasswordModal, 
      accessPassword, 
      setAccessPassword, 
      passwordError, 
      handlePasswordSubmit, 
      handleSwitchToLocal 
  } = useAppInit();

  // Cloud Upload Logic Hook
  const { handleUploadToCloud } = useCloudUpload();

  // Modal States
  const [showSettings, setShowSettings] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);

  const handleOpenSettings = useCallback(() => setShowSettings(true), []);
  const handleOpenFAQ = useCallback(() => setShowFAQ(true), []);

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-gradient-brilliant">
      <div className="flex h-full grow flex-col">
        {/* Header */}
        <MemoizedHeader 
            onOpenSettings={handleOpenSettings}
            onOpenFAQ={handleOpenFAQ}
        />

        {/* Main Content Area with Transition */}
        <div className={`flex-1 flex flex-col w-full transition-all duration-200 ease-in-out ${isTransitioning ? 'opacity-0 translate-y-2 scale-[0.99]' : 'opacity-100 translate-y-0 scale-100'}`}>
            {displayView === 'creation' ? (
                <CreationView />
            ) : displayView === 'editor' ? (
                <main className="w-full flex-1 flex flex-col items-center justify-center md:p-4">
                    <ImageEditorView 
                      onOpenSettings={handleOpenSettings}
                      handleUploadToS3={handleUploadToCloud}
                    />
                </main>
            ) : (
                <main className="w-full max-w-7xl mx-auto flex-1 flex flex-col gap-4 px-4 md:px-8 pb-8 pt-6">
                    <CloudGalleryView 
                        handleUploadToS3={handleUploadToCloud}
                        onOpenSettings={handleOpenSettings}
                    />
                </main>
            )}
        </div>
        
        {/* Modals */}
        <SettingsModal 
            isOpen={showSettings} 
            onClose={() => setShowSettings(false)} 
        />

        <FAQModal 
            isOpen={showFAQ}
            onClose={() => setShowFAQ(false)}
        />

        <AuthModal 
            isOpen={showPasswordModal}
            passwordValue={accessPassword}
            onPasswordChange={setAccessPassword}
            onSubmit={handlePasswordSubmit}
            onSwitchLocal={handleSwitchToLocal}
            error={passwordError}
        />
      </div>
    </div>
  );
}
