
import React from 'react';
import { MessageSquare, Languages, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { translations } from '../../translations';
import { DEFAULT_SYSTEM_PROMPT_CONTENT, DEFAULT_TRANSLATION_SYSTEM_PROMPT } from '../../services/utils';

interface PromptTabProps {
    systemPrompt: string;
    setSystemPrompt: (v: string) => void;
    translationPrompt: string;
    setTranslationPrompt: (v: string) => void;
}

export const PromptTab: React.FC<PromptTabProps> = ({ 
    systemPrompt, setSystemPrompt, 
    translationPrompt, setTranslationPrompt 
}) => {
    const { language } = useAppStore();
    const t = translations[language];

    const handleRestoreDefault = () => setSystemPrompt(DEFAULT_SYSTEM_PROMPT_CONTENT);
    const handleRestoreTranslationDefault = () => setTranslationPrompt(DEFAULT_TRANSLATION_SYSTEM_PROMPT);

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-medium text-white/80"><MessageSquare className="w-4 h-4 text-pink-400" />{t.systemPrompts}</label>
                    <button onClick={handleRestoreDefault} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white bg-white/5 hover:bg-white/10 transition-colors border border-transparent hover:border-white/10" title={t.restoreDefault}><RotateCcw className="w-3.5 h-3.5" />{t.restoreDefault}</button>
                </div>
                <div className="relative group"><textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder={t.promptContent} className="w-full h-28 bg-white/[0.03] border border-white/10 rounded-xl p-4 text-sm text-white/80 placeholder:text-white/20 focus:outline-0 focus:ring-4 focus:ring-pink-500/10 focus:border-pink-500/50 hover:border-white/20 resize-none custom-scrollbar leading-relaxed font-mono transition-all duration-300 ease-out" /></div>
            </div>
            <div className="space-y-4">
                <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-white/80"><Languages className="w-4 h-4 text-blue-400" />{t.translationPrompt}</label>
                    <button onClick={handleRestoreTranslationDefault} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white bg-white/5 hover:bg-white/10 transition-colors border border-transparent hover:border-white/10" title={t.restoreDefault}><RotateCcw className="w-3.5 h-3.5" />{t.restoreDefault}</button>
                </div>
                <div className="relative group"><textarea value={translationPrompt} onChange={(e) => setTranslationPrompt(e.target.value)} placeholder={t.promptContent} className="w-full h-28 bg-white/[0.03] border border-white/10 rounded-xl p-4 text-sm text-white/80 placeholder:text-white/20 focus:outline-0 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 hover:border-white/20 resize-none custom-scrollbar leading-relaxed font-mono transition-all duration-300 ease-out" /></div>
            </div>
        </div>
    );
};
