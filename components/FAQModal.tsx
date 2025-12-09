
import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, HelpCircle, ExternalLink, Shield, Zap, Database, Globe, CloudUpload, Github } from 'lucide-react';

interface FAQModalProps {
    isOpen: boolean;
    onClose: () => void;
    t: any;
}

export const FAQModal: React.FC<FAQModalProps> = ({ isOpen, onClose, t }) => {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    if (!isOpen) return null;

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
            icon: <Database className="w-5 h-5 text-purple-400" />,
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
                        <a href="https://huggingface.co/" target="_blank" className="text-purple-400 hover:text-purple-300 mx-1 underline decoration-purple-400/30 inline-flex items-center gap-0.5">
                            Hugging Face <ExternalLink className="w-3 h-3" />
                        </a>
                        {t.faq_a4_hf_mid}
                        <a href="https://pollinations.ai/" target="_blank" className="text-purple-400 hover:text-purple-300 mx-1 underline decoration-purple-400/30 inline-flex items-center gap-0.5">
                            Pollinations.ai <ExternalLink className="w-3 h-3" />
                        </a>
                        {t.faq_a4_hf_post}
                    </p>
                    <p>
                        {t.faq_a4_gitee_pre}
                        <a href="https://ai.gitee.com/" target="_blank" className="text-purple-400 hover:text-purple-300 mx-1 underline decoration-purple-400/30 inline-flex items-center gap-0.5">
                            Gitee AI <ExternalLink className="w-3 h-3" />
                        </a>
                        {t.faq_a4_gitee_post}
                    </p>
                    <p>
                        {t.faq_a4_ms_pre}
                        <a href="https://modelscope.cn/" target="_blank" className="text-purple-400 hover:text-purple-300 mx-1 underline decoration-purple-400/30 inline-flex items-center gap-0.5">
                            Model Scope <ExternalLink className="w-3 h-3" />
                        </a>
                        {t.faq_a4_ms_post}
                    </p>
                </div>
            )
        },
        {
            icon: <CloudUpload className="w-5 h-5 text-orange-400" />,
            question: t.faq_q5,
            answer: t.faq_a5
        }
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-3 md:px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="w-full max-w-2xl bg-[#0D0B14] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-white/10 flex flex-col h-[85vh] md:h-auto md:max-h-[85vh]">
                <div className="flex items-center justify-between px-5 py-4 md:px-6 border-b border-white/5 bg-white/5 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-purple-400" />
                        <h2 className="text-lg font-bold text-white">FAQ</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar">
                    <div className="space-y-3">
                        {faqItems.map((item, index) => (
                            <div 
                                key={index} 
                                className={`border rounded-xl transition-all duration-300 ${openIndex === index ? 'bg-white/5 border-purple-500/30' : 'bg-transparent border-white/5 hover:bg-white/[0.02]'}`}
                            >
                                <button
                                    onClick={() => toggleAccordion(index)}
                                    className="w-full flex items-center justify-between p-3 md:p-4 text-left select-none"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                                        <div className={`flex-shrink-0 p-2 rounded-lg bg-black/20 border border-white/5 transition-opacity duration-300 ${openIndex === index ? 'opacity-100' : 'opacity-70'}`}>
                                            {item.icon}
                                        </div>
                                        <span className={`font-medium transition-colors duration-300 break-words leading-tight ${openIndex === index ? 'text-white' : 'text-white/80'}`}>
                                            {item.question}
                                        </span>
                                    </div>
                                    <div className={`flex-shrink-0 transition-transform duration-300 ${openIndex === index ? 'rotate-180' : 'rotate-0'}`}>
                                        <ChevronDown className={`w-5 h-5 ${openIndex === index ? 'text-purple-400' : 'text-white/30'}`} />
                                    </div>
                                </button>
                                
                                <div 
                                    className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                                        openIndex === index ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                                    }`}
                                >
                                    <div className="overflow-hidden">
                                        <div className="px-4 pb-4 md:pl-[4.5rem]">
                                            <div className={`text-sm text-white/60 leading-relaxed border-t border-white/5 pt-3 transition-opacity duration-500 delay-100 ${openIndex === index ? 'opacity-100' : 'opacity-0'}`}>
                                                {item.answer}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-white/5 text-center group hover:border-white/10 transition-colors">
                        <a 
                            href="https://github.com/Amery2010/peinture" 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-white/40 group-hover:text-white/90 transition-colors flex items-center justify-center gap-2"
                        >
                            <Github className="w-4 h-4" />
                            {t.footer_license}
                        </a>
                    </div>
                </div>

                <div className="flex items-center justify-end px-5 py-4 md:px-6 border-t border-white/5 bg-white/[0.02] flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        {t.close}
                    </button>
                </div>
            </div>
        </div>
    );
};
