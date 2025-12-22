
import React, { useState } from 'react';
import { GLOSSARY, GlossaryTerm } from '../glossary';

interface Props {
  term?: GlossaryTerm;
  text?: string;
  className?: string;
}

export const HelpTooltip: React.FC<Props> = ({ term, text, className = "text-slate-400" }) => {
  const [isVisible, setIsVisible] = useState(false);
  const definition = term ? GLOSSARY[term] : text;

  if (!definition) return null;

  return (
    <div 
      className="relative inline-flex items-center ml-1.5 group z-50"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onClick={(e) => { e.stopPropagation(); setIsVisible(!isVisible); }}
    >
      <i className={`fa-solid fa-circle-question text-[10px] cursor-help ${className} hover:text-blue-500 transition-colors`}></i>
      
      {/* Tooltip Popup */}
      <div 
        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 text-white text-[11px] font-medium p-3 rounded-lg shadow-xl border border-slate-700 pointer-events-none transition-all duration-200 origin-bottom ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        style={{ zIndex: 9999 }}
      >
        {/* Term Title */}
        {term && (
          <div className="font-bold text-blue-300 uppercase text-[9px] mb-1 tracking-wider border-b border-slate-700 pb-1">
            {term.replace(/_/g, ' ')}
          </div>
        )}
        
        {/* Content */}
        <p className="leading-relaxed">{definition}</p>
        
        {/* Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
      </div>
    </div>
  );
};
