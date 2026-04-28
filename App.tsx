
import React, { useState, useCallback, memo, useEffect } from 'react';
import { useUIStore } from './store/uiStore';
import { useAppInit } from './hooks/useAppInit';
import { useCloudUpload } from './hooks/useCloudUpload';
import { Header } from './components/Header';
import { CreationView } from './views/CreationView';
const ImageEditorView = React.lazy(() => import('./views/ImageEditorView').then(module => ({ default: module.ImageEditorView })));
const CloudGalleryView = React.lazy(() => import('./views/CloudGalleryView').then(module => ({ default: module.CloudGalleryView })));
import { SettingsModal } from './components/SettingsModal';
import { FAQModal } from './components/FAQModal';
import { AuthModal } from './components/AuthModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';

// Memoize Header to prevent re-renders when App re-renders
const MemoizedHeader = memo(Header);

export default function App() {
  const { currentView } = useUIStore();
  
  // Transition State
  const [displayView, setDisplayView] = useState(currentView);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (currentView !== displayView) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
            <ErrorBoundary>
            {displayView === 'creation' ? (
                <CreationView />
            ) : displayView === 'editor' ? (
                <main className="w-full flex-1 flex flex-col items-center justify-center md:p-4">
                    <React.Suspense fallback={<div className="flex-1 flex items-center justify-center text-white/50 text-sm">Loading Editor...</div>}>
                        <ImageEditorView 
                          onOpenSettings={handleOpenSettings}
                          handleUploadToS3={handleUploadToCloud}
                        />
                    </React.Suspense>
                </main>
            ) : (
                <main className="w-full max-w-7xl mx-auto flex-1 flex flex-col gap-4 px-4 md:px-8 pb-8 pt-6">
                    <React.Suspense fallback={<div className="flex-1 flex items-center justify-center text-white/50 text-sm">Loading Gallery...</div>}>
                        <CloudGalleryView 
                            handleUploadToS3={handleUploadToCloud}
                            onOpenSettings={handleOpenSettings}
                        />
                    </React.Suspense>
                </main>
            )}
            </ErrorBoundary>
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

        <Toaster 
            theme="dark"
            position="top-center"
            toastOptions={{
                style: {
                    background: '#0D0B14',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                },
            }}
        />
      </div>
    </div>
  );
}
