
import React, { useMemo, useEffect, useState } from 'react';
import { X, Save, Settings2, Server, Cpu, MessageSquareText, Film, HardDrive, Database } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import { useSettingsForm } from '../hooks/useSettingsForm';
import { SettingsTabs } from './settings/SettingsTabs';
import { GeneralTab } from './settings/GeneralTab';
import { ProviderTab } from './settings/ProviderTab';
import { ModelsTab } from './settings/ModelsTab';
import { PromptTab } from './settings/PromptTab';
import { LiveTab } from './settings/LiveTab';
import { StorageTab } from './settings/StorageTab';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { language, provider } = useAppStore();
    const t = translations[language];
    
    const form = useSettingsForm(isOpen, onClose);

    // Animation State
    const [isRendered, setIsRendered] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsRendered(true);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => setIsVisible(true));
            });
        } else {
            setIsVisible(false);
            const timer = setTimeout(() => {
                setIsRendered(false);
            }, 500); // Wait for exit animations
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const tabs = useMemo(() => {
        const base = [
            { id: 'general', icon: Settings2, label: t.tab_general },
            { id: 'provider', icon: Server, label: t.tab_provider },
            { id: 'models', icon: Cpu, label: t.model },
            { id: 'prompt', icon: MessageSquareText, label: t.tab_prompt },
            { id: 'live', icon: Film, label: t.tab_live }
        ];
        if (form.storageType === 's3') base.push({ id: 's3', icon: HardDrive, label: t.tab_storage });
        else if (form.storageType === 'webdav') base.push({ id: 'webdav', icon: Database, label: t.tab_webdav });
        return base;
    }, [t, form.storageType]);

    const activeIndex = Math.max(0, tabs.findIndex(tab => tab.id === form.activeTab));

    if (!isRendered) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
             {/* Backdrop: Immediate In, Delayed Out */}
             <div 
                className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0 delay-200'}`}
                onClick={onClose}
             />

             {/* Modal: Delayed In, Immediate Out */}
             <div className={`relative w-full max-w-md bg-[#0D0B14]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-[0_0_50px_-12px_rgba(124,58,237,0.15)] ring-1 ring-white/[0.05] overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1) ${isVisible ? 'scale-100 opacity-100 translate-y-0 delay-100' : 'scale-95 opacity-0 translate-y-4'}`}>
                <div className="flex items-center justify-between px-5 py-2 border-b border-white/[0.06] bg-white/[0.02] flex-shrink-0">
                    <h2 className="text-lg font-bold text-white tracking-wide">{t.settings}</h2>
                    <button onClick={onClose} className="group p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-all duration-200">
                        <X className="w-5 h-5 transition-transform duration-500 ease-out group-hover:rotate-180" />
                    </button>
                </div>

                <SettingsTabs 
                    tabs={tabs}
                    activeTab={form.activeTab} 
                    setActiveTab={form.setActiveTab as any} 
                />
                
                <div className="flex-1 overflow-hidden relative">
                    <div 
                        className="flex h-full transition-transform duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)"
                        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
                    >
                        {tabs.map((tab) => (
                            <div key={tab.id} className="w-full h-full flex-shrink-0 overflow-y-auto custom-scrollbar">
                                <div className="p-5">
                                    {tab.id === 'general' && (
                                        <GeneralTab 
                                            serviceMode={form.serviceMode}
                                            setServiceMode={form.handleServiceModeChange}
                                            storageType={form.storageType}
                                            setStorageType={form.setStorageType}
                                            onClearData={form.handleClearData}
                                            setActiveTab={form.setActiveTab as any}
                                        />
                                    )}

                                    {tab.id === 'provider' && (
                                        <ProviderTab 
                                            serviceMode={form.serviceMode}
                                            token={form.token} setToken={(v) => form.updateToken('hf', v)} stats={form.stats}
                                            giteeToken={form.giteeToken} setGiteeToken={(v) => form.updateToken('gitee', v)} giteeStats={form.giteeStats}
                                            msToken={form.msToken} setMsToken={(v) => form.updateToken('ms', v)} msStats={form.msStats}
                                            a4fToken={form.a4fToken} setA4FToken={(v) => form.updateToken('a4f', v)} a4fStats={form.a4fStats}
                                            customProviders={form.customProviders}
                                            handleUpdateCustomProvider={form.handleUpdateCustomProvider}
                                            handleDeleteCustomProvider={form.handleDeleteCustomProvider}
                                            handleRefreshCustomModels={form.handleRefreshCustomModels}
                                            refreshingProviders={form.refreshingProviders}
                                            refreshSuccessProviders={form.refreshSuccessProviders}
                                            newProviderName={form.newProviderName} setNewProviderName={form.setNewProviderName}
                                            newProviderUrl={form.newProviderUrl} setNewProviderUrl={form.setNewProviderUrl}
                                            newProviderToken={form.newProviderToken} setNewProviderToken={form.setNewProviderToken}
                                            fetchStatus={form.fetchStatus}
                                            fetchedModels={form.fetchedModels}
                                            handleFetchCustomModels={form.handleFetchCustomModels}
                                            handleAddCustomProvider={form.handleAddCustomProvider}
                                            handleClearAddForm={() => {
                                                form.setNewProviderName('');
                                                form.setNewProviderUrl('');
                                                form.setNewProviderToken('');
                                            }}
                                        />
                                    )}

                                    {tab.id === 'models' && (
                                        <ModelsTab 
                                            serviceMode={form.serviceMode}
                                            giteeToken={form.giteeToken}
                                            msToken={form.msToken}
                                            a4fToken={form.a4fToken}
                                            customProviders={form.customProviders}
                                            editModelValue={form.editModelValue} setEditModelValue={form.setEditModelValue}
                                            liveModelValue={form.liveModelValue} setLiveModelValue={form.setLiveModelValue}
                                            upscalerModelValue={form.upscalerModelValue} setUpscalerModelValue={form.setUpscalerModelValue}
                                            textModelValue={form.textModelValue} setTextModelValue={form.setTextModelValue}
                                        />
                                    )}

                                    {tab.id === 'prompt' && (
                                        <PromptTab 
                                            systemPrompt={form.systemPrompt}
                                            setSystemPrompt={form.setSystemPrompt}
                                            translationPrompt={form.translationPrompt}
                                            setTranslationPrompt={form.setTranslationPrompt}
                                        />
                                    )}

                                    {tab.id === 'live' && (
                                        <LiveTab 
                                            provider={provider}
                                            videoSettings={form.videoSettings}
                                            setVideoSettings={form.setVideoSettings}
                                        />
                                    )}

                                    {(tab.id === 's3' || tab.id === 'webdav') && (
                                        <StorageTab 
                                            activeTab={tab.id}
                                            s3Config={form.s3Config} setS3Config={form.setS3Config}
                                            webdavConfig={form.webdavConfig} setWebdavConfig={form.setWebdavConfig}
                                            testS3Result={form.testS3Result} isTestingS3={form.isTestingS3} handleTestS3={form.handleTestS3}
                                            testWebDAVResult={form.testWebDAVResult} isTestingWebDAV={form.isTestingWebDAV} handleTestWebDAV={form.handleTestWebDAV}
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 px-5 py-2 border-t border-white/[0.06] bg-white/[0.02] flex-shrink-0">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all duration-200">{t.cancel}</button>
                    <button onClick={form.handleSave} className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-500 active:bg-purple-700 active:scale-95 rounded-lg transition-all shadow-[0_4px_20px_-4px_rgba(147,51,234,0.5)] hover:shadow-[0_4px_25px_-4px_rgba(147,51,234,0.6)]"><Save className="w-4 h-4" />{t.save}</button>
                </div>
            </div>
        </div>
    );
};
