
import React, { useState, useMemo } from 'react';
import { CostCategory, LineItem } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: LineItem[]) => void;
  libraryData?: LineItem[];
}

export const CostLibraryModal: React.FC<Props> = ({ isOpen, onClose, onImport, libraryData = [] }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(Object.values(CostCategory)));

  // Group libraryData by Category
  const groupedLibrary = useMemo(() => {
    const grouped: Record<string, LineItem[]> = {};
    Object.values(CostCategory).forEach(c => grouped[c] = []);
    
    libraryData.forEach(item => {
      if (grouped[item.category]) {
        grouped[item.category].push(item);
      }
    });
    return grouped;
  }, [libraryData]);

  if (!isOpen) return null;

  // Toggle Accordion
  const toggleCategory = (cat: string) => {
    const newSet = new Set(openCategories);
    if (newSet.has(cat)) newSet.delete(cat);
    else newSet.add(cat);
    setOpenCategories(newSet);
  };

  // Item Selection
  const toggleItem = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  // Category Bulk Selection
  const toggleCategorySelectAll = (cat: CostCategory) => {
    const items = groupedLibrary[cat] || [];
    const allIds = items.map(i => i.id);
    const newSet = new Set(selectedIds);
    
    // Check if all are currently selected
    const allSelected = allIds.every(id => newSet.has(id));

    if (allSelected) {
      // Deselect all
      allIds.forEach(id => newSet.delete(id));
    } else {
      // Select all
      allIds.forEach(id => newSet.add(id));
    }
    setSelectedIds(newSet);
  };

  const handleImport = () => {
    const itemsToImport: LineItem[] = [];
    
    // Iterate through library to find selected items
    libraryData.forEach(item => {
      if (selectedIds.has(item.id)) {
        // Clone and assign new unique ID
        itemsToImport.push({
          ...item,
          id: `IMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        });
      }
    });

    onImport(itemsToImport);
    setSelectedIds(new Set()); // Reset
    onClose();
  };

  const totalSelected = selectedIds.size;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Standard Cost Library</h2>
            <p className="text-xs text-slate-500 font-medium">Select items to import from the EstateMaster standard template.</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition-colors"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {Object.values(CostCategory).map((cat) => {
            const items = groupedLibrary[cat];
            if (!items || items.length === 0) return null;

            const isOpen = openCategories.has(cat);
            const allSelected = items.every(i => selectedIds.has(i.id));
            const someSelected = items.some(i => selectedIds.has(i.id));

            return (
              <div key={cat} className="border border-slate-200 rounded-lg overflow-hidden">
                {/* Category Header */}
                <div className="bg-slate-50 p-3 flex items-center justify-between select-none">
                  <div className="flex items-center space-x-3">
                    <button onClick={() => toggleCategory(cat)} className="text-slate-400 hover:text-blue-600 transition-colors">
                       <i className={`fa-solid fa-chevron-right transition-transform ${isOpen ? 'rotate-90' : ''}`}></i>
                    </button>
                    <span className="text-sm font-bold text-slate-700 uppercase">{cat}</span>
                    <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{items.length}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer">Select All</label>
                    <input 
                      type="checkbox" 
                      checked={allSelected}
                      ref={input => { if (input) input.indeterminate = someSelected && !allSelected; }}
                      onChange={() => toggleCategorySelectAll(cat)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Items List */}
                {isOpen && (
                  <div className="divide-y divide-slate-100 bg-white">
                    {items.map(item => {
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <div 
                          key={item.id} 
                          className={`flex items-center p-3 hover:bg-blue-50/30 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''}`}
                          onClick={() => toggleItem(item.id)}
                        >
                           <div className="pr-4">
                             <input 
                               type="checkbox" 
                               checked={isSelected}
                               onChange={() => toggleItem(item.id)}
                               className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                             />
                           </div>
                           <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1 rounded">{item.code}</span>
                                <span className={`text-sm font-bold ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>{item.description}</span>
                              </div>
                              <div className="flex items-center space-x-3 mt-1 text-[10px] text-slate-400">
                                 <span>Type: {item.inputType}</span>
                                 <span>•</span>
                                 <span>Curve: {item.method}</span>
                              </div>
                           </div>
                           <div className="text-right pl-4">
                              {item.amount > 0 ? (
                                <div className="text-xs font-mono font-bold text-slate-600">${item.amount.toLocaleString()}</div>
                              ) : (
                                <div className="text-[10px] text-slate-400 italic">User Input</div>
                              )}
                           </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 rounded-b-xl flex justify-between items-center">
           <div className="text-xs font-bold text-slate-500">
             {totalSelected} item{totalSelected !== 1 ? 's' : ''} selected
           </div>
           <div className="flex space-x-3">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleImport}
                disabled={totalSelected === 0}
                className={`px-5 py-2 text-sm font-bold text-white rounded-lg shadow-lg flex items-center transition-all ${totalSelected === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-xl'}`}
              >
                <i className="fa-solid fa-file-import mr-2"></i>
                Import Selected
              </button>
           </div>
        </div>

      </div>
    </div>
  );
};
