import React, { useState } from 'react';
import {
  FileText, Box, Layers
} from 'lucide-react';
import LaborServiceModule from './components/LaborServiceModule';
import ProductPCFModule from './components/ProductPCFModule';
import ComprehensiveModule from './components/ComprehensiveModule';

type Scenario = 'labor' | 'product_agent' | 'product_factory' | 'comprehensive';

const App: React.FC = () => {
  const [currentScenario, setCurrentScenario] = useState<Scenario>('labor');

  // Navigation Items
  const navItems = [
    { id: 'labor', label: '【情境一】純勞務 / 安裝作業', sub: '純服務/安裝', icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'product_agent', label: '【情境二】設備採購 (純代理商)', sub: '無自有工廠', icon: Box, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'product_factory', label: '【情境三】設備採購 (含生產製造)', sub: '自有工廠生產', icon: Box, color: 'text-sky-600', bg: 'bg-sky-50' },
    { id: 'comprehensive', label: '【情境四】產品採購 + 安裝勞務', sub: '產品+安裝組合', icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ];

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans text-slate-900">
      {/* Global Navigation Sidebar */}
      <aside className="w-20 lg:w-64 bg-slate-900 flex flex-col flex-shrink-0 shadow-xl z-50 text-white transition-all duration-300">
        <div className="p-6 border-b border-slate-800 flex items-center justify-center lg:justify-start">
          <div className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-tr from-blue-400 to-emerald-400">CHT</div>
          <div className="hidden lg:block ml-3 font-bold text-slate-400 text-sm tracking-widest">ESG</div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentScenario(item.id as Scenario)}
              className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${currentScenario === item.id ? 'bg-white/10 shadow-inner' : 'hover:bg-white/5'}`}
            >
              <div className={`p-2 rounded-lg ${currentScenario === item.id ? 'bg-white' : 'bg-slate-800 group-hover:bg-slate-700'}`}>
                <item.icon className={`w-5 h-5 ${currentScenario === item.id ? item.color : 'text-slate-400'}`} />
              </div>
              <div className="hidden lg:block ml-3 text-left">
                <div className={`text-sm font-bold ${currentScenario === item.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>{item.label}</div>
                <div className="text-[10px] font-medium text-slate-500">{item.sub}</div>
              </div>
            </button>
          ))}
        </nav>

        <div className="p-4 text-center lg:text-left text-[10px] text-slate-600 border-t border-slate-800">
          <span className="hidden lg:inline">v2.0 Multi-Scenario</span>
        </div>
      </aside>

      {/* Main Module Area */}
      <div className="flex-1 overflow-y-auto relative">
        {currentScenario === 'labor' && <LaborServiceModule />}
        {currentScenario === 'product_agent' && <ProductPCFModule isAgentMode={true} />}
        {currentScenario === 'product_factory' && <ProductPCFModule />}
        {currentScenario === 'comprehensive' && <ComprehensiveModule />}
      </div>
    </div>
  );
};

export default App;
