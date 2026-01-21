
import React from 'react';
import { Layers, Film, Plus, Brain } from 'lucide-react';
import { Select, OptionGroup } from '../Select';
import { useAppStore } from '../../store/appStore';
import { translations } from '../../translations';
import { ServiceMode, UnifiedModelOption, CustomProvider } from '../../types';
import { EDIT_MODELS, LIVE_MODELS, TEXT_MODELS, UPSCALER_MODELS } from '../../constants';

interface ModelsTabProps {
    serviceMode: ServiceMode;
    giteeToken: string;
    msToken: string;
    a4fToken: string;
    customProviders: CustomProvider[];
    editModelValue: string; setEditModelValue: (v: string) => void;
    liveModelValue: string; setLiveModelValue: (v: string) => void;
    upscalerModelValue: string; setUpscalerModelValue: (v: string) => void;
    textModelValue: string; setTextModelValue: (v: string) => void;
}

export const ModelsTab: React.FC<ModelsTabProps> = (props) => {
    const { language } = useAppStore();
    const t = translations[language];

    const cleanLabel = (label: string) => {
        return label.replace(/\s*\(HF\)$/, '').replace(/\s*\(Gitee\)$/, '').replace(/\s*\(MS\)$/, '');
    };

    const getAvailableModelGroups = (baseList: UnifiedModelOption[], type: 'generate' | 'edit' | 'video' | 'text' | 'upscaler'): OptionGroup[] => {
        const groups: OptionGroup[] = [];
        const isServer = props.serviceMode === 'server';
        const isLocal = props.serviceMode === 'local';
        const isHydration = props.serviceMode === 'hydration';

        if (isLocal || isHydration) {
            const hfOptions = baseList.filter(m => m.provider === 'huggingface').map(m => ({ value: m.value, label: cleanLabel(m.label) }));
            if (hfOptions.length > 0) groups.push({ label: t.provider_huggingface, options: hfOptions });
            
            if (props.giteeToken || localStorage.getItem('giteeToken')) {
                const giteeOptions = baseList.filter(m => m.provider === 'gitee').map(m => ({ value: m.value, label: cleanLabel(m.label) }));
                if (giteeOptions.length > 0) groups.push({ label: t.provider_gitee, options: giteeOptions });
            }
            
            if (props.msToken || localStorage.getItem('msToken')) {
                const msOptions = baseList.filter(m => m.provider === 'modelscope').map(m => ({ value: m.value, label: cleanLabel(m.label) }));
                if (msOptions.length > 0) groups.push({ label: t.provider_modelscope, options: msOptions });
            }

            if (props.a4fToken || localStorage.getItem('a4fToken')) {
                const a4fOptions = baseList.filter(m => m.provider === 'a4f').map(m => ({ value: m.value, label: cleanLabel(m.label) }));
                if (a4fOptions.length > 0) groups.push({ label: t.provider_a4f, options: a4fOptions });
            }
        }

        if (isServer || isHydration) {
            props.customProviders.forEach(cp => {
                const models = cp.models[type];
                if (models && models.length > 0) {
                    groups.push({
                        label: cp.name,
                        options: models.map(m => ({
                            label: m.name,
                            value: `${cp.id}:${m.id}`
                        }))
                    });
                }
            });
        }

        return groups;
    };

    return (
        <div className="space-y-6">
            <Select label={t.model_edit} value={props.editModelValue} onChange={props.setEditModelValue} options={getAvailableModelGroups(EDIT_MODELS, 'edit')} icon={<Layers className="w-4 h-4" />} dense />
            <Select label={t.model_live} value={props.liveModelValue} onChange={props.setLiveModelValue} options={getAvailableModelGroups(LIVE_MODELS, 'video')} icon={<Film className="w-4 h-4" />} dense />
            <Select label={t.upscale} value={props.upscalerModelValue} onChange={props.setUpscalerModelValue} options={getAvailableModelGroups(UPSCALER_MODELS, 'upscaler')} icon={<Plus className="w-4 h-4" />} dense />
            <Select label={t.model_text} value={props.textModelValue} onChange={props.setTextModelValue} options={getAvailableModelGroups(TEXT_MODELS, 'text')} icon={<Brain className="w-4 h-4" />} dense />
        </div>
    );
};
