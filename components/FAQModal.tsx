
import React, { useState, useEffect } from 'react';
import { X, ChevronDown, KeyRound, HelpCircle, ExternalLink, Shield, Zap, Database, Globe, CloudUpload, Github, Languages, Wand2, Film, PencilRuler, HardDrive } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';

interface FAQModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const FAQModal: React.FC<FAQModalProps> = ({ isOpen, onClose }) => {
    const { language } = useAppStore();
    const t = translations[language];
    const [openIndex, setOpenIndex] = useState<number | null>(0);

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
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isRendered) return null;

    const toggleAccordion = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    const faqItems = [
        {
            icon: <Zap className="w-5 h-5 text-yellow-400" />,
            question: t.faq_q1,
            answer: t.faq_a1
        },
        {
            icon: <Shield className="w-5 h-5 text-green-400" />,
            question: t.faq_q2,
            answer: t.faq_a2
        },
        {
            icon: <KeyRound className="w-5 h-5 text-purple-400" />,
            question: t.faq_q3,
            answer: t.faq_a3
        },
        {
            icon: <Globe className="w-5 h-5 text-blue-400" />,
            question: t.faq_q4,
            answer: (
                <div className="space-y-2">
                    <p>
                        {t.faq_a4_hf_pre} 
                        <a href="https://huggingface.co/" target="_blank" className="text-purple-400 hover:text-purple-300 mx-1 underline decoration-purple-400/30 inline-flex items-center gap-0.5 hover:decoration-purple-300 transition-colors">
                            Hugging Face <ExternalLink className="w-3 h-3" />
                        </a>
                        {t.faq_a4_hf_mid}
                        <a href="https://pollinations.ai/" target="_blank" className="text-purple-400 hover:text-purple-300 mx-1 underline decoration-purple-400/30 inline-flex items-center gap-0.5 hover:decoration-purple-300 transition-colors">
                            Pollinations.ai <ExternalLink className="w-3 h-3" />
                        </a>
                        {t.faq_a4_hf_post}
                    </p>
                    <p>
                        {t.faq_a4_gitee_pre}
                        <a href="https://ai.gitee.com/" target="_blank" className="text-purple-400 hover:text-purple-300 mx-1 underline decoration-purple-400/30 inline-flex items-center gap-0.5 hover:decoration-purple-300 transition-colors">
                            Gitee AI <ExternalLink className="w-3 h-3" />
                        </a>
                        {t.faq_a4_gitee_post}
                    </p>
                    <p>
                        {t.faq_a4_ms_pre}
                        <a href="https://modelscope.cn/" target="_blank" className="text-purple-400 hover:text-purple-300 mx-1 underline decoration-purple-400/30 inline-flex items-center gap-0.5 hover:decoration-purple-300 transition-colors">
                            Model Scope <ExternalLink className="w-3 h-3" />
                        </a>
                        {t.faq_a4_ms_post}
                    </p>
                </div>
            )
        },
        {
            icon: <Languages className="w-5 h-5 text-pink-400" />,
            question: t.faq_q6,
            answer: t.faq_a6
        },
        {
            icon: <Wand2 className="w-5 h-5 text-cyan-400" />,
            question: t.faq_q7,
            answer: t.faq_a7
        },
        {
            icon: <Film className="w-5 h-5 text-red-400" />,
            question: t.faq_q8,
            answer: t.faq_a8
        },
        {
            icon: <PencilRuler className="w-5 h-5 text-indigo-400" />,
            question: t.faq_q9,
            answer: t.faq_a9
        },
        {
            icon: <HardDrive className="w-5 h-5 text-emerald-400" />,
            question: t.faq_q10,
            answer: t.faq_a10
        },
        {
            icon: <Database className="w-5 h-5 text-teal-400" />,
            question: t.faq_q11,
            answer: t.faq_a11
        },
        {
            icon: <CloudUpload className="w-5 h-5 text-orange-400" />,
            question: t.faq_q5,
            answer: t.faq_a5
        }
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-3 md:px-4">
             {/* Backdrop: Immediate In, Delayed Out */}
             <div 
                className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0 delay-200'}`}
                onClick={onClose}
             />

             {/* Modal: Delayed In, Immediate Out */}
             <div className={`relative w-full max-w-2xl bg-[#0D0B14]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-[0_0_50px_-12px_rgba(124,58,237,0.15)] ring-1 ring-white/[0.05] overflow-hidden flex flex-col h-[85vh] md:h-auto md:max-h-[85vh] transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1) ${isVisible ? 'scale-100 opacity-100 translate-y-0 delay-100' : 'scale-95 opacity-0 translate-y-4'}`}>
                <div className="flex items-center justify-between px-4 py-2 md:px-5 border-b border-white/[0.06] bg-white/[0.02] flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                            <HelpCircle className="w-5 h-5 text-purple-400" />
                        </div>
                        <h2 className="text-lg font-bold text-white tracking-wide">FAQ</h2>
                    </div>
                    <button onClick={onClose} className="group p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-all duration-200">
                        <X className="w-5 h-5 transition-transform duration-500 ease-out group-hover:rotate-180" />
                    </button>
                </div>
                
                <div className="flex-1 p-4 md:p-5 overflow-y-auto custom-scrollbar">
                    <div className="space-y-3">
                        {faqItems.map((item, index) => (
                            <div 
                                key={index} 
                                className={`border rounded-xl transition-all duration-300 overflow-hidden ${openIndex === index ? 'bg-white/[0.03] border-purple-500/30 shadow-[0_0_20px_-5px_rgba(168,85,247,0.1)]' : 'bg-transparent border-white/[0.05] hover:bg-white/[0.02] hover:border-white/10'}`}
                            >
                                <button
                                    onClick={() => toggleAccordion(index)}
                                    className="w-full flex items-center justify-between p-3 md:p-4 text-left select-none group"
                                >
                                    <div className="flex items-center gap-4 flex-1 min-w-0 pr-2">
                                        <div className={`flex-shrink-0 p-2.5 rounded-xl bg-black/20 border border-white/[0.05] transition-all duration-300 ${openIndex === index ? 'opacity-100 scale-100 bg-white/5' : 'opacity-60 scale-95 group-hover:opacity-80'}`}>
                                            {item.icon}
                                        </div>
                                        <span className={`font-medium transition-colors duration-300 break-words leading-tight ${openIndex === index ? 'text-white' : 'text-white/80 group-hover:text-white/90'}`}>
                                            {item.question}
                                        </span>
                                    </div>
                                    <div className={`flex-shrink-0 transition-transform duration-500 ease-out ${openIndex === index ? 'rotate-180' : 'rotate-0'}`}>
                                        <ChevronDown className={`w-5 h-5 ${openIndex === index ? 'text-purple-400' : 'text-white/30 group-hover:text-white/50'}`} />
                                    </div>
                                </button>
                                
                                <div 
                                    className={`grid transition-[grid-template-rows] duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${
                                        openIndex === index ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                                    }`}
                                >
                                    <div className="overflow-hidden">
                                        <div className="px-4 pb-4 md:pl-[4.75rem] pr-6">
                                            <div className={`text-sm text-white/60 leading-relaxed border-t border-white/[0.05] pt-3 transition-opacity duration-500 delay-100 ${openIndex === index ? 'opacity-100' : 'opacity-0'}`}>
                                                {item.answer}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-purple-900/10 to-blue-900/10 border border-white/[0.05] text-center group hover:border-white/10 transition-colors">
                        <a 
                            href="https://github.com/Amery2010/peinture" 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-white/40 group-hover:text-white/80 transition-colors flex items-center justify-center gap-2"
                        >
                            <Github className="w-4 h-4" />
                            {t.footer_license}
                        </a>
                    </div>
                </div>

                <div className="flex items-center justify-end px-4 py-2 md:px-5 border-t border-white/[0.06] bg-white/[0.02] flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-sm font-medium text-white/90 bg-white/10 hover:bg-white/15 rounded-lg transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-black/20"
                    >
                        {t.close}
                    </button>
                </div>
            </div>
        </div>
    );
};
