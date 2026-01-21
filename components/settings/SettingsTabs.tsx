
import React, { useRef, useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

export interface SettingsTabItem {
    id: string;
    icon: React.ElementType;
    label: string;
}

interface SettingsTabsProps {
    tabs: SettingsTabItem[];
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

export const SettingsTabs: React.FC<SettingsTabsProps> = ({ tabs, activeTab, setActiveTab }) => {
    const tabsRef = useRef<HTMLDivElement>(null);
    const [canScrollTabs, setCanScrollTabs] = useState(false);

    const checkTabsScroll = () => {
        if (tabsRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
            setCanScrollTabs(scrollLeft + clientWidth < scrollWidth - 5);
        }
    };

    useEffect(() => {
        checkTabsScroll();
        window.addEventListener('resize', checkTabsScroll);
        return () => window.removeEventListener('resize', checkTabsScroll);
    }, [tabs]);

    // Auto-scroll active tab into view
    useEffect(() => {
        if (tabsRef.current) {
            const activeBtn = tabsRef.current.querySelector(`button[data-tab-id="${activeTab}"]`);
            if (activeBtn) {
                activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [activeTab]);

    const handleScrollTabsRight = () => {
        if (tabsRef.current) {
            tabsRef.current.scrollBy({ left: 150, behavior: 'smooth' });
            setTimeout(checkTabsScroll, 300);
        }
    };

    return (
        <div className="relative border-b border-white/[0.06]">
            <div 
                ref={tabsRef}
                onScroll={checkTabsScroll}
                className="flex items-center px-5 space-x-6 overflow-x-auto scrollbar-hide pr-12"
            >
                {tabs.map((tab) => (
                    <button 
                        key={tab.id}
                        data-tab-id={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`group relative py-4 text-sm font-medium transition-colors duration-300 flex items-center gap-2 flex-shrink-0 ${activeTab === tab.id ? 'text-white' : 'text-white/40 hover:text-white/80'}`}
                    >
                        <tab.icon className={`w-4 h-4 transition-colors duration-300 ${activeTab === tab.id ? 'text-purple-400' : 'text-current group-hover:text-purple-400/70'}`} />
                        {tab.label}
                        <span className={`absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full shadow-[0_-2px_10px_rgba(168,85,247,0.1)] transition-all duration-300 ease-out origin-center ${activeTab === tab.id ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`} />
                    </button>
                ))}
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0D0B14] via-[#0D0B14]/80 to-transparent flex items-center justify-center pointer-events-none">
                <button
                    onClick={handleScrollTabsRight}
                    disabled={!canScrollTabs}
                    className={`pointer-events-auto p-1.5 rounded-full transition-all duration-300 ${canScrollTabs ? 'text-white bg-white/10 hover:bg-white/20 shadow-lg' : 'text-white/20'}`}
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
