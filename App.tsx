import React, { useState } from 'react';
import {
  FileText, Box, Layers, AlertTriangle, X
} from 'lucide-react';
import LaborServiceModule from './components/LaborServiceModule';
import ProductPCFModule from './components/ProductPCFModule';
import ComprehensiveModule from './components/ComprehensiveModule';

type Scenario = 'labor' | 'product_agent' | 'product_factory' | 'comprehensive';

const App: React.FC = () => {
  const [currentScenario, setCurrentScenario] = useState<Scenario>('labor');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingScenario, setPendingScenario] = useState<Scenario | null>(null);

  const handleScenarioSwitch = (id: Scenario) => {
    if (id === currentScenario) return;
    setPendingScenario(id);
    setShowConfirm(true);
  };

  const confirmSwitch = () => {
    if (pendingScenario) {
      setCurrentScenario(pendingScenario);
    }
    setShowConfirm(false);
    setPendingScenario(null);
  };

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
              onClick={() => handleScenarioSwitch(item.id as Scenario)}
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

        <div className="p-4 border-t border-slate-800">
          <div className="text-[10px] text-red-400 font-bold mb-3 animate-pulse">
            ※ 注意：切換情境將清空所有未存檔之數據。
          </div>
          <div className="text-[10px] text-slate-600">
            <span className="hidden lg:inline">v2.0 Multi-Scenario Standardized</span>
          </div>
        </div>
      </aside>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden transform animate-in zoom-in-95 duration-300">
            <div className="p-8">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>

              <h3 className="text-xl font-black text-slate-800 text-center mb-4">
                確定要切換填報情境嗎？
              </h3>

              <p className="text-slate-600 text-center text-sm leading-relaxed mb-8">
                警告：切換情境將會清空目前所有已填寫的數據（包含活動數據與產品細項），且無法復原。建議切換前先導出目前計得之碳排量 (<span style={{ textTransform: 'none' }}>kg CO<sub>2</sub>e</span>) 或確認已完成記錄。
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="py-3 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-all active:scale-95"
                >
                  取消
                </button>
                <button
                  onClick={confirmSwitch}
                  className="py-3 px-6 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-200 transition-all active:scale-95"
                >
                  確認切換
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowConfirm(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

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
