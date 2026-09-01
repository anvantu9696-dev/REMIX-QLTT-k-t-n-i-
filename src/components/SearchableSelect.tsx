import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Chọn...',
  disabled = false,
  required = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => String(o.value) === String(value));

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div 
        className={`w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? 'text-white text-xs' : 'text-slate-500 text-xs'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {required && (
        <input 
          type="text" 
          value={value} 
          onChange={() => {}} 
          className="absolute opacity-0 pointer-events-none w-0 h-0 bottom-0" 
          required 
        />
      )}
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-h-60 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-slate-800 shrink-0 bg-slate-950">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                autoFocus
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                placeholder="Tìm kiếm..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-y-auto p-1 scrollbar-thin">
            {options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())).map((o, _idx) => (
              <div
                key={`${o.value}-${_idx}`}
                className={`px-3 py-2 text-xs rounded-lg cursor-pointer transition-colors ${String(o.value) === String(value) ? 'bg-blue-600/20 text-blue-400 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                onClick={() => {
                  onChange(String(o.value));
                  setIsOpen(false);
                  setSearch('');
                }}
              >
                {o.label}
              </div>
            ))}
            {options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())).length === 0 && (
              <div className="px-3 py-4 text-xs text-slate-500 text-center">Không tìm thấy kết quả</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
