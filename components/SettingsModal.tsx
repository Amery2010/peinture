import React, { useState, useEffect } from 'react';
import { X, Save, KeyRound, Languages, ShieldCheck, ShieldAlert, Database, Eye, EyeOff } from 'lucide-react';
import { Language } from '../translations';
import { getTokenStats } from '../services/hfService';
import { getGiteeTokenStats } from '../services/giteeService';
import { getMsTokenStats } from '../services/msService';
import { ProviderOption } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    lang: Language;
    setLang: (lang: Language) => void;
    t: any;
    provider: ProviderOption;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, lang, setLang, t, provider }) => {
    // HF Token State
    const [token, setToken] = useState('');
    const [stats, setStats] = useState({ total: 0, active: 0, exhausted: 0 });
    const [showToken, setShowToken] = useState(false);

    // Gitee Token State
    const [giteeToken, setGiteeToken] = useState('');
    const [giteeStats, setGiteeStats] = useState({ total: 0, active: 0, exhausted: 0 });
    const [showGiteeToken, setShowGiteeToken] = useState(false);

    // Model Scope Token State
    const [msToken, setMsToken] = useState('');
    const [msStats, setMsStats] = useState({ total: 0, active: 0, exhausted: 0 });
    const [showMsToken, setShowMsToken] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Load HF
            const storedToken = localStorage.getItem('huggingFaceToken') || '';
            setToken(storedToken);
            setStats(getTokenStats(storedToken));

            // Load Gitee
            const storedGiteeToken = localStorage.getItem('giteeToken') || '';
            setGiteeToken(storedGiteeToken);
            setGiteeStats(getGiteeTokenStats(storedGiteeToken));

            // Load Model Scope
            const storedMsToken = localStorage.getItem('msToken') || '';
            setMsToken(storedMsToken);
            setMsStats(getMsTokenStats(storedMsToken));
        }
    }, [isOpen]);

    // HF Handlers
    const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setToken(newVal);
        setStats(getTokenStats(newVal));
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const text = e.clipboardData.getData('text');
        if (text.includes('\n') || text.includes('\r')) {
            e.preventDefault();
            const normalized = text.split(/[\r\n]+/).map(t => t.trim()).filter(Boolean).join(',');
            
            const input = e.currentTarget;
            const start = input.selectionStart ?? token.length;
            const end = input.selectionEnd ?? token.length;
            
            const newValue = token.substring(0, start) + normalized + token.substring(end);
            setToken(newValue);
            setStats(getTokenStats(newValue));
        }
    };

    // Gitee Handlers
    const handleGiteeTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setGiteeToken(newVal);
        setGiteeStats(getGiteeTokenStats(newVal));
    };

    const handleGiteePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const text = e.clipboardData.getData('text');
        if (text.includes('\n') || text.includes('\r')) {
            e.preventDefault();
            const normalized = text.split(/[\r\n]+/).map(t => t.trim()).filter(Boolean).join(',');
            
            const input = e.currentTarget;
            const start = input.selectionStart ?? giteeToken.length;
            const end = input.selectionEnd ?? giteeToken.length;
            
            const newValue = giteeToken.substring(0, start) + normalized + giteeToken.substring(end);
            setGiteeToken(newValue);
            setGiteeStats(getGiteeTokenStats(newValue));
        }
    };

    // Model Scope Handlers
    const handleMsTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setMsToken(newVal);
        setMsStats(getMsTokenStats(newVal));
    };

    const handleMsPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const text = e.clipboardData.getData('text');
        if (text.includes('\n') || text.includes('\r')) {
            e.preventDefault();
            const normalized = text.split(/[\r\n]+/).map(t => t.trim()).filter(Boolean).join(',');
            
            const input = e.currentTarget;
            const start = input.selectionStart ?? msToken.length;
            const end = input.selectionEnd ?? msToken.length;
            
            const newValue = msToken.substring(0, start) + normalized + msToken.substring(end);
            setMsToken(newValue);
            setMsStats(getMsTokenStats(newValue));
        }
    };

    const handleSave = () => {
        localStorage.setItem('huggingFaceToken', token.trim());
        localStorage.setItem('giteeToken', giteeToken.trim());
        localStorage.setItem('msToken', msToken.trim());
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="w-full max-w-md bg-[#0D0B14] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-white/10 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5 flex-shrink-0">
                    <h2 className="text-lg font-bold text-white">{t.settings}</h2>
                    <button onClick={onClose} className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                    {/* Language Selector */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-white/90 mb-3">
                            <Languages className="w-4 h-4 text-purple-400" />
                            {t.language}
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setLang('en')}
                                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                                    lang === 'en' 
                                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/20' 
                                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                English
                            </button>
                            <button
                                onClick={() => setLang('zh')}
                                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                                    lang === 'zh' 
                                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/20' 
                                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                中文
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-white/5 w-full"></div>

                    {/* HF Token */}
                    {provider === 'huggingface' && (
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-white/90 mb-2">
                                <KeyRound className="w-4 h-4 text-yellow-500" />
                                {t.hfToken}
                            </label>
                            <div className="relative group">
                                <input
                                    type={showToken ? "text" : "password"}
                                    value={token}
                                    onChange={handleTokenChange}
                                    onPaste={handlePaste}
                                    placeholder="hf_...,hf_..."
                                    className="w-full pl-4 pr-10 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all font-mono text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowToken(!showToken)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-1"
                                >
                                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            
                            {stats.total > 1 && (
                                <div className="mt-3 grid grid-cols-3 gap-2 animate-in fade-in duration-300">
                                    <div className="bg-white/5 rounded-lg p-2 border border-white/5 flex flex-col items-center">
                                        <span className="text-[10px] uppercase text-white/40 font-bold tracking-wider">{t.tokenTotal}</span>
                                        <div className="flex items-center gap-1.5 text-white/90 font-mono text-sm">
                                            <Database className="w-3.5 h-3.5" />
                                            {stats.total}
                                        </div>
                                    </div>
                                    <div className="bg-green-500/10 rounded-lg p-2 border border-green-500/10 flex flex-col items-center">
                                        <span className="text-[10px] uppercase text-green-400/60 font-bold tracking-wider">{t.tokenActive}</span>
                                        <div className="flex items-center gap-1.5 text-green-400 font-mono text-sm">
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            {stats.active}
                                        </div>
                                    </div>
                                    <div className="bg-red-500/10 rounded-lg p-2 border border-red-500/10 flex flex-col items-center">
                                        <span className="text-[10px] uppercase text-red-400/60 font-bold tracking-wider">{t.tokenExhausted}</span>
                                        <div className="flex items-center gap-1.5 text-red-400 font-mono text-sm">
                                            <ShieldAlert className="w-3.5 h-3.5" />
                                            {stats.exhausted}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <p className="mt-3 text-xs text-white/40 leading-relaxed">
                                {t.hfTokenHelp} <a className="text-yellow-500 hover:text-yellow-400 underline decoration-yellow-500/30" href="https://huggingface.co/settings/tokens" target="_blank">{t.hfTokenLink}</a> {t.hfTokenHelpEnd}
                            </p>
                        </div>
                    )}

                    {/* Gitee Token */}
                    {provider === 'gitee' && (
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-white/90 mb-2">
                                <KeyRound className="w-4 h-4 text-red-500" />
                                {t.giteeToken}
                            </label>
                            <div className="relative group">
                                <input
                                    type={showGiteeToken ? "text" : "password"}
                                    value={giteeToken}
                                    onChange={handleGiteeTokenChange}
                                    onPaste={handleGiteePaste}
                                    placeholder="...,..."
                                    className="w-full pl-4 pr-10 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all font-mono text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowGiteeToken(!showGiteeToken)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-1"
                                >
                                    {showGiteeToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            
                            {giteeStats.total > 1 && (
                                <div className="mt-3 grid grid-cols-3 gap-2 animate-in fade-in duration-300">
                                    <div className="bg-white/5 rounded-lg p-2 border border-white/5 flex flex-col items-center">
                                        <span className="text-[10px] uppercase text-white/40 font-bold tracking-wider">{t.tokenTotal}</span>
                                        <div className="flex items-center gap-1.5 text-white/90 font-mono text-sm">
                                            <Database className="w-3.5 h-3.5" />
                                            {giteeStats.total}
                                        </div>
                                    </div>
                                    <div className="bg-green-500/10 rounded-lg p-2 border border-green-500/10 flex flex-col items-center">
                                        <span className="text-[10px] uppercase text-green-400/60 font-bold tracking-wider">{t.tokenActive}</span>
                                        <div className="flex items-center gap-1.5 text-green-400 font-mono text-sm">
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            {giteeStats.active}
                                        </div>
                                    </div>
                                    <div className="bg-red-500/10 rounded-lg p-2 border border-red-500/10 flex flex-col items-center">
                                        <span className="text-[10px] uppercase text-red-400/60 font-bold tracking-wider">{t.tokenExhausted}</span>
                                        <div className="flex items-center gap-1.5 text-red-400 font-mono text-sm">
                                            <ShieldAlert className="w-3.5 h-3.5" />
                                            {giteeStats.exhausted}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <p className="mt-3 text-xs text-white/40 leading-relaxed">
                                {t.giteeTokenHelp} <a className="text-red-500 hover:text-red-400 underline decoration-red-500/30" href="https://ai.gitee.com/dashboard/settings/tokens" target="_blank">{t.giteeTokenLink}</a> {t.giteeTokenHelpEnd}
                            </p>
                        </div>
                    )}

                    {/* Model Scope Token */}
                    {provider === 'modelscope' && (
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-white/90 mb-2">
                                <KeyRound className="w-4 h-4 text-blue-500" />
                                {t.msToken}
                            </label>
                            <div className="relative group">
                                <input
                                    type={showMsToken ? "text" : "password"}
                                    value={msToken}
                                    onChange={handleMsTokenChange}
                                    onPaste={handleMsPaste}
                                    placeholder="...,..."
                                    className="w-full pl-4 pr-10 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowMsToken(!showMsToken)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-1"
                                >
                                    {showMsToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            
                            {msStats.total > 1 && (
                                <div className="mt-3 grid grid-cols-3 gap-2 animate-in fade-in duration-300">
                                    <div className="bg-white/5 rounded-lg p-2 border border-white/5 flex flex-col items-center">
                                        <span className="text-[10px] uppercase text-white/40 font-bold tracking-wider">{t.tokenTotal}</span>
                                        <div className="flex items-center gap-1.5 text-white/90 font-mono text-sm">
                                            <Database className="w-3.5 h-3.5" />
                                            {msStats.total}
                                        </div>
                                    </div>
                                    <div className="bg-green-500/10 rounded-lg p-2 border border-green-500/10 flex flex-col items-center">
                                        <span className="text-[10px] uppercase text-green-400/60 font-bold tracking-wider">{t.tokenActive}</span>
                                        <div className="flex items-center gap-1.5 text-green-400 font-mono text-sm">
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            {msStats.active}
                                        </div>
                                    </div>
                                    <div className="bg-red-500/10 rounded-lg p-2 border border-red-500/10 flex flex-col items-center">
                                        <span className="text-[10px] uppercase text-red-400/60 font-bold tracking-wider">{t.tokenExhausted}</span>
                                        <div className="flex items-center gap-1.5 text-red-400 font-mono text-sm">
                                            <ShieldAlert className="w-3.5 h-3.5" />
                                            {msStats.exhausted}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <p className="mt-3 text-xs text-white/40 leading-relaxed">
                                {t.msTokenHelp} <a className="text-blue-500 hover:text-blue-400 underline decoration-blue-500/30" href="https://modelscope.cn/my/myaccesstoken" target="_blank">{t.msTokenLink}</a> {t.msTokenHelpEnd}
                            </p>
                        </div>
                    )}

                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-white/[0.02] flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                        {t.cancel}
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-500 active:bg-purple-700 rounded-lg transition-colors shadow-lg shadow-purple-900/20"
                    >
                        <Save className="w-4 h-4" />
                        {t.save}
                    </button>
                </div>
            </div>
        </div>
    );
};