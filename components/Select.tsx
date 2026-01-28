
import React, { useState, useRef, useEffect } from 'react';
import { ChevronsUpDown, Check } from 'lucide-react';

export interface Option {
  value: string;
  label: string;
}

export interface OptionGroup {
  label: string;
  options: Option[];
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: (Option | OptionGroup)[];
  icon?: React.ReactNode;
  headerContent?: React.ReactNode;
  dense?: boolean;
  horizontal?: boolean;
}

export const Select: React.FC<SelectProps> = ({ label, value, onChange, options, icon, headerContent, dense = false, horizontal = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number>(300);
  const [menuPosition, setMenuPosition] = useState<'top' | 'bottom'>('bottom');

  // Helper to flatten options for finding selected label
  const flattenedOptions = options.flatMap(opt => 
    'options' in opt ? opt.options : [opt]
  );

  const selectedOption = flattenedOptions.find(opt => opt.value === value) || flattenedOptions[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        // Estimate height based on options count (approx 36px per item + padding)
        // Or default to max allowed height
        const estimatedHeight = Math.min(300, flattenedOptions.length * 40 + 40);

        // If not enough space below, but enough space above, flip to top
        if (spaceBelow < estimatedHeight && spaceAbove > estimatedHeight) {
            setMenuPosition('top');
            // Recalculate max height for top position if needed (constrained by space above)
            const calculatedMaxHeight = Math.max(120, Math.min(300, spaceAbove - 20));
            setMaxHeight(calculatedMaxHeight);
        } else {
            setMenuPosition('bottom');
            // Recalculate max height for bottom position
            const calculatedMaxHeight = Math.max(120, Math.min(300, spaceBelow - 20));
            setMaxHeight(calculatedMaxHeight);
        }
    }
  }, [isOpen, flattenedOptions.length]);

  const renderOption = (option: Option) => (
    <button
      key={option.value}
      onClick={() => {
        onChange(option.value);
        setIsOpen(false);
      }}
      className={`
        w-full flex items-center justify-between px-4 py-2.5 text-sm text-left
        transition-colors hover:bg-white/10
        ${option.value === value ? 'text-purple-400 bg-white/5' : 'text-white/80'}
      `}
    >
      <span className="truncate mr-2">{option.label}</span>
      {option.value === value && <Check className="w-4 h-4 flex-shrink-0" />}
    </button>
  );

  return (
    <div className={`group relative ${horizontal ? 'flex items-center gap-4' : ''}`} ref={containerRef}>
      <div className={horizontal ? 'w-1/3 flex-shrink-0' : `flex items-center justify-between ${dense ? 'pb-1.5' : 'pb-3'}`}>
        <p className={`text-white font-medium leading-normal group-focus-within:text-purple-400 transition-colors ${dense ? 'text-sm' : 'text-lg'} ${horizontal ? 'truncate' : ''}`}>
          {label}
        </p>
        {!horizontal && headerContent}
      </div>
      
      <div className={horizontal ? 'w-2/3 relative' : 'relative'}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`
              relative w-full flex items-center justify-between rounded-lg 
              text-white/90 border border-white/10 bg-white/5 
              focus:outline-0 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500
              transition-all px-4 text-sm font-medium
              ${isOpen ? 'ring-2 ring-purple-500/50 border-purple-500' : ''}
              ${dense ? 'h-10' : 'h-12'}
            `}
          >
            <div className="flex items-center gap-3 overflow-hidden">
                {icon && <span className="text-white/40 flex-shrink-0">{icon}</span>}
                <span className="truncate">{selectedOption?.label || value}</span>
            </div>
            <ChevronsUpDown className="text-white/40 w-5 h-5 flex-shrink-0 ml-2" />
          </button>

          <div 
            className={`
              absolute z-50 w-full left-0
              grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out 
              ${menuPosition === 'top' ? 'bottom-full mb-2 origin-bottom' : 'top-full mt-2 origin-top'}
              ${isOpen 
                  ? 'grid-rows-[1fr] opacity-100 translate-y-0' 
                  : `grid-rows-[0fr] opacity-0 pointer-events-none ${menuPosition === 'top' ? 'translate-y-2' : '-translate-y-2'}`
              }
            `}
          >
            <div className="overflow-hidden">
              <div className="bg-[#1A1625] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                <div 
                  className="overflow-y-auto py-2 custom-scrollbar"
                  style={{ maxHeight: `${maxHeight}px` }}
                >
                  {options.map((item, index) => {
                    if ('options' in item) {
                      // Optimization: If a group has no options, do not render the header
                      if (item.options.length === 0) return null;

                      return (
                        <div key={item.label || index} className="mb-1 last:mb-0">
                          <div className="px-4 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-wider flex items-center gap-2">
                             {item.label}
                             <div className="h-px bg-white/10 flex-1"></div>
                          </div>
                          {item.options.map(opt => renderOption(opt))}
                        </div>
                      );
                    } else {
                      return renderOption(item);
                    }
                  })}
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};
