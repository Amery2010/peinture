
import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { 
    S3Config, WebDAVConfig, StorageType, CustomProvider, RemoteModelList, ServiceMode, VideoSettings, UnifiedModelOption 
} from '../types';
import {
    getSystemPromptContent, saveSystemPromptContent, DEFAULT_SYSTEM_PROMPT_CONTENT,
    getTranslationPromptContent, saveTranslationPromptContent, DEFAULT_TRANSLATION_SYSTEM_PROMPT,
    getVideoSettings, saveVideoSettings, DEFAULT_VIDEO_SETTINGS,
    getEditModelConfig, saveEditModelConfig,
    getLiveModelConfig, saveLiveModelConfig,
    getTextModelConfig, saveTextModelConfig,
    getUpscalerModelConfig, saveUpscalerModelConfig,
    getCustomProviders, addCustomProvider, removeCustomProvider, saveCustomProviders,
    generateUUID, getServiceMode, saveServiceMode
} from '../services/utils';
import { transformModelList } from '../services/customService';
import {
    getS3Config, saveS3Config, DEFAULT_S3_CONFIG,
    getWebDAVConfig, saveWebDAVConfig, DEFAULT_WEBDAV_CONFIG,
    getStorageType, saveStorageType,
    testWebDAVConnection, testS3Connection, clearOPFS
} from '../services/storageService';
import {
    getTokenStats, getTokens
} from '../services/hfService';
import {
    getGiteeTokenStats, getGiteeTokens
} from '../services/giteeService';
import {
    getMsTokenStats, getMsTokens
} from '../services/msService';
import {
    getA4FTokenStats, getA4FTokens
} from '../services/a4fService';
import { HF_MODEL_OPTIONS, GITEE_MODEL_OPTIONS, MS_MODEL_OPTIONS, A4F_MODEL_OPTIONS, EDIT_MODELS, LIVE_MODELS, TEXT_MODELS, UPSCALER_MODELS } from '../constants';

export const useSettingsForm = (isOpen: boolean, onClose: () => void) => {
    const { provider, setProvider, model, setModel } = useAppStore();

    // -- State --
    const [activeTab, setActiveTab] = useState<'general' | 'provider' | 'models' | 'prompt' | 'live' | 's3' | 'webdav'>('general');
    const [serviceMode, setServiceMode] = useState<ServiceMode>('local');

    // Tokens
    const [token, setToken] = useState('');
    const [stats, setStats] = useState({ total: 0, active: 0, exhausted: 0 });
    const [giteeToken, setGiteeToken] = useState('');
    const [giteeStats, setGiteeStats] = useState({ total: 0, active: 0, exhausted: 0 });
    const [msToken, setMsToken] = useState('');
    const [msStats, setMsStats] = useState({ total: 0, active: 0, exhausted: 0 });
    const [a4fToken, setA4FToken] = useState('');
    const [a4fStats, setA4FStats] = useState({ total: 0, active: 0, exhausted: 0 });

    // Custom Providers
    const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
    const [newProviderName, setNewProviderName] = useState('');
    const [newProviderUrl, setNewProviderUrl] = useState('');
    const [newProviderToken, setNewProviderToken] = useState('');
    const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');
    const [fetchedModels, setFetchedModels] = useState<RemoteModelList | null>(null);
    const [refreshingProviders, setRefreshingProviders] = useState<Record<string, boolean>>({});
    const [refreshSuccessProviders, setRefreshSuccessProviders] = useState<Record<string, boolean>>({});

    // Prompts
    const [systemPrompt, setSystemPrompt] = useState('');
    const [translationPrompt, setTranslationPrompt] = useState('');

    // Unified Models
    const [creationModelValue, setCreationModelValue] = useState<string>('');
    const [editModelValue, setEditModelValue] = useState<string>('');
    const [liveModelValue, setLiveModelValue] = useState<string>('');
    const [textModelValue, setTextModelValue] = useState<string>('');
    const [upscalerModelValue, setUpscalerModelValue] = useState<string>('');

    // Video
    const [videoSettings, setVideoSettings] = useState<VideoSettings>(DEFAULT_VIDEO_SETTINGS['huggingface']);

    // Storage
    const [storageType, setStorageType] = useState<StorageType>('opfs');
    const [s3Config, setS3Config] = useState<S3Config>(DEFAULT_S3_CONFIG);
    const [webdavConfig, setWebdavConfig] = useState<WebDAVConfig>(DEFAULT_WEBDAV_CONFIG);
    
    // Testing
    const [testWebDAVResult, setTestWebDAVResult] = useState<{ success: boolean; message: string } | null>(null);
    const [isTestingWebDAV, setIsTestingWebDAV] = useState(false);
    const [testS3Result, setTestS3Result] = useState<{ success: boolean; message: string } | null>(null);
    const [isTestingS3, setIsTestingS3] = useState(false);

    // -- Initialization --
    useEffect(() => {
        if (isOpen) {
            setServiceMode(getServiceMode());

            const storedToken = localStorage.getItem('huggingFaceToken') || '';
            setToken(storedToken);
            setStats(getTokenStats(storedToken));

            const storedGiteeToken = localStorage.getItem('giteeToken') || '';
            setGiteeToken(storedGiteeToken);
            setGiteeStats(getGiteeTokenStats(storedGiteeToken));

            const storedMsToken = localStorage.getItem('msToken') || '';
            setMsToken(storedMsToken);
            setMsStats(getMsTokenStats(storedMsToken));

            const storedA4FToken = localStorage.getItem('a4fToken') || '';
            setA4FToken(storedA4FToken);
            setA4FStats(getA4FTokenStats(storedA4FToken));

            setCustomProviders(getCustomProviders());

            setSystemPrompt(getSystemPromptContent());
            setTranslationPrompt(getTranslationPromptContent());

            setVideoSettings(getVideoSettings(provider));

            setStorageType(getStorageType());
            setS3Config(getS3Config());
            setWebdavConfig(getWebDAVConfig());
            
            setTestWebDAVResult(null);
            setTestS3Result(null);

            const editConfig = getEditModelConfig();
            setEditModelValue(`${editConfig.provider}:${editConfig.model}`);

            const liveConfig = getLiveModelConfig();
            setLiveModelValue(`${liveConfig.provider}:${liveConfig.model}`);

            const textConfig = getTextModelConfig();
            setTextModelValue(`${textConfig.provider}:${textConfig.model}`);

            const upscalerConfig = getUpscalerModelConfig();
            setUpscalerModelValue(`${upscalerConfig.provider}:${upscalerConfig.model}`);

            if (provider && model) {
                setCreationModelValue(`${provider}:${model}`);
            }
        } else {
            setActiveTab('general');
            setNewProviderName('');
            setNewProviderUrl('');
            setNewProviderToken('');
            setFetchedModels(null);
            setFetchStatus('idle');
        }
    }, [isOpen, provider, model]);

    // -- Validation Effect --
    useEffect(() => {
        const getValidValues = (type: 'generate' | 'edit' | 'video' | 'text' | 'upscaler', baseList: UnifiedModelOption[]) => {
            const valid = new Set<string>();
            const isLocal = serviceMode === 'local' || serviceMode === 'hydration';
            const isServer = serviceMode === 'server' || serviceMode === 'hydration';

            if (isLocal) {
                baseList.filter(m => m.provider === 'huggingface').forEach(m => valid.add(m.value));
                if (giteeToken || localStorage.getItem('giteeToken')) {
                     baseList.filter(m => m.provider === 'gitee').forEach(m => valid.add(m.value));
                }
                if (msToken || localStorage.getItem('msToken')) {
                     baseList.filter(m => m.provider === 'modelscope').forEach(m => valid.add(m.value));
                }
                if (a4fToken || localStorage.getItem('a4fToken')) {
                     baseList.filter(m => m.provider === 'a4f').forEach(m => valid.add(m.value));
                }
            }

            if (isServer) {
                customProviders.forEach(cp => {
                    const models = cp.models[type];
                    if (models) {
                        models.forEach(m => valid.add(`${cp.id}:${m.id}`));
                    }
                });
            }
            return Array.from(valid);
        };

        const baseCreationList: UnifiedModelOption[] = [
            ...HF_MODEL_OPTIONS.map(m => ({ label: m.label, value: `huggingface:${m.value}`, provider: 'huggingface' as any })),
            ...GITEE_MODEL_OPTIONS.map(m => ({ label: m.label, value: `gitee:${m.value}`, provider: 'gitee' as any })),
            ...MS_MODEL_OPTIONS.map(m => ({ label: m.label, value: `modelscope:${m.value}`, provider: 'modelscope' as any })),
            ...A4F_MODEL_OPTIONS.map(m => ({ label: m.label, value: `a4f:${m.value}`, provider: 'a4f' as any }))
        ];
        
        const validCreation = getValidValues('generate', baseCreationList);
        if (validCreation.length > 0 && (!creationModelValue || !validCreation.includes(creationModelValue))) {
            setCreationModelValue(validCreation[0]);
        }

        const validEdit = getValidValues('edit', EDIT_MODELS);
        if (validEdit.length > 0 && (!editModelValue || !validEdit.includes(editModelValue))) {
            setEditModelValue(validEdit[0]);
        }

        const validLive = getValidValues('video', LIVE_MODELS);
        if (validLive.length > 0 && (!liveModelValue || !validLive.includes(liveModelValue))) {
            setLiveModelValue(validLive[0]);
        }

        const validText = getValidValues('text', TEXT_MODELS);
        if (validText.length > 0 && (!textModelValue || !validText.includes(textModelValue))) {
            setTextModelValue(validText[0]);
        }

        const validUpscaler = getValidValues('upscaler', UPSCALER_MODELS);
        if (validUpscaler.length > 0 && (!upscalerModelValue || !validUpscaler.includes(upscalerModelValue))) {
            setUpscalerModelValue(validUpscaler[0]);
        }

    }, [customProviders, serviceMode, giteeToken, msToken, a4fToken]);

    // -- Handlers --

    const handleServiceModeChange = (newMode: ServiceMode) => {
        setServiceMode(newMode);
        if (newMode === 'local') {
            const customList = getCustomProviders();
            const currentProviderIsCustom = customList.some(cp => cp.id === provider);
            if (currentProviderIsCustom) {
                setProvider('huggingface');
                setModel(HF_MODEL_OPTIONS[0].value as any);
                setCreationModelValue(`huggingface:${HF_MODEL_OPTIONS[0].value}`);
            }
        }
    };

    const handleFetchCustomModels = async () => {
        if (!newProviderUrl) return;
        setFetchStatus('loading');
        try {
            const url = newProviderUrl.replace(/\/$/, '') + '/v1/models';
            const headers: Record<string, string> = {};
            if (newProviderToken) headers['Authorization'] = `Bearer ${newProviderToken}`;
            const response = await fetch(url, { headers });
            if (!response.ok) throw new Error('Fetch failed');
            const rawData = await response.json();
            const transformedData = transformModelList(rawData);
            setFetchedModels(transformedData);
            setFetchStatus('success');
        } catch (e) {
            console.error("Failed to fetch models", e);
            setFetchStatus('failed');
            setFetchedModels(null);
        }
    };

    const handleAddCustomProvider = () => {
        if (!newProviderUrl || !fetchedModels) return;
        let finalName = newProviderName.trim();
        if (!finalName) {
            try {
                const urlStr = newProviderUrl.startsWith('http') ? newProviderUrl : `https://${newProviderUrl}`;
                const url = new URL(urlStr);
                const parts = url.hostname.split('.');
                finalName = parts.length >= 2 ? parts[parts.length - 2] : url.hostname;
                finalName = finalName.charAt(0).toUpperCase() + finalName.slice(1);
            } catch { finalName = 'Custom'; }
        }
        const newProvider: CustomProvider = {
            id: generateUUID(),
            name: finalName,
            apiUrl: newProviderUrl,
            token: newProviderToken,
            models: fetchedModels,
            enabled: true
        };
        addCustomProvider(newProvider);
        setCustomProviders(getCustomProviders());
        window.dispatchEvent(new Event("storage"));
        
        setNewProviderName('');
        setNewProviderUrl('');
        setNewProviderToken('');
        setFetchStatus('idle');
        setFetchedModels(null);
    };

    const handleUpdateCustomProvider = (id: string, updates: Partial<CustomProvider>) => {
        setCustomProviders(prev => prev.map(cp => cp.id === id ? { ...cp, ...updates } : cp));
    };

    const handleDeleteCustomProvider = (id: string) => {
        removeCustomProvider(id);
        setCustomProviders(getCustomProviders());
        window.dispatchEvent(new Event("storage"));
    };

    const handleRefreshCustomModels = async (id: string) => {
        const p = customProviders.find(cp => cp.id === id);
        if (!p) return;
        setRefreshingProviders(prev => ({ ...prev, [id]: true }));
        setRefreshSuccessProviders(prev => ({ ...prev, [id]: false }));
        try {
            const url = p.apiUrl.replace(/\/$/, '') + '/v1/models';
            const headers: Record<string, string> = {};
            if (p.token) headers['Authorization'] = `Bearer ${p.token}`;
            const response = await fetch(url, { headers });
            if (!response.ok) throw new Error('Fetch failed');
            const rawData = await response.json();
            const transformedData = transformModelList(rawData);
            handleUpdateCustomProvider(id, { models: transformedData });
            setRefreshSuccessProviders(prev => ({ ...prev, [id]: true }));
            setTimeout(() => setRefreshSuccessProviders(prev => ({ ...prev, [id]: false })), 2500);
        } catch (e) {
            console.error(e);
        } finally {
            setRefreshingProviders(prev => ({ ...prev, [id]: false }));
        }
    };

    const handleTestS3 = async () => {
        setIsTestingS3(true);
        setTestS3Result(null);
        try {
            const result = await testS3Connection(s3Config);
            setTestS3Result(result);
        } catch (e) {
            setTestS3Result({ success: false, message: 'Test failed' });
        } finally {
            setIsTestingS3(false);
        }
    };

    const handleTestWebDAV = async () => {
        if (window.location.protocol === 'https:' && webdavConfig.url.startsWith('http:')) {
            setTestWebDAVResult({ success: false, message: 'Mixed Content Error' });
            return;
        }
        setIsTestingWebDAV(true);
        setTestWebDAVResult(null);
        try {
            const result = await testWebDAVConnection(webdavConfig);
            setTestWebDAVResult(result);
        } catch (e) {
            setTestWebDAVResult({ success: false, message: 'Test failed' });
        } finally {
            setIsTestingWebDAV(false);
        }
    };

    const handleClearData = async () => {
        try {
            localStorage.clear();
            sessionStorage.clear();
            await clearOPFS();
            window.location.reload();
        } catch (e) {
            console.error(e);
            window.location.reload();
        }
    };

    const handleSave = () => {
        localStorage.setItem('huggingFaceToken', token.trim());
        localStorage.setItem('giteeToken', giteeToken.trim());
        localStorage.setItem('msToken', msToken.trim());
        localStorage.setItem('a4fToken', a4fToken.trim());
        
        saveSystemPromptContent(systemPrompt);
        saveTranslationPromptContent(translationPrompt);
        saveVideoSettings(provider, videoSettings);
        
        saveStorageType(storageType);
        saveS3Config(s3Config);
        saveWebDAVConfig(webdavConfig);

        saveEditModelConfig(editModelValue);
        saveLiveModelConfig(liveModelValue);
        saveTextModelConfig(textModelValue);
        saveUpscalerModelConfig(upscalerModelValue);
        
        saveServiceMode(serviceMode);
        saveCustomProviders(customProviders);

        if (creationModelValue) {
            const [newProvider, newModel] = creationModelValue.split(':');
            setProvider(newProvider as any);
            setModel(newModel as any);
        }
        
        window.dispatchEvent(new Event("storage"));
        onClose();
    };

    // Helper to update tokens and stats
    const updateToken = (type: 'hf' | 'gitee' | 'ms' | 'a4f', value: string) => {
        if (type === 'hf') {
            setToken(value);
            setStats(getTokenStats(value));
        } else if (type === 'gitee') {
            setGiteeToken(value);
            setGiteeStats(getGiteeTokenStats(value));
        } else if (type === 'ms') {
            setMsToken(value);
            setMsStats(getMsTokenStats(value));
        } else if (type === 'a4f') {
            setA4FToken(value);
            setA4FStats(getA4FTokenStats(value));
        }
    };

    return {
        activeTab, setActiveTab,
        serviceMode, handleServiceModeChange,
        storageType, setStorageType,
        token, stats, giteeToken, giteeStats, msToken, msStats, a4fToken, a4fStats, updateToken,
        customProviders, handleUpdateCustomProvider, handleDeleteCustomProvider, handleRefreshCustomModels, refreshingProviders, refreshSuccessProviders,
        newProviderName, setNewProviderName, newProviderUrl, setNewProviderUrl, newProviderToken, setNewProviderToken, fetchStatus, fetchedModels, handleFetchCustomModels, handleAddCustomProvider,
        systemPrompt, setSystemPrompt, translationPrompt, setTranslationPrompt,
        creationModelValue, setCreationModelValue,
        editModelValue, setEditModelValue,
        liveModelValue, setLiveModelValue,
        textModelValue, setTextModelValue,
        upscalerModelValue, setUpscalerModelValue,
        videoSettings, setVideoSettings,
        s3Config, setS3Config, showS3Secret: false, // UI can handle show toggle if local state needed, or add here
        webdavConfig, setWebdavConfig,
        testS3Result, isTestingS3, handleTestS3,
        testWebDAVResult, isTestingWebDAV, handleTestWebDAV,
        handleClearData, handleSave,
    };
};
