
import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, ShieldAlert, ChevronDown, Loader2, RotateCcw, Check, Trash2, Globe } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { translations } from '../../translations';
import { ServiceMode, CustomProvider, RemoteModelList, ProviderId } from '../../types';

interface ProviderTabProps {
    serviceMode: ServiceMode;
    // Token States
    token: string; stats: any;
    giteeToken: string; giteeStats: any;
    msToken: string; msStats: any;
    a4fToken: string; a4fStats: any;
    // Update Handler
    updateToken: (type: ProviderId, val: string) => void;
    // Custom Provider Props
    customProviders: CustomProvider[];
    handleUpdateCustomProvider: (id: string, updates: Partial<CustomProvider>) => void;
    handleDeleteCustomProvider: (id: string) => void;
    handleRefreshCustomModels: (id: string) => void;
    refreshingProviders: Record<string, boolean>;
    refreshSuccessProviders: Record<string, boolean>;
    // Add New Custom Provider Props
    newProviderName: string; setNewProviderName: (v: string) => void;
    newProviderUrl: string; setNewProviderUrl: (v: string) => void;
    newProviderToken: string; setNewProviderToken: (v: string) => void;
    fetchStatus: string;
    fetchedModels: RemoteModelList | null;
    handleFetchCustomModels: () => void;
    handleAddCustomProvider: () => void;
    handleClearAddForm: () => void;
}

export const ProviderTab: React.FC<ProviderTabProps> = (props) => {
    const { language } = useAppStore();
    const t = translations[language];
    const [openProvider, setOpenProvider] = useState<string>('huggingface');
    
    // Toggle States for password visibility
    const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});

    const toggleTokenShow = (key: string) => {
        setShowTokens(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const renderProviderPanel = (id: string, title: string, dotColorClass: string, children: React.ReactNode) => (
        <div key={id} className="border-b border-white/5 last:border-0">
            <div className="flex items-center w-full group">
                <button
                    onClick={() => setOpenProvider(openProvider === id ? '' : id)}
                    className="flex-1 flex items-center justify-between py-4 text-left"
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${dotColorClass} ring-4 ring-white/[0.02] group-hover:ring-white/[0.05] transition-all`} />
                        <span className={`text-sm font-medium transition-colors ${openProvider === id ? 'text-white' : 'text-white/60 group-hover:text-white'}`}>
                            {title}
                        </span>
                    </div>
                    <div className={`text-white/40 transition-transform duration-300 mr-2 ${openProvider === id ? 'rotate-180 text-white/80' : 'rotate-0 group-hover:text-white/60'}`}>
                        <ChevronDown className="w-4 h-4" />
                    </div>
                </button>
            </div>
            
            <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${openProvider === id ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="p-2 space-y-4 mb-2">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderTokenInput = (
        id: string,
        value: string,
        onChange: (v: string) => void,
        statsObj: { total: number, active: number, exhausted: number },
        placeholder: string,
        helpStart: string,
        linkText: string,
        helpEnd: string,
        linkUrl: string
    ) => (
        <div className="space-y-4">
            <div className="relative group">
                <input
                    type={showTokens[id] ? "text" : "password"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onPaste={(e) => {
                        e.preventDefault();
                        const text = e.clipboardData.getData('text');
                        const processed = text.replace(/[\r\n]+/g, ',');
                        const input = e.currentTarget;
                        const start = input.selectionStart || 0;
                        const end = input.selectionEnd || 0;
                        const currentValue = input.value;
                        const newValue = currentValue.substring(0, start) + processed + currentValue.substring(end);
                        onChange(newValue);
                    }}
                    placeholder={placeholder}
                    className="w-full pl-4 pr-10 py-2.5 bg-[#1A1625] border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-0 focus:border-purple-500/50 transition-all font-mono text-sm"
                />
                <button
                    type="button"
                    onClick={() => toggleTokenShow(id)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
                >
                    {showTokens[id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
            
            {statsObj.total > 1 && (
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/5 border border-white/5 rounded-xl p-2.5 text-center">
                        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">{t.tokenTotal}</div>
                        <div className="text-sm font-bold text-white font-mono">{statsObj.total}</div>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/10 rounded-xl p-2.5 text-center">
                        <div className="text-[10px] text-green-400/60 uppercase tracking-wider mb-0.5">{t.tokenActive}</div>
                        <div className="text-sm font-bold text-green-400 font-mono flex items-center justify-center gap-1">
                           <ShieldCheck className="w-3 h-3" /> {statsObj.active}
                        </div>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/10 rounded-xl p-2.5 text-center">
                        <div className="text-[10px] text-red-400/60 uppercase tracking-wider mb-0.5">{t.tokenExhausted}</div>
                        <div className="text-sm font-bold text-red-400 font-mono flex items-center justify-center gap-1">
                           <ShieldAlert className="w-3 h-3" /> {statsObj.exhausted}
                        </div>
                    </div>
                </div>
            )}

            <p className="text-xs text-white/40 leading-relaxed">
                {helpStart} <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 hover:underline transition-colors">{linkText}</a> {helpEnd}
            </p>
        </div>
    );

    const showBaseProviders = props.serviceMode === 'local' || props.serviceMode === 'hydration';
    const showCustomProviders = props.serviceMode === 'server' || props.serviceMode === 'hydration';
    const showAddCustomProvider = props.serviceMode !== 'local';

    return (
        <div>
            {showBaseProviders && (
                <>
                    {renderProviderPanel('huggingface', t.provider_huggingface, 'bg-yellow-500', 
                        renderTokenInput('hf', props.token, (v) => props.updateToken('huggingface', v), props.stats, 'hf_...,hf_...', t.hfTokenHelp, t.hfTokenLink, t.hfTokenHelpEnd, "https://huggingface.co/settings/tokens"))}
                    {renderProviderPanel('gitee', t.provider_gitee, 'bg-red-500', 
                        renderTokenInput('gitee', props.giteeToken, (v) => props.updateToken('gitee', v), props.giteeStats, '...,...', t.giteeTokenHelp, t.giteeTokenLink, t.giteeTokenHelpEnd, "https://ai.gitee.com/dashboard/settings/tokens"))}
                    {renderProviderPanel('modelscope', t.provider_modelscope, 'bg-blue-500', 
                        renderTokenInput('ms', props.msToken, (v) => props.updateToken('modelscope', v), props.msStats, 'ms-...,ms-...', t.msTokenHelp, t.msTokenLink, t.msTokenHelpEnd, "https://modelscope.cn/my/myaccesstoken"))}
                    {renderProviderPanel('a4f', t.provider_a4f, 'bg-emerald-500', 
                        renderTokenInput('a4f', props.a4fToken, (v) => props.updateToken('a4f', v), props.a4fStats, 'ddc-...,ddc-...', t.a4fTokenHelp, t.a4fTokenLink, t.a4fTokenHelpEnd, "https://www.a4f.co/api-keys"))}
                </>
            )}
            {showCustomProviders && (
                <div>
                    {props.customProviders.map(cp => renderProviderPanel(cp.id, cp.name, 'bg-purple-500', (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-white/60">{t.provider_name}</label>
                                <input type="text" value={cp.name} onChange={(e) => props.handleUpdateCustomProvider(cp.id, { name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-0 focus:border-purple-500/50" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-white/60">{t.api_url}</label>
                                <div className="flex items-center gap-2">
                                    <input type="text" value={cp.apiUrl} onChange={(e) => props.handleUpdateCustomProvider(cp.id, { apiUrl: e.target.value })} className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-0 focus:border-purple-500/50 font-mono" />
                                    <button onClick={() => props.handleRefreshCustomModels(cp.id)} disabled={props.refreshingProviders[cp.id]} className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${props.refreshingProviders[cp.id] ? 'bg-white/5 text-white/40 border-white/5 cursor-not-allowed' : 'bg-white/10 text-white/80 border-white/10 hover:bg-white/20'}`} title={t.get_models || "Update Models"}>{props.refreshingProviders[cp.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}</button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-white/60">{t.api_token}</label>
                                <div className="relative w-full">
                                    <input type={showTokens[cp.id] ? "text" : "password"} value={cp.token || ''} onChange={(e) => props.handleUpdateCustomProvider(cp.id, { token: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-0 focus:border-purple-500/50 font-mono pr-8" />
                                    <button type="button" onClick={() => toggleTokenShow(cp.id)} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white p-1">{showTokens[cp.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                    <div className={`text-xs transition-colors duration-300 flex items-center gap-1.5 ${props.refreshSuccessProviders[cp.id] ? 'text-green-400 font-medium' : 'text-white/40'}`}>
                                    {props.refreshSuccessProviders[cp.id] && <Check className="w-3 h-3" />}
                                    {t.models_count.replace('{count}', ((cp.models.generate?.length || 0) + (cp.models.edit?.length || 0) + (cp.models.video?.length || 0) + (cp.models.text?.length || 0) + (cp.models.upscaler?.length || 0)).toString())}
                                    </div>
                                    <button onClick={() => props.handleDeleteCustomProvider(cp.id)} className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title={t.delete || "Delete"}><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    )))}
                    {showAddCustomProvider && renderProviderPanel('add_custom', t.add_provider, 'bg-white/20', (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-white/60">{t.provider_name} <span className="text-white/30">({t.seedOptional})</span></label>
                                <input type="text" value={props.newProviderName} onChange={e => props.setNewProviderName(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-0 focus:border-purple-500/50" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-white/60">{t.api_url}</label>
                                <div className="flex items-center gap-2">
                                    <input type="text" value={props.newProviderUrl} onChange={e => props.setNewProviderUrl(e.target.value)} className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-0 focus:border-purple-500/50 font-mono" placeholder="https://example.com/api" />
                                    <button onClick={props.handleFetchCustomModels} disabled={!props.newProviderUrl || props.fetchStatus === 'loading'} className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${props.fetchStatus === 'success' ? 'bg-green-500/20 text-green-400 border-green-500/30' : props.fetchStatus === 'failed' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/10 text-white/80 border-white/10 hover:bg-white/20'}`}>{props.fetchStatus === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}{props.fetchStatus === 'loading' ? t.fetch_status_loading : (props.fetchStatus === 'success' ? t.fetch_status_success : (props.fetchStatus === 'failed' ? t.fetch_status_failed : t.get_models))}</button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-white/60">{t.api_token}</label>
                                <div className="relative w-full">
                                    <input type={showTokens['new'] ? "text" : "password"} value={props.newProviderToken} onChange={e => props.setNewProviderToken(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-0 focus:border-purple-500/50 font-mono pr-8" />
                                    <button type="button" onClick={() => toggleTokenShow('new')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white p-1">{showTokens['new'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
                                </div>
                            </div>
                            {props.fetchedModels && (<div className="p-3 bg-white/5 rounded-lg text-xs text-green-400 border border-green-500/20 flex items-center gap-2"><Check className="w-3 h-3" />{t.models_count.replace('{count}', ((props.fetchedModels.generate?.length || 0) + (props.fetchedModels.edit?.length || 0) + (props.fetchedModels.video?.length || 0) + (props.fetchedModels.text?.length || 0) + (props.fetchedModels.upscaler?.length || 0)).toString())}</div>)}
                            <div className="flex justify-between">
                                <button onClick={() => { props.handleClearAddForm(); setOpenProvider(''); }} className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title={t.cancel || "Clear"}><Trash2 className="w-4 h-4" /></button>
                                <button onClick={props.handleAddCustomProvider} disabled={!props.newProviderUrl || !props.fetchedModels} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{t.confirm}</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
