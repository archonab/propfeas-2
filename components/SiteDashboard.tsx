
import React, { useState } from 'react';
import { Site, ProjectStage, FeasibilityScenario } from '../types-v2';
import { FinanceEngine } from '../services/financeEngine';

interface Props {
  site: Site;
  onOpenScenario: (scenarioId: string) => void;
  onCreateScenario: () => void;
  onBack: () => void;
}

type SiteTab = 'overview' | 'details' | 'feasibility' | 'tasks' | 'stakeholders' | 'documents' | 'rfqs' | 'activity';

export const SiteDashboard: React.FC<Props> = ({ site, onOpenScenario, onCreateScenario, onBack }) => {
  const [activeTab, setActiveTab] = useState<SiteTab>('overview');

  // --- Sub-Components ---

  const KpiCard = ({ label, value, subtext, icon, colorClass }: any) => (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            <i className={`fa-solid ${icon} text-slate-300 text-xs`}></i>
        </div>
        <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-800">{value}</span>
        </div>
        <p className={`text-[10px] font-bold mt-1 ${colorClass}`}>{subtext}</p>
    </div>
  );

  const ActivityItem = ({ user, action, time, status, statusLabel }: any) => (
      <div className="flex items-start space-x-3 py-3 border-b border-slate-50 last:border-0 group">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 border border-slate-200 uppercase">
              {user.split(' ').map((n: string) => n[0]).join('')}
          </div>
          <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-600">
                  <span className="font-bold text-slate-800">{user}</span> {action}
              </p>
              <span className="text-[10px] text-slate-400">{time}</span>
          </div>
          <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${
              status === 'success' ? 'bg-emerald-50 text-emerald-600' : 
              status === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
          }`}>
              {statusLabel}
          </span>
      </div>
  );

  const TimelinePhase = ({ label, percent, status }: any) => (
      <div className="mb-5 last:mb-0">
          <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-bold text-slate-700">{label}</span>
              <span className={`text-[10px] font-black ${percent === 100 ? 'text-emerald-500' : 'text-slate-400'}`}>{percent}%</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${percent === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                style={{ width: `${percent}%` }}
              ></div>
          </div>
      </div>
  );

  const PhaseCard = ({ label, count, color }: any) => (
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
              <h4 className="text-xs font-bold text-slate-800">{label}</h4>
              <p className="text-[10px] text-slate-400 font-medium">{count} active tasks</p>
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${color}`}>
              {count}
          </div>
      </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      
      {/* 1. COMPACT PROJECT HEADER */}
      <header className="bg-white border-b border-slate-200 pt-5 shrink-0 z-30">
          <div className="px-8 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center space-x-4">
                  <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-800 transition-colors">
                      <i className="fa-solid fa-chevron-left"></i>
                  </button>
                  <div>
                      <div className="flex items-center space-x-3 mb-0.5">
                          <h1 className="text-xl font-black text-slate-900 tracking-tight">{site.name}</h1>
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded text-[10px] font-black uppercase tracking-wide">
                              {site.stage.toUpperCase()}
                          </span>
                      </div>
                      <div className="text-[11px] font-bold text-slate-400 flex items-center">
                          <span className="font-mono text-slate-300 mr-2">{site.code}</span>
                          <span className="mr-2">•</span>
                          {site.identity.address}
                      </div>
                  </div>
              </div>

              <div className="flex items-center space-x-2">
                  <button className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-100">Apply Playbook</button>
                  <button className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-100">Publish Snapshot</button>
                  <button className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-emerald-700 flex items-center">
                      <i className="fa-solid fa-plus mr-2"></i> New RFI
                  </button>
                  <button 
                    onClick={onCreateScenario}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-indigo-700 flex items-center"
                  >
                      <i className="fa-solid fa-calculator mr-2"></i> New Scenario
                  </button>
                  <div className="h-8 w-px bg-slate-200 mx-2"></div>
                  <button className="relative p-2 text-slate-400 hover:text-slate-600">
                      <i className="fa-solid fa-bell"></i>
                      <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                  </button>
                  <button className="p-2 text-slate-400 hover:text-slate-600">
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                  </button>
              </div>
          </div>

          {/* TAB NAVIGATION */}
          <div className="px-8 flex space-x-1 border-t border-slate-100 overflow-x-auto no-scrollbar">
              {[
                  { id: 'overview', label: 'Overview', icon: 'fa-chart-pie' },
                  { id: 'details', label: 'Site Details', icon: 'fa-city' },
                  { id: 'feasibility', label: 'Feasibility', count: site.scenarios.length, icon: 'fa-calculator' },
                  { id: 'tasks', label: 'Tasks', count: site.openTasks, icon: 'fa-list-check' },
                  { id: 'stakeholders', label: 'Stakeholders', count: site.stakeholders.length, icon: 'fa-users' },
                  { id: 'documents', label: 'Documents', count: 5, icon: 'fa-folder-open' },
                  { id: 'rfqs', label: 'RFQs', count: 0, icon: 'fa-file-invoice-dollar' },
                  { id: 'activity', label: 'Activity', icon: 'fa-clock-rotate-left' },
              ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as SiteTab)}
                    className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center whitespace-nowrap ${
                        activeTab === tab.id 
                        ? 'border-indigo-600 text-indigo-700' 
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                      {tab.label}
                      {tab.count !== undefined && (
                          <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                              {tab.count}
                          </span>
                      )}
                  </button>
              ))}
          </div>
      </header>

      {/* 2. TAB CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-8">
              
              {/* TAB: OVERVIEW */}
              {activeTab === 'overview' && (
                  <div className="space-y-8 animate-in fade-in duration-500">
                      
                      {/* Alert Banner */}
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-4 shadow-sm">
                          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                              <i className="fa-solid fa-triangle-exclamation"></i>
                          </div>
                          <div>
                              <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">3 Items Require Attention</h4>
                              <ul className="mt-1 space-y-1 text-xs text-amber-800 font-medium">
                                  <li>• Council decision expected by Dec 15 - Follow up required</li>
                                  <li>• Geotechnical report review due Dec 26</li>
                                  <li>• 8 permit conditions require documentation</li>
                              </ul>
                          </div>
                      </div>

                      {/* KPI GRID */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                          <KpiCard label="Tasks Due" value={site.openTasks} subtext="8 this week" icon="fa-check-double" colorClass="text-indigo-600" />
                          <KpiCard label="Open RFIs" value={site.openRFIs} subtext="2 awaiting response" icon="fa-circle-question" colorClass="text-amber-600" />
                          <KpiCard label="Open Issues" value="7" subtext="2 high priority" icon="fa-circle-exclamation" colorClass="text-red-600" />
                          <KpiCard label="Permit Conditions" value={site.conditions || 8} subtext="42% complete" icon="fa-file-signature" colorClass="text-emerald-600" />
                      </div>

                      {/* Split Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                          {/* Activity List */}
                          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                                  <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Recent Activity</h3>
                                  <button className="text-indigo-600 font-bold text-xs hover:underline">View All</button>
                              </div>
                              <div className="p-6 pt-0 overflow-y-auto max-h-[400px]">
                                  <ActivityItem user="Sarah Chen" action="uploaded Architectural Plans Rev C" time="2 hours ago" status="success" statusLabel="Success" />
                                  <ActivityItem user="Lisa Anderson" action="updated Permit Conditions Tracker" time="5 hours ago" status="warning" statusLabel="Warning" />
                                  <ActivityItem user="Michael Torres" action="approved Structural Assessment" time="1 day ago" status="success" statusLabel="Success" />
                                  <ActivityItem user="James Wilson" action="submitted RFI-1 Response" time="1 day ago" status="info" statusLabel="Info" />
                                  <ActivityItem user="Sarah Mitchell" action="marked complete Task: Submit plans" time="2 days ago" status="success" statusLabel="Success" />
                              </div>
                          </div>

                          {/* Project Timeline */}
                          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
                              <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm mb-6">Project Timeline</h3>
                              <TimelinePhase label="Due Diligence" percent={100} />
                              <TimelinePhase label="Planning Approval" percent={67} />
                              <TimelinePhase label="Construction" percent={0} />
                              <TimelinePhase label="Sales & Settlement" percent={0} />
                          </div>
                      </div>

                      {/* Phase Summary Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                          <PhaseCard label="Pre-Settlement" count={3} color="bg-indigo-50 text-indigo-600" />
                          <PhaseCard label="Planning Permit" count={5} color="bg-amber-50 text-amber-600" />
                          <PhaseCard label="Construction" count={4} color="bg-blue-50 text-blue-600" />
                          <PhaseCard label="Sales & Marketing" count={2} color="bg-emerald-50 text-emerald-600" />
                      </div>

                      {/* Latest Documents */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                              <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Latest Documents</h3>
                              <button className="text-indigo-600 font-bold text-xs hover:underline">View All</button>
                          </div>
                          <div className="divide-y divide-slate-50">
                              {[
                                  { name: 'Architectural Plans Rev C', meta: 'Sarah Chen • 2024-12-20', status: 'Published', color: 'bg-emerald-50 text-emerald-600' },
                                  { name: 'Feasibility Update Q4', meta: 'Sarah Mitchell • 2024-12-18', status: 'Published', color: 'bg-emerald-50 text-emerald-600' },
                                  { name: 'Geotechnical Report', meta: 'Michael Torres • 2024-12-15', status: 'Draft', color: 'bg-amber-50 text-amber-600' },
                                  { name: 'Permit Conditions Tracker', meta: 'Lisa Anderson • 2024-12-22', status: 'Internal', color: 'bg-slate-50 text-slate-600' },
                                  { name: 'RFI-1 Comparison Matrix', meta: 'James Wilson • 2024-12-21', status: 'Internal', color: 'bg-slate-50 text-slate-600' },
                              ].map((doc, idx) => (
                                  <div key={idx} className="px-6 py-4 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                                      <div className="flex items-center space-x-4">
                                          <div className={`w-8 h-8 rounded flex items-center justify-center ${doc.name.includes('Plans') ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                              <i className={`fa-solid ${doc.name.includes('Plans') ? 'fa-file-pdf' : 'fa-file-excel'}`}></i>
                                          </div>
                                          <div>
                                              <p className="text-xs font-bold text-slate-800">{doc.name}</p>
                                              <p className="text-[10px] text-slate-400 font-medium">{doc.meta}</p>
                                          </div>
                                      </div>
                                      <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${doc.color}`}>
                                          {doc.status}
                                      </span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              )}

              {/* TAB: SITE DETAILS (The 3 Pillar View) */}
              {activeTab === 'details' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-500">
                      
                      {/* Identity Pillar */}
                      <div className="bg-white rounded-2xl border-t-4 border-blue-500 shadow-sm overflow-hidden flex flex-col">
                          <div className="p-6 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between">
                              <h3 className="font-black text-blue-900 uppercase tracking-widest text-xs">Identity</h3>
                              <i className="fa-solid fa-city text-blue-400"></i>
                          </div>
                          <div className="p-6 space-y-6">
                              <div>
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Site Address</label>
                                  <p className="text-sm font-bold text-slate-800 leading-snug">{site.identity.address}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Land Area</label>
                                      <p className="text-sm font-black text-slate-800">{site.identity.landArea.toLocaleString()} m²</p>
                                  </div>
                                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Zoning</label>
                                      <p className="text-sm font-black text-slate-800">{site.identity.zoningCode || 'RES1'}</p>
                                  </div>
                              </div>
                              <div className="p-4 bg-blue-900 rounded-xl text-white">
                                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">Local Authority</p>
                                  <p className="text-sm font-black">{site.identity.lga}</p>
                              </div>
                          </div>
                      </div>

                      {/* Acquisition Pillar */}
                      <div className="bg-white rounded-2xl border-t-4 border-emerald-500 shadow-sm overflow-hidden flex flex-col">
                          <div className="p-6 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
                              <h3 className="font-black text-emerald-900 uppercase tracking-widest text-xs">Acquisition</h3>
                              <i className="fa-solid fa-handshake text-emerald-400"></i>
                          </div>
                          <div className="p-6 space-y-6">
                              <div>
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Purchase Price</label>
                                  <p className="text-2xl font-black text-emerald-600 tracking-tight">${(site.acquisition.purchasePrice / 1e6).toFixed(2)}M</p>
                              </div>
                              <div className="space-y-4">
                                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                      <span className="text-xs font-bold text-slate-500">Settlement</span>
                                      <span className="text-xs font-black text-slate-800">{site.acquisition.settlementDate || 'TBC'}</span>
                                  </div>
                                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                      <span className="text-xs font-bold text-slate-500">Vendor</span>
                                      <span className="text-xs font-black text-slate-800 truncate max-w-[140px]">{site.acquisition.vendor.name}</span>
                                  </div>
                              </div>
                              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                  <p className="text-[10px] font-bold uppercase text-emerald-800/60 mb-1">Land Basis</p>
                                  <p className="text-sm font-black text-emerald-900">${(site.acquisition.purchasePrice / site.identity.landArea).toFixed(0)} / m²</p>
                              </div>
                          </div>
                      </div>

                      {/* Planning Pillar */}
                      <div className="bg-white rounded-2xl border-t-4 border-purple-500 shadow-sm overflow-hidden flex flex-col">
                          <div className="p-6 bg-purple-50/50 border-b border-purple-100 flex items-center justify-between">
                              <h3 className="font-black text-purple-900 uppercase tracking-widest text-xs">Planning</h3>
                              <i className="fa-solid fa-gavel text-purple-400"></i>
                          </div>
                          <div className="p-6 space-y-6">
                              <div>
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status</label>
                                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-[10px] font-black uppercase">{site.planning.permitStatus}</span>
                              </div>
                              <div className="space-y-4">
                                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                      <span className="text-xs font-bold text-slate-500">Flood Risk</span>
                                      <span className="text-xs font-black text-emerald-600">LOW</span>
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Encumbrances</label>
                                      <div className="p-3 bg-slate-50 rounded-lg text-[10px] text-slate-600 font-medium leading-relaxed italic">
                                          {site.planning.easements || "No easements reported on title."}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {/* TAB: FEASIBILITY GRID */}
              {activeTab === 'feasibility' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-500">
                      {site.scenarios.map(scen => {
                          const cashflow = FinanceEngine.calculateMonthlyCashflow(scen, site);
                          // Fix: Added missing 'site' argument to calculateProjectMetrics
                          const metrics = FinanceEngine.calculateProjectMetrics(cashflow, scen.settings, site);
                          return (
                              <div 
                                key={scen.id} 
                                onClick={() => onOpenScenario(scen.id)}
                                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:border-indigo-300 transition-all cursor-pointer group flex flex-col h-full"
                              >
                                  <div className="flex justify-between items-start mb-6">
                                      <div>
                                          <div className="flex items-center space-x-2 mb-1">
                                              <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${scen.strategy === 'SELL' ? 'bg-blue-50 text-blue-700' : 'bg-indigo-50 text-indigo-700'}`}>
                                                  {scen.strategy}
                                              </span>
                                              {scen.isBaseline && <i className="fa-solid fa-star text-amber-400 text-xs"></i>}
                                          </div>
                                          <h3 className="text-lg font-black text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">{scen.name}</h3>
                                          <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase">v{Math.floor(Math.random() * 5) + 1}.{Math.floor(Math.random() * 9)} • FEAS-{idxToCode(scen.id)}</p>
                                      </div>
                                      {scen.isBaseline && (
                                          <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-black uppercase">Baseline</span>
                                      )}
                                  </div>

                                  <div className="grid grid-cols-2 gap-4 mb-6">
                                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Margin</label>
                                          <p className={`text-xl font-black ${metrics.devMarginPct > 15 ? 'text-emerald-600' : 'text-amber-500'}`}>{metrics.devMarginPct.toFixed(1)}%</p>
                                      </div>
                                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Profit</label>
                                          <p className="text-xl font-black text-slate-800">${(metrics.netProfit / 1e6).toFixed(2)}M</p>
                                      </div>
                                  </div>

                                  <div className="mt-auto pt-4 border-t border-slate-50 flex justify-between items-center">
                                      <span className="text-[10px] font-bold text-slate-400">Updated {new Date(scen.updatedAt).toLocaleDateString()}</span>
                                      <span className="text-indigo-600 font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Open Model <i className="fa-solid fa-arrow-right ml-1"></i></span>
                                  </div>
                              </div>
                          );
                      })}
                      {/* Add New Ghost Card */}
                      <button 
                        onClick={onCreateScenario}
                        className="border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-indigo-50 hover:border-indigo-400 transition-all group"
                      >
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                              <i className="fa-solid fa-plus text-xl"></i>
                          </div>
                          <span className="text-sm font-black text-slate-500 group-hover:text-indigo-700">Add New Strategy</span>
                      </button>
                  </div>
              )}

              {/* Other Tabs Placeholder */}
              {(['tasks', 'stakeholders', 'documents', 'rfqs', 'activity'].includes(activeTab)) && (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                      <i className={`fa-solid ${
                          activeTab === 'tasks' ? 'fa-list-check' :
                          activeTab === 'stakeholders' ? 'fa-users' :
                          activeTab === 'documents' ? 'fa-folder-open' :
                          activeTab === 'rfqs' ? 'fa-file-invoice-dollar' : 'fa-clock-rotate-left'
                      } text-6xl mb-6 opacity-20`}></i>
                      <h3 className="text-lg font-black uppercase tracking-widest">{activeTab} coming soon</h3>
                      <p className="text-sm font-medium mt-2">The module for managing {activeTab} is currently under development.</p>
                  </div>
              )}

          </div>
      </main>
    </div>
  );
};

// Helper for random mock codes
function idxToCode(id: string) {
    return id.substring(0, 3).toUpperCase();
}
