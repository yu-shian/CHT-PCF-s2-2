
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Search, X } from 'lucide-react';
import { MaterialFactor } from '../types';

interface SearchableSelectProps {
  options: MaterialFactor[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null); 
  
  useEffect(() => {
    const selected = options.find(o => o.id === value);
    if (selected) {
      setSearchTerm(`${selected.name} (${selected.factor} ${selected.unit1}/${selected.unit2})`);
    } else if (value === '') {
      setSearchTerm('');
    }
  }, [value, options]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  useEffect(() => {
     if (isOpen && wrapperRef.current) {
         const rect = wrapperRef.current.getBoundingClientRect();
         setPosition({
             top: rect.bottom + window.scrollY, 
             left: rect.left + window.scrollX,
             width: rect.width
         });
     }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const isClickInsideInput = wrapperRef.current && wrapperRef.current.contains(event.target as Node);
      const isClickInsideDropdown = dropdownRef.current && dropdownRef.current.contains(event.target as Node);

      if (!isClickInsideInput && !isClickInsideDropdown) {
        setIsOpen(false);
        const selected = options.find(o => o.id === value);
        if (selected) {
            setSearchTerm(`${selected.name} (${selected.factor} ${selected.unit1}/${selected.unit2})`);
        } else if (value === '') {
            setSearchTerm(''); 
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, options]);

  const filteredOptions = options.filter(opt => {
     const label = `${opt.name} (${opt.factor} ${opt.unit1}/${opt.unit2})`;
     return label.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const portalContent = isOpen ? (
    <div 
      ref={dropdownRef} 
      className="fixed z-[9999] bg-white border border-gray-300 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-2xl text-sm font-sans ring-1 ring-black ring-opacity-5 animate-in fade-in slide-in-from-top-2 duration-100"
      style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: `${position.width}px`
      }}
    >
      {filteredOptions.length > 0 ? (
        filteredOptions.map(opt => (
          <div 
            key={opt.id}
            className={`px-4 py-3 cursor-pointer hover:bg-blue-50 border-b border-gray-50 last:border-none transition-colors ${opt.id === value ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700'}`}
            onMouseDown={() => {
                onChange(opt.id);
                setIsOpen(false);
            }}
          >
            <div className="font-semibold">{opt.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">
                係數: {opt.factor} {opt.unit1}/${opt.unit2}
            </div>
          </div>
        ))
      ) : (
        <div className="px-4 py-3 text-gray-400 italic">無符合結果</div>
      )}
    </div>
  ) : null;

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          className="w-full bg-white border rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 border-gray-300 transition-all placeholder:text-gray-400 text-slate-900 font-medium"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 flex items-center">
           {searchTerm && (
               <X 
                 size={16} 
                 className="cursor-pointer hover:text-gray-600 mr-1"
                 onClick={(e) => {
                     e.stopPropagation();
                     onChange(''); 
                     setSearchTerm('');
                     setIsOpen(true);
                 }}
               />
           )}
           {!searchTerm && <Search size={16} />}
        </div>
      </div>
      {ReactDOM.createPortal(portalContent, document.body)}
    </div>
  );
};

export default SearchableSelect;
