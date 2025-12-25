
import React, { useState, useMemo } from 'react';
import { LeadStatus, ProjectStage } from './types-v2'; // Use V2 types
import { Site, FeasibilityScenario } from './types-v2';
import { createDefaultScenario } from './constants';
import { SiteDNAHub } from './components/SiteDNAHub';
import { AppShell } from './components/AppShell';
import { ProjectLayout } from './ProjectLayout';
import { useProject } from './contexts/SiteContext';
import { GlobalFeasibilityList } from './components/GlobalFeasibilityList';
import { AdminSettings } from './AdminSettings';
import { FinanceEngine } from './services/financeEngine';

// --- Types ---
type ViewMode = 'cards' | 'list' | 'map';

// --- Components ---

const MetricCard = ({ label, value, subtext, colorClass, icon }: { label: string, value: string, subtext?: string, colorClass: string, icon: string }) => (
  <div className={`bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group`}>
      <div className={`absolute top-0 left-0 w-1 h-full ${colorClass.replace('bg-', 'bg-opacity-100 bg-')}`}></div>
      <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
          <div className="flex items-baseline space-x-2">
             <h3 className="text-2xl font-black text-slate-800">{value}</h3>
             {subtext && <span className="text-[10px] font-bold text-slate-400">{subtext}</span>}
          </div>
      </div>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${colorClass} bg-opacity-10`}>
          <i className={`fa-solid ${icon} ${colorClass.replace('bg-', 'text-').replace('-100', '-600')}`}></i>
      </div>
  </div>
);

const ProgressBar = ({ stage }: { stage: ProjectStage }) => {
    let percent = 10;
    if (stage === 'Acquisition') percent = 30;
    if (stage === 'Planning') percent = 50;
    if (stage === 'Construction') percent = 75;
    if (stage === 'Sales' || stage === 'Asset Management') percent = 100;

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Project Progress</span>
                <span className="text-[9px] font-bold text-slate-600 uppercase">{stage}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-1000" 
                    style={{ width: `${percent}%` }}
                ></div>
            </div>
        </div>
    );
};

interface SiteCardProps {
    site: Site;
    onClick: () => void;
    onOpen: (e: React.MouseEvent) => void;
}

const SiteCard: React.FC<SiteCardProps> = ({ site, onClick, onOpen }) => {
    // Extract Baseline Metrics
    const baseline = site.scenarios.find(s => s.isBaseline) || site.scenarios[0];
    let margin = 0;
    
    if (baseline) {
        // Quick calc or cached metrics would be better, but we calc on fly for now
        const cashflow = FinanceEngine.calculateMonthlyCashflow(baseline, site);
        // Fix: Added missing 'site' argument to calculateProjectMetrics
        const metrics = FinanceEngine.calculateProjectMetrics(cashflow, baseline.settings, site);
        margin = metrics.devMarginPct;
    }

    const statusColors = {
        'Prospect': 'bg-blue-100 text-blue-700',
        'Due Diligence': 'bg-purple-100 text-purple-700',
        'Acquired': 'bg-emerald-100 text-emerald-700',
        'Archive': 'bg-slate-100 text-slate-500'
    };

    return (
        <div 
            onClick={onClick}
            className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-300 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
        >
            {/* Hero Image Section */}
            <div className="h-40 relative overflow-hidden bg-slate-200">
                <img 
                    src={site.thumbnail} 
                    alt={site.name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent opacity-60"></div>
                
                <div className="absolute top-3 right-3">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide shadow-sm ${statusColors[site.status]}`}>
                        {site.status}
                    </span>
                </div>

                <div className="absolute bottom-3 left-4 text-white">
                    <div className="flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider opacity-80 mb-0.5">
                        <i className="fa-solid fa-map-pin"></i> 
                        <span>{site.identity.lga}</span>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="p-5 flex-1 flex flex-col">
                <div className="mb-4">
                    <h3 className="text-lg font-black text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors mb-1">
                        {site.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium flex items-center">
                        <span className="font-mono text-slate-400 mr-2">{site.code}</span>
                        {site.identity.address}
                    </p>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-px bg-slate-100 border border-slate-100 rounded-lg overflow-hidden mb-5">
                    <div className="bg-white p-2.5">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Land Area</span>
                        <span className="block text-xs font-bold text-slate-700">{site.identity.landArea.toLocaleString()} m²</span>
                    </div>
                    <div className="bg-white p-2.5">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Purchase</span>
                        <span className="block text-xs font-bold text-slate-700">${(site.acquisition.purchasePrice / 1000000).toFixed(2)}M</span>
                    </div>
                    <div className="bg-white p-2.5">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Scenarios</span>
                        <span className="block text-xs font-bold text-slate-700">{site.scenarios.length} Models</span>
                    </div>
                    <div className="bg-white p-2.5">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Best Margin</span>
                        <span className={`block text-xs font-black ${margin >= 15 ? 'text-emerald-600' : 'text-amber-500'}`}>
                            {margin > 0 ? margin.toFixed(1) + '%' : '-'}
                        </span>
                    </div>
                </div>

                <div className="mb-4">
                    <ProgressBar stage={site.stage} />
                </div>

                <div className="flex items-center space-x-4 text-[10px] font-bold text-slate-400 mt-auto pt-4 border-t border-slate-50">
                    <span className="flex items-center">
                        <i className={`fa-solid fa-check mr-1.5 ${site.openTasks > 0 ? 'text-indigo-500' : ''}`}></i> 
                        {site.openTasks} Tasks
                    </span>
                    <span className="flex items-center">
                        <i className={`fa-regular fa-file-lines mr-1.5 ${site.openRFIs > 0 ? 'text-amber-500' : ''}`}></i>
                        {site.openRFIs} RFIs
                    </span>
                    <span className="ml-auto font-normal">
                        Updated {new Date(site.updatedAt).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                    </span>
                </div>
            </div>

            {/* Hover Footer */}
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-between items-center transition-opacity opacity-0 group-hover:opacity-100 absolute bottom-0 left-0 w-full translate-y-full group-hover:translate-y-0 duration-200">
                <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">
                        PM
                    </div>
                    <span className="text-xs font-bold text-slate-600">{site.projectManager || 'Unassigned'}</span>
                </div>
                <button 
                    onClick={onOpen}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center bg-white px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all"
                >
                    Open Hub <i className="fa-solid fa-arrow-right ml-1.5"></i>
                </button>
            </div>
        </div>
    );
};

interface InspectorPanelProps {
    site: Site;
    onClose: () => void;
    onOpenHub: () => void;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({ site, onClose, onOpenHub }) => {
    // Calculate Baseline for Inspector
    const baseline = site.scenarios.find(s => s.isBaseline);
    let baselineMetrics = null;
    if (baseline) {
        const cashflow = FinanceEngine.calculateMonthlyCashflow(baseline, site);
        // Fix: Added missing 'site' argument to calculateProjectMetrics
        baselineMetrics = FinanceEngine.calculateProjectMetrics(cashflow, baseline.settings, site);
    }

    return (
        <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-2xl z-[100] transform transition-transform duration-300 flex flex-col border-l border-slate-200">
            {/* Header */}
            <div className="relative h-48 bg-slate-900 shrink-0">
                <img src={site.thumbnail} className="w-full h-full object-cover opacity-60" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
                <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center backdrop-blur-sm transition-colors">
                    <i className="fa-solid fa-xmark"></i>
                </button>
                <div className="absolute bottom-6 left-6 right-6">
                    <div className="flex items-center space-x-2 mb-2">
                        <span className="px-2 py-0.5 rounded bg-white/20 backdrop-blur text-white text-[10px] font-bold uppercase border border-white/10">
                            {site.status}
                        </span>
                        <span className="text-slate-300 text-xs font-mono font-bold">{site.code}</span>
                    </div>
                    <h2 className="text-2xl font-black text-white leading-tight mb-1">{site.name}</h2>
                    <p className="text-sm text-slate-300 flex items-center">
                        <i className="fa-solid fa-location-dot mr-2"></i> {site.identity.address}
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                
                {/* 1. Attributes */}
                <section>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Property Attributes</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Land Area</span>
                            <span className="block text-sm font-bold text-slate-800">{site.identity.landArea.toLocaleString()} m²</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">LGA</span>
                            <span className="block text-sm font-bold text-slate-800 truncate">{site.identity.lga}</span>
                        </div>
                        <div className="col-span-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Zoning</span>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-800">{site.identity.zoning}</span>
                                <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                                    {site.identity.zoningCode || 'CODE'}
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. Baseline Scenario */}
                <section>
                    <div className="flex justify-between items-end mb-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Baseline Scenario</h4>
                        {baseline && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Approved</span>}
                    </div>
                    {baseline && baselineMetrics ? (
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                            <div className="p-3 bg-slate-50 border-b border-slate-200">
                                <h5 className="font-bold text-sm text-slate-700">{baseline.name}</h5>
                            </div>
                            <div className="p-4 grid grid-cols-2 gap-6">
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Net Profit</span>
                                    <span className="block text-lg font-black text-emerald-600">${(baselineMetrics.netProfit/1e6).toFixed(2)}M</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Dev Margin</span>
                                    <span className="block text-lg font-black text-slate-800">{baselineMetrics.devMarginPct.toFixed(1)}%</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Equity IRR</span>
                                    <span className="block text-lg font-black text-indigo-600">{baselineMetrics.equityIRR ? baselineMetrics.equityIRR.toFixed(1)+'%' : '-'}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Peak Equity</span>
                                    <span className="block text-lg font-black text-slate-800">${(baselineMetrics.peakEquity/1e6).toFixed(1)}M</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                            No baseline scenario set.
                        </div>
                    )}
                </section>

                {/* 3. Acquisition */}
                <section>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Acquisition & Settlement</h4>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-500">Purchase Price</span>
                            <span className="text-sm font-black text-slate-800">${(site.acquisition.purchasePrice/1e6).toFixed(2)}M</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-500">Settlement Date</span>
                            <span className="text-sm font-bold text-slate-800">{site.acquisition.settlementDate || 'TBC'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-500">Vendor</span>
                            <span className="text-sm font-bold text-slate-800">{site.acquisition.vendor.name}</span>
                        </div>
                    </div>
                </section>

                {/* 4. Activity */}
                <section>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Activity Summary</h4>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-3 bg-slate-50 rounded-lg">
                            <span className="block text-xl font-black text-slate-700">{site.openTasks}</span>
                            <span className="block text-[9px] font-bold text-slate-400 uppercase">Tasks</span>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-lg">
                            <span className="block text-xl font-black text-amber-600">{site.openRFIs}</span>
                            <span className="block text-[9px] font-bold text-amber-700/60 uppercase">RFIs</span>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <span className="block text-xl font-black text-blue-600">{site.conditions || 0}</span>
                            <span className="block text-[9px] font-bold text-blue-700/60 uppercase">Conditions</span>
                        </div>
                    </div>
                </section>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 bg-slate-50 shrink-0">
                <button 
                    onClick={onOpenHub}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center text-sm"
                >
                    Open Site Hub <i className="fa-solid fa-arrow-right-long ml-2"></i>
                </button>
            </div>
        </div>
    );
};

export default function App() {
  const { 
    sites, 
    selectedSiteId, 
    selectSite, 
    selectScenario,
    addSite,
    updateSite,
    deleteSite,
    smartRates, 
    taxScales, 
    customLibrary,
    setSmartRates,
    setTaxScales,
    setCustomLibrary
  } = useProject();

  const [globalView, setGlobalView] = useState<'portfolio' | 'settings' | 'tasks' | 'feasibilities'>('portfolio');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [inspectingSiteId, setInspectingSiteId] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'ALL'>('ALL');
  const [stageFilter, setStageFilter] = useState<ProjectStage | 'ALL'>('ALL');

  // Modal State
  const [isEditingSite, setIsEditingSite] = useState(false);
  const [pendingSite, setPendingSite] = useState<Site | null>(null);

  // --- Handlers ---

  const handleNavigate = (view: 'portfolio' | 'settings' | 'tasks' | 'feasibilities') => {
    setGlobalView(view);
    selectSite(null);
    selectScenario(null);
    setInspectingSiteId(null);
  };

  const handleOpenSite = (id: string) => {
      selectSite(id);
      setInspectingSiteId(null);
  };

  const handleCreateNewSite = () => {
    const newId = `lead-${Date.now()}`;
    const defaultScenario = createDefaultScenario() as any; 
    if (defaultScenario.settings.acquisition) delete defaultScenario.settings.acquisition;

    const newSite: Site = {
      id: newId,
      code: `PROJ-${Math.floor(Math.random() * 1000)}`,
      name: "New Project",
      thumbnail: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=400&auto=format&fit=crop",
      status: 'Prospect',
      stage: 'Analysis',
      openTasks: 0,
      openRFIs: 0,
      conditions: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      
      // V2 Structure
      identity: {
        address: "Enter Address",
        state: 'VIC',
        landArea: 0,
        lga: "Pending",
        zoning: "Pending",
        overlays: [],
      },
      // Added missing buyersAgentFee and legalFeeEstimate to satisfy SiteAcquisition type
      acquisition: {
        purchasePrice: 0,
        depositPercent: 10,
        settlementPeriod: 0,
        stampDutyState: 'VIC',
        isForeignBuyer: false,
        buyersAgentFee: 0,
        legalFeeEstimate: 0,
        vendor: { name: "Pending" },
        purchaser: { entity: "TBC" }
      },
      planning: {
        permitStatus: 'Not Started',
      },
      stakeholders: [],
      scenarios: [defaultScenario]
    };

    setPendingSite(newSite);
    setIsEditingSite(true); 
  };

  const handleCommitSite = () => {
      if (pendingSite) {
          addSite(pendingSite);
          selectSite(pendingSite.id);
          setPendingSite(null);
          setIsEditingSite(false);
      }
  };

  // --- Derived State ---

  const filteredSites = useMemo(() => {
      return sites.filter(site => {
          const matchesSearch = site.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                site.identity.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                site.code.toLowerCase().includes(searchTerm.toLowerCase());
          
          const matchesStatus = statusFilter === 'ALL' || site.status === statusFilter;
          const matchesStage = stageFilter === 'ALL' || site.stage === stageFilter;

          return matchesSearch && matchesStatus && matchesStage;
      });
  }, [sites, searchTerm, statusFilter, stageFilter]);

  const portfolioMetrics = useMemo(() => {
      const totalSites = sites.length;
      const planningCount = sites.filter(s => s.stage === 'Planning').length;
      const ddCount = sites.filter(s => s.status === 'Due Diligence').length;
      const prospectCount = sites.filter(s => s.status === 'Prospect').length;
      const totalLand = sites.reduce((sum, s) => sum + s.identity.landArea, 0);
      const totalValue = sites.reduce((sum, s) => sum + s.acquisition.purchasePrice, 0);

      return { totalSites, planningCount, ddCount, prospectCount, totalLand, totalValue };
  }, [sites]);

  const selectedSite = sites.find(p => p.id === selectedSiteId);
  const inspectingSite = sites.find(s => s.id === inspectingSiteId);

  // --- Render ---

  return (
    <AppShell activeModule={globalView} onNavigate={handleNavigate}>
      
      {/* A. PROJECT CONTEXT (Full View) */}
      {selectedSiteId && selectedSite ? (
         <ProjectLayout 
            site={selectedSite} 
            onBack={() => { selectSite(null); selectScenario(null); }} 
         />
      ) : (
         /* B. PORTFOLIO DASHBOARD */
         <div className="h-full flex flex-col overflow-hidden relative">
            
            {/* Inspector Slide-Over */}
            {inspectingSite && (
                <>
                    <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[90] transition-opacity" onClick={() => setInspectingSiteId(null)}></div>
                    <InspectorPanel 
                        site={inspectingSite} 
                        onClose={() => setInspectingSiteId(null)} 
                        onOpenHub={() => handleOpenSite(inspectingSite.id)}
                    />
                </>
            )}

            {globalView === 'portfolio' && (
              <>
                {/* 1. Header & Metrics */}
                <header className="bg-white border-b border-slate-200 shrink-0 z-20">
                   <div className="px-8 py-5 flex justify-between items-center border-b border-slate-100">
                      <div>
                         <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sites Portfolio</h1>
                         <p className="text-sm text-slate-500 mt-1 font-medium">Development pipeline and active assets</p>
                      </div>
                      <div className="flex space-x-3">
                         <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors">
                            <i className="fa-solid fa-download mr-2"></i> Export
                         </button>
                         <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors">
                            <i className="fa-solid fa-chart-pie mr-2"></i> Analytics
                         </button>
                         <button 
                            onClick={handleCreateNewSite}
                            className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center"
                         >
                            <i className="fa-solid fa-plus mr-2"></i> New Site
                         </button>
                      </div>
                   </div>

                   {/* Metrics Grid */}
                   <div className="px-8 py-6 bg-slate-50">
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                          <MetricCard label="Total Sites" value={portfolioMetrics.totalSites.toString()} colorClass="bg-slate-100" icon="fa-layer-group" />
                          <MetricCard label="Planning" value={portfolioMetrics.planningCount.toString()} colorClass="bg-amber-100" icon="fa-compass-drafting" />
                          <MetricCard label="Due Diligence" value={portfolioMetrics.ddCount.toString()} colorClass="bg-purple-100" icon="fa-magnifying-glass-chart" />
                          <MetricCard label="Prospects" value={portfolioMetrics.prospectCount.toString()} colorClass="bg-blue-100" icon="fa-binoculars" />
                          <MetricCard label="Total Land" value={(portfolioMetrics.totalLand / 1000).toFixed(1) + 'k'} subtext="m²" colorClass="bg-emerald-100" icon="fa-map" />
                          <MetricCard label="Portfolio Value" value={'$' + (portfolioMetrics.totalValue / 1000000).toFixed(1) + 'M'} colorClass="bg-indigo-100" icon="fa-sack-dollar" />
                      </div>
                   </div>
                </header>

                {/* 2. Toolbar */}
                <div className="px-8 py-4 bg-white border-b border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between shrink-0">
                    <div className="flex items-center space-x-3 w-full md:w-auto">
                        <div className="relative">
                            <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                            <input 
                                type="text" 
                                placeholder="Search sites..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 w-64 transition-all"
                            />
                        </div>
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="border-slate-200 rounded-lg text-sm font-bold text-slate-600 focus:ring-indigo-500 py-2 pl-3 pr-8 bg-slate-50 hover:bg-white transition-colors"
                        >
                            <option value="ALL">All Status</option>
                            <option value="Prospect">Prospect</option>
                            <option value="Due Diligence">Due Diligence</option>
                            <option value="Acquired">Acquired</option>
                        </select>
                        <select 
                            value={stageFilter}
                            onChange={(e) => setStageFilter(e.target.value as any)}
                            className="border-slate-200 rounded-lg text-sm font-bold text-slate-600 focus:ring-indigo-500 py-2 pl-3 pr-8 bg-slate-50 hover:bg-white transition-colors"
                        >
                            <option value="ALL">All Stages</option>
                            <option value="Analysis">Analysis</option>
                            <option value="Acquisition">Acquisition</option>
                            <option value="Planning">Planning</option>
                            <option value="Construction">Construction</option>
                        </select>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button 
                            onClick={() => setViewMode('cards')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'cards' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-grip"></i>
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-list"></i>
                        </button>
                        <button 
                            onClick={() => setViewMode('map')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'map' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-map"></i>
                        </button>
                    </div>
                </div>

                {/* 3. Content Canvas */}
                <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
                    
                    {/* View: CARDS */}
                    {viewMode === 'cards' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                            {filteredSites.map(site => (
                                <SiteCard 
                                    key={site.id} 
                                    site={site} 
                                    onClick={() => setInspectingSiteId(site.id)}
                                    onOpen={(e) => { e.stopPropagation(); handleOpenSite(site.id); }}
                                />
                            ))}
                            {/* Add New Ghost Card */}
                            <button 
                                onClick={handleCreateNewSite}
                                className="group flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-8 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all min-h-[400px]"
                            >
                                <div className="w-16 h-16 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 mb-4 transition-colors">
                                    <i className="fa-solid fa-plus text-2xl"></i>
                                </div>
                                <h3 className="text-lg font-bold text-slate-500 group-hover:text-indigo-700">Add New Site</h3>
                            </button>
                        </div>
                    )}

                    {/* View: LIST */}
                    {viewMode === 'list' && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4">Site</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Land Area</th>
                                        <th className="px-6 py-4 text-right">Purchase</th>
                                        <th className="px-6 py-4 text-center">Models</th>
                                        <th className="px-6 py-4 text-center">Progress</th>
                                        <th className="px-6 py-4 text-right">Last Updated</th>
                                        <th className="px-6 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredSites.map(site => (
                                        <tr 
                                            key={site.id} 
                                            onClick={() => setInspectingSiteId(site.id)}
                                            className="hover:bg-slate-50 cursor-pointer transition-colors group"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-3">
                                                    <img src={site.thumbnail} className="w-10 h-10 rounded-lg object-cover bg-slate-200" alt="" />
                                                    <div>
                                                        <div className="font-bold text-slate-800">{site.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{site.code}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${
                                                    site.status === 'Acquired' ? 'bg-emerald-100 text-emerald-700' :
                                                    site.status === 'Due Diligence' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {site.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-slate-600">
                                                {site.identity.landArea.toLocaleString()} m²
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-slate-600">
                                                ${(site.acquisition.purchasePrice / 1000000).toFixed(2)}M
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-xs font-bold">{site.scenarios.length}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="w-24 mx-auto">
                                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-500" style={{width: site.stage === 'Construction' ? '75%' : '30%'}}></div>
                                                    </div>
                                                    <span className="text-[9px] text-slate-400 uppercase mt-1 block">{site.stage}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-xs text-slate-500">
                                                {new Date(site.updatedAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleOpenSite(site.id); }}
                                                    className="text-indigo-600 font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    Open <i className="fa-solid fa-arrow-right ml-1"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* View: MAP */}
                    {viewMode === 'map' && (
                        <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-white rounded-xl border border-slate-200">
                            <div className="w-16 h-16 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 mb-4 animate-bounce">
                                <i className="fa-solid fa-map-location-dot text-3xl"></i>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Map View Coming Soon</h3>
                            <p className="text-slate-500 mt-2 max-w-md text-center">
                                Visualize your portfolio on an interactive map with site markers, boundaries, and location intelligence.
                            </p>
                            <div className="mt-8 p-6 bg-slate-50 rounded-lg border border-slate-100 max-w-lg w-full">
                                <h4 className="text-xs font-bold text-slate-700 uppercase mb-3">Planned Features</h4>
                                <ul className="space-y-2 text-xs text-slate-500">
                                    <li className="flex items-center"><i className="fa-solid fa-check text-indigo-500 mr-2"></i> Interactive map with site markers</li>
                                    <li className="flex items-center"><i className="fa-solid fa-check text-indigo-500 mr-2"></i> Property boundary overlays</li>
                                    <li className="flex items-center"><i className="fa-solid fa-check text-indigo-500 mr-2"></i> Heat maps (land value, zoning, etc.)</li>
                                    <li className="flex items-center"><i className="fa-solid fa-check text-indigo-500 mr-2"></i> Location intelligence (nearby amenities, transport)</li>
                                </ul>
                            </div>
                        </div>
                    )}

                </div>
              </>
            )}

            {/* Other Global Views */}
            {globalView === 'feasibilities' && <GlobalFeasibilityList />}
            {globalView === 'settings' && (
               <AdminSettings 
                  rates={smartRates} 
                  setRates={setSmartRates} 
                  library={customLibrary} 
                  setLibrary={setCustomLibrary} 
                  taxScales={taxScales}
                  setTaxScales={setTaxScales}
               />
            )}
            {globalView === 'tasks' && (
               <div className="flex-1 flex items-center justify-center text-slate-400">
                  <div className="text-center">
                     <i className="fa-solid fa-helmet-safety text-4xl mb-4 opacity-20"></i>
                     <p>Task Manager Coming Soon</p>
                  </div>
               </div>
            )}
         </div>
      )}
      
      {/* Global Create Modal */}
      {isEditingSite && pendingSite && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] overflow-hidden border border-slate-200 flex flex-col">
                <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10">
                   <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                      Initialize New Site
                   </h2>
                   <button onClick={() => setIsEditingSite(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
                      <i className="fa-solid fa-xmark text-lg"></i>
                   </button>
                </div>
                <div className="flex-1 overflow-hidden overflow-y-auto bg-slate-50 p-4">
                   <SiteDNAHub 
                      site={pendingSite} 
                      onUpdate={setPendingSite} 
                   />
                </div>
                <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end space-x-3">
                    <button 
                        onClick={() => setIsEditingSite(false)}
                        className="px-5 py-2.5 rounded-lg font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleCommitSite}
                        className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-sm shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center"
                    >
                        <i className="fa-solid fa-check mr-2"></i> Create Project
                    </button>
                </div>
             </div>
          </div>
      )}
      
    </AppShell>
  );
}
