
import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { initOpfsDirs, readTempFileFromOPFS, deleteTempFileFromOPFS, saveTempFileToOPFS } from '../services/storageService';
import { GeneratedImage, CustomProvider, ModelOption } from '../types';
import { getServiceMode, saveServiceMode, getCustomProviders, addCustomProvider, generateUUID, fetchBlob } from '../services/utils';
import { fetchServerModels, getCustomTaskStatus } from '../services/customService';
import { getGiteeTaskStatus } from '../services/giteeService';
import { HF_MODEL_OPTIONS, GITEE_MODEL_OPTIONS, MS_MODEL_OPTIONS, A4F_MODEL_OPTIONS, getModelConfig, getGuidanceScaleConfig } from '../constants';

export const useAppInit = () => {
    const {
        provider, setProvider,
        model, setModel,
        setSteps, setGuidanceScale,
        history, setHistory,
        currentImage, setCurrentImage,
        setIsLiveMode,
        setError,
        currentView
    } = useAppStore();

    // Password Modal State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [accessPassword, setAccessPassword] = useState('');
    const [passwordError, setPasswordError] = useState(false);

    // 1. Hydrate history from OPFS on mount
    useEffect(() => {
        const hydrateHistory = async () => {
            await initOpfsDirs();
            
            const currentHistory = useAppStore.getState().history;
            const now = Date.now();
            const oneDayInMs = 24 * 60 * 60 * 1000;
            
            const validHistory: GeneratedImage[] = [];
            let hasChanges = false;
            
            for (const img of currentHistory) {
                if ((now - img.timestamp) >= oneDayInMs) {
                    const filenameToDelete = img.fileName || `${img.id}.png`; 
                    await deleteTempFileFromOPFS(filenameToDelete);
                    if (img.videoFileName) await deleteTempFileFromOPFS(img.videoFileName);
                    hasChanges = true;
                } else {
                    const filenameToLoad = img.fileName || `${img.id}.png`;
                    const opfsBlob = await readTempFileFromOPFS(filenameToLoad);
                    
                    if (opfsBlob) {
                        img.url = URL.createObjectURL(opfsBlob);
                        
                        // Hydrate video URL if exists locally
                        if (img.videoFileName) {
                            const videoBlob = await readTempFileFromOPFS(img.videoFileName);
                            if (videoBlob) {
                                img.videoUrl = URL.createObjectURL(videoBlob);
                            }
                        }
                        
                        validHistory.push(img);
                    } else {
                        if (!img.url.startsWith('blob:')) {
                            validHistory.push(img);
                        } else {
                            hasChanges = true;
                        }
                    }
                }
            }
            
            if (hasChanges || validHistory.length !== currentHistory.length) {
                setHistory(validHistory);
            }
            
            const currentImg = useAppStore.getState().currentImage;
            if (validHistory.length > 0 && !currentImg) {
                const firstImg = validHistory[0];
                setCurrentImage(firstImg);
                if (firstImg.videoUrl && firstImg.videoStatus === 'success') {
                    setIsLiveMode(true);
                }
            }
        };

        hydrateHistory();
    }, []);

    // 2. Server Mode Initialization
    useEffect(() => {
        const initServiceMode = async () => {
            const mode = getServiceMode();
            
            if (mode === 'server') {
                try {
                    const customProviders = getCustomProviders();
                    const existingServer = customProviders.find(p => p.name === 'Server' && p.apiUrl === '/api');
                    const storedToken = existingServer?.token;

                    const models = await fetchServerModels(storedToken);
                    
                    const serverProvider: CustomProvider = {
                        id: existingServer ? existingServer.id : generateUUID(),
                        name: 'Server',
                        apiUrl: '/api',
                        token: storedToken || '',
                        models,
                        enabled: true
                    };
                    
                    addCustomProvider(serverProvider);
                    window.dispatchEvent(new Event("storage"));
                    
                    if (models.generate && models.generate.length > 0) {
                        const currentProviderIsCustom = customProviders.some(p => p.id === provider);
                        if (!provider || provider === 'huggingface' || (currentProviderIsCustom && !existingServer)) {
                            setProvider(serverProvider.id);
                            setModel(models.generate[0].id);
                        }
                    }

                } catch (e: any) {
                    if (e.message === '401') {
                        setShowPasswordModal(true);
                    } else {
                        console.error("Failed to init server mode", e);
                    }
                }
            }
        };
        
        if (!showPasswordModal) {
            initServiceMode();
        }
    }, []);

    // 3. Password Handlers
    const handlePasswordSubmit = async () => {
        setPasswordError(false);
        try {
            const models = await fetchServerModels(accessPassword);
            
            const customProviders = getCustomProviders();
            const existing = customProviders.find(p => p.name === 'Server' && p.apiUrl === '/api');

            const serverProvider: CustomProvider = {
                id: existing ? existing.id : generateUUID(),
                name: 'Server',
                apiUrl: '/api',
                token: accessPassword,
                models,
                enabled: true
            };
            
            addCustomProvider(serverProvider);
            saveServiceMode('server');
            window.dispatchEvent(new Event("storage"));
            
            if (models.generate && models.generate.length > 0) {
                setProvider(serverProvider.id);
                setModel(models.generate[0].id);
            }

            setShowPasswordModal(false);
        } catch (e) {
            setPasswordError(true);
        }
    };

    const handleSwitchToLocal = () => {
        saveServiceMode('local');
        window.dispatchEvent(new Event("storage"));
        setShowPasswordModal(false);
        setProvider('huggingface');
        setModel(HF_MODEL_OPTIONS[0].value);
    };

    // 4. Polling for Video Tasks
    useEffect(() => {
        let isMounted = true;
        let timeoutId: any;

        const poll = async () => {
            if (!isMounted) return;

            const currentHist = useAppStore.getState().history;
            
            const pendingVideos = currentHist.filter(img => 
                img.videoStatus === 'generating' && 
                img.videoTaskId
            );
            
            if (pendingVideos.length === 0) {
                timeoutId = setTimeout(poll, 5000);
                return;
            }

            const now = Date.now();
            const readyToPoll = pendingVideos.filter(img => !img.videoNextPollTime || now >= img.videoNextPollTime);

            if (readyToPoll.length === 0) {
                const nextTimes = pendingVideos.map(img => img.videoNextPollTime || 5000);
                const minTime = Math.min(...nextTimes);
                const delay = Math.max(5000, minTime - now);
                timeoutId = setTimeout(poll, delay);
                return;
            }

            const updates = await Promise.all(readyToPoll.map(async (img) => {
                if (!img.videoTaskId) return null;
                try {
                    let result = null;
                    if (img.videoProvider === 'gitee') {
                        result = await getGiteeTaskStatus(img.videoTaskId);
                    } else if (img.videoProvider) {
                        const customProviders = getCustomProviders();
                        const provider = customProviders.find(p => p.id === img.videoProvider);
                        if (provider) {
                            result = await getCustomTaskStatus(provider, img.videoTaskId);
                        }
                    }
                    
                    if (result && (result.status === 'success' || result.status === 'failed')) {
                        // If success, download video to OPFS
                        if (result.status === 'success' && result.videoUrl) {
                            try {
                                const videoBlob = await fetchBlob(result.videoUrl);
                                const videoFileName = `live-${img.id}.mp4`;
                                await saveTempFileToOPFS(videoBlob, videoFileName);
                                const objectUrl = URL.createObjectURL(videoBlob);
                                return { id: img.id, ...result, videoUrl: objectUrl, videoFileName };
                            } catch (e) {
                                console.error("Failed to cache video", e);
                                return { id: img.id, ...result };
                            }
                        }
                        return { id: img.id, ...result };
                    }
                    return null;
                } catch (e) {
                    console.error("Failed to poll task", img.videoTaskId, e);
                    return null;
                }
            }));

            const validUpdates = updates.filter(u => u !== null) as {id: string, status: string, videoUrl?: string, error?: string, videoFileName?: string}[];

            if (validUpdates.length > 0 && isMounted) {
                setHistory(prev => prev.map(item => {
                    const update = validUpdates.find(u => u.id === item.id);
                    if (!update) return item;

                    if (update.status === 'success' && update.videoUrl) {
                        return { ...item, videoStatus: 'success', videoUrl: update.videoUrl, videoFileName: update.videoFileName };
                    } else if (update.status === 'failed') {
                        const failMsg = update.error || 'Video generation failed';
                        return { ...item, videoStatus: 'failed', videoError: failMsg };
                    }
                    return item;
                }));

                const currImg = useAppStore.getState().currentImage;
                if (currImg) {
                    const relevantUpdate = validUpdates.find(u => u.id === currImg.id);
                    if (relevantUpdate) {
                        if (relevantUpdate.status === 'success' && relevantUpdate.videoUrl) {
                            setCurrentImage(prev => prev ? { ...prev, videoStatus: 'success', videoUrl: relevantUpdate.videoUrl, videoFileName: relevantUpdate.videoFileName } : null);
                            setIsLiveMode(true);
                        } else if (relevantUpdate.status === 'failed') {
                            setCurrentImage(prev => prev ? { ...prev, videoStatus: 'failed', videoError: relevantUpdate.error || 'Video generation failed' } : null);
                            setError(relevantUpdate.error || 'Video generation failed');
                        }
                    }
                }
            }

            if (isMounted) timeoutId = setTimeout(poll, 5000);
        };

        poll();

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, []);

    // 5. Model/Steps Initialization on View Change
    useEffect(() => {
        if (currentView === 'creation') {
            let options: { value: string; label: string }[] = [];
            if (provider === 'gitee') options = GITEE_MODEL_OPTIONS;
            else if (provider === 'modelscope') options = MS_MODEL_OPTIONS;
            else if (provider === 'huggingface') options = HF_MODEL_OPTIONS;
            else if (provider === 'a4f') options = A4F_MODEL_OPTIONS;
            else {
                const customProviders = getCustomProviders();
                const activeCustom = customProviders.find(p => p.id === provider);
                if (activeCustom?.models?.generate) {
                    options = activeCustom.models.generate.map(m => ({ value: m.id, label: m.name }));
                }
            }

            if (options.length > 0) {
                const isValid = options.some(o => o.value === model);
                if (!isValid) {
                    const defaultModel = options[0].value as ModelOption;
                    setModel(defaultModel);
                    
                    const config = getModelConfig(provider, defaultModel);
                    setSteps(config.default);
                    const gsConfig = getGuidanceScaleConfig(defaultModel, provider);
                    if (gsConfig) setGuidanceScale(gsConfig.default);
                }
            }
        }
    }, [currentView, provider, model]);

    // 6. Update steps/guidance when provider/model changes
    useEffect(() => {
        const config = getModelConfig(provider, model);
        setSteps(config.default);

        const gsConfig = getGuidanceScaleConfig(model, provider);
        if (gsConfig) {
            setGuidanceScale(gsConfig.default);
        }
    }, [provider, model]);

    return {
        showPasswordModal,
        accessPassword,
        passwordError,
        setAccessPassword,
        handlePasswordSubmit,
        handleSwitchToLocal
    };
};
