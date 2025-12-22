
// ... existing imports ...
import { PdfService } from './services/pdfService';

// ... inside FeasibilityEngine component ...

  const handleExportPdf = async () => {
      setIsGeneratingPdf(true);
      
      // Delay slightly to allow UI to update
      setTimeout(async () => {
        try {
            // Updated to call the BOARD REPORT generator
            await PdfService.generateBoardReport(
                site,
                currentScenarioState,
                stats,
                cashflow,
                site.dna
            );
        } catch (e) {
            console.error("PDF Generation Error", e);
            alert("Failed to generate PDF. Check console for details.");
        } finally {
            setIsGeneratingPdf(false);
        }
      }, 100);
  };

// ... inside the render return, locate the reports tab buttons ...

            {activeTab === 'reports' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-6 no-print bg-slate-50/95 backdrop-blur sticky top-0 z-30 pt-2 px-1">
                    <div className="w-1/3 hidden md:block"></div>
                    <nav className="flex space-x-4">
                      <button onClick={() => setReportSubTab('pnl')} className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors ${reportSubTab === 'pnl' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Profit & Loss</button>
                      <button onClick={() => setReportSubTab('cashflow')} className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors ${reportSubTab === 'cashflow' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Detailed Cashflow</button>
                    </nav>
                    <div className="w-1/3 flex justify-end">
                       <button 
                         onClick={handleExportPdf}
                         disabled={isGeneratingPdf}
                         className={`flex items-center text-[10px] font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg transition-all shadow-sm disabled:opacity-50 ${isGeneratingPdf ? 'w-48 justify-center' : ''}`}
                       >
                         {isGeneratingPdf ? (
                             <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Processing...</>
                         ) : (
                             <><i className="fa-solid fa-file-invoice mr-2"></i> Feastudy Report (PDF)</>
                         )}
                       </button>
                    </div>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {reportSubTab === 'pnl' && (
                      <FeasibilityReport 
                          scenario={currentScenarioState} 
                          siteDNA={site.dna}
                          site={site}
                          stats={stats} 
                          onNavigate={handleReportNavigation}
                      />
                    )}
                    {reportSubTab === 'cashflow' && <ConsolidatedCashflowReport cashflow={cashflow} settings={settings} />}
                </div>
              </div>
            )}
// ... rest of file ...
