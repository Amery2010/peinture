
import React from 'react';
import { Lock } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';

interface AuthModalProps {
    isOpen: boolean;
    passwordValue: string;
    onPasswordChange: (val: string) => void;
    onSubmit: () => void;
    onSwitchLocal: () => void;
    error: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
    isOpen, 
    passwordValue, 
    onPasswordChange, 
    onSubmit, 
    onSwitchLocal, 
    error 
}) => {
    const { language } = useAppStore();
    const t = translations[language];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-[#0D0B14] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4">
                <div className="p-3 bg-red-500/10 rounded-full">
                    <Lock className="w-8 h-8 text-red-400" />
                </div>
                <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-2">{t.access_password_title}</h3>
                    <p className="text-white/60 text-sm">{t.access_password_desc}</p>
                </div>
                
                <input 
                    type="password" 
                    value={passwordValue}
                    onChange={(e) => onPasswordChange(e.target.value)}
                    placeholder={t.access_password_placeholder}
                    className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white text-center focus:outline-none transition-colors ${error ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-purple-500'}`}
                    onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
                />
                
                {error && (
                    <p className="text-red-400 text-xs font-medium">{t.access_password_invalid}</p>
                )}

                <div className="flex flex-col w-full gap-2 mt-2">
                    <button 
                        onClick={onSubmit}
                        disabled={!passwordValue}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t.confirm}
                    </button>
                    <button 
                        onClick={onSwitchLocal}
                        className="w-full py-3 bg-transparent hover:bg-white/5 text-white/60 hover:text-white font-medium rounded-xl transition-all text-sm"
                    >
                        {t.switch_to_local}
                    </button>
                </div>
            </div>
        </div>
    );
};
