
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, Trash2, FileText, ChevronRight, Box, 
  Truck, Factory, Save, CheckCircle, AlertTriangle, Info, Package
} from 'lucide-react';
import { 
  INITIAL_MATERIAL_DB, 
  ELECTRICITY_FACTORS, 
  TRANSPORT_FACTORS, 
  GOOGLE_SHEET_CSV_URL 
} from './constants';
import { 
  Contract, Product, MaterialFactor, MaterialItem, 
  UpstreamTransport, ManufacturingConfig, DownstreamTransport 
} from './types';
import ConfirmModal from './components/ConfirmModal';
import SearchableSelect from './components/SearchableSelect';
import SimplePieChart from './components/SimplePieChart';

const App: React.FC = () => {
  // --- Data States ---
  const [materialDB, setMaterialDB] = useState<MaterialFactor[]>(INITIAL_MATERIAL_DB);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const [contracts, setContracts] = useState<Contract[]>([
    { id: Date.now(), name: '採購合約 2024-001', products: [] }
  ]);
  const [activeContractId, setActiveContractId] = useState<number>(contracts[0].id);
  const [activeProductId, setActiveProductId] = useState<number | null>(null);

  // --- Modal States ---
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // --- Fetch DB ---
  useEffect(() => {
    const fetchSheetData = async () => {
      setIsDbLoading(true);
      try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL);
        const text = await response.text();
        const rows = text.split('\n').map(row => row.split(','));
        const parsedData = rows.slice(1).map((col, index) => {
            if (!col[1]) return null;
            const name = col[1]?.replace(/^"|"$/g, '').trim(); 
            const factor = parseFloat(col[2]?.replace(/^"|"$/g, '').trim());
            const unit1 = col[3]?.replace(/^"|"$/g, '').trim().replace('2', '₂');
            const unit2 = col[5]?.replace(/^"|"$/g, '').trim().replace('2', '₂');
            if (!name || isNaN(factor)) return null;
            return { id: `sheet_${index}`, name, factor, unit1, unit2 };
        }).filter((item): item is MaterialFactor => item !== null);

        if (parsedData.length > 0) {
            setMaterialDB(parsedData);
            setDbError(null);
        }
      } catch (error) {
        console.error("Failed to fetch Google Sheet:", error);
        setDbError("無法連線至 Google Sheet，使用備用資料庫。");
      } finally {
        setIsDbLoading(false);
      }
    };
    fetchSheetData();
  }, []);

  // --- Helpers ---
  const activeContract = contracts.find(c => c.id === activeContractId);
  const activeProduct = activeContract?.products.find(p => p.id === activeProductId);

  const createDefaultProduct = (name: string): Product => ({
    id: Date.now() + Math.random(),
    name,
    year: 2024,
    hasFullData: false,
    totalOverride: 0,
    materials: [{ id: Date.now(), name: '', weight: 0, factorId: '', customFactor: 0, useDb: true }],
    upstreamTransport: [],
    manufacturing: { mode: 'perUnit', electricityUsage: 0, totalOutput: 1000 },
    downstreamTransport: { weight: 0, distance: 0, vehicleId: 't1' }
  });

  useEffect(() => {
    if (contracts[0].products.length === 0) {
       const newProd = createDefaultProduct('新建產品 A');
       setContracts(prev => {
         const updated = [...prev];
         updated[0].products = [newProd];
         return updated;
       });
       setActiveProductId(newProd.id);
    }
  }, []);

  // --- CRUD Handlers ---
  const handleAddContract = () => {
    const newId = Date.now();
    const newContract: Contract = { id: newId, name: '新採購合約', products: [] };
    setContracts([...contracts, newContract]);
    setActiveContractId(newId);
    setActiveProductId(null);
  };

  const handleAddProduct = (contractId: number) => {
    const newProduct = createDefaultProduct(`新建產品 ${activeContract?.products.length ? activeContract.products.length + 1 : 1}`);
    setContracts(prev => prev.map(c => 
      c.id === contractId ? { ...c, products: [...c.products, newProduct] } : c
    ));
    setActiveContractId(contractId);
    setActiveProductId(newProduct.id);
  };

  const openDeleteContractModal = (id: number, name: string) => {
    setConfirmConfig({
      isOpen: true,
      title: '刪除契約',
      message: `您確定要刪除「${name}」嗎？此動作將連同其下所有產品一併刪除且無法復原。`,
      onConfirm: () => {
        setContracts(prev => {
          const filtered = prev.filter(c => c.id !== id);
          if (activeContractId === id && filtered.length > 0) {
            setActiveContractId(filtered[0].id);
            setActiveProductId(null);
          } else if (filtered.length === 0) {
            const fresh = { id: Date.now(), name: '新採購合約', products: [] };
            setActiveContractId(fresh.id);
            setActiveProductId(null);
            return [fresh];
          }
          return filtered;
        });
        setConfirmConfig(p => ({ ...p, isOpen: false }));
      }
    });
  };

  const openDeleteProductModal = (contractId: number, productId: number, productName: string) => {
    setConfirmConfig({
      isOpen: true,
      title: '刪除產品',
      message: `您確定要刪除「${productName}」嗎？此動作無法復原。`,
      onConfirm: () => {
        setContracts(prev => prev.map(c => 
          c.id === contractId 
            ? { ...c, products: c.products.filter(p => p.id !== productId) } 
            : c
        ));
        if (activeProductId === productId) setActiveProductId(null);
        setConfirmConfig(p => ({ ...p, isOpen: false }));
      }
    });
  };

  const updateContractName = (id: number, name: string) => {
    setContracts(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  };

  const updateProduct = <K extends keyof Product>(key: K, value: Product[K]) => {
    if (!activeProductId) return;
    setContracts(prev => prev.map(c => {
      if (c.id === activeContractId) {
        return {
          ...c,
          products: c.products.map(p => p.id === activeProductId ? { ...p, [key]: value } : p)
        };
      }
      return c;
    }));
  };

  const updateDeepProduct = useCallback((section: string, index: number, field: string, value: any) => {
    const currentContractId = activeContractId;
    const currentProductId = activeProductId;
    if (!currentProductId) return;

    setContracts(prev => prev.map(c => {
      if (c.id === currentContractId) {
        return {
          ...c,
          products: c.products.map(p => {
            if (p.id !== currentProductId) return p;
            
            if (section === 'materials') {
              const newMaterials = [...p.materials];
              newMaterials[index] = { ...newMaterials[index], [field]: value };
              return { ...p, materials: newMaterials };
            }
            if (section === 'upstreamTransport') {
              const newTrans = [...p.upstreamTransport];
              newTrans[index] = { ...newTrans[index], [field]: value };
              return { ...p, upstreamTransport: newTrans };
            }
            if (section === 'manufacturing') {
              return { ...p, manufacturing: { ...p.manufacturing, [field]: value } };
            }
            if (section === 'downstreamTransport') {
              return { ...p, downstreamTransport: { ...p.downstreamTransport, [field]: value } };
            }
            return p;
          })
        };
      }
      return c;
    }));
  }, [activeContractId, activeProductId]);

  // --- Calculations ---
  // Intermediate values use full precision, only final output uses .toFixed(4)
  const calculation = useMemo(() => {
    if (!activeProduct) return { A: 0, B: 0, C: 0, D: 0, total: 0 };
    if (activeProduct.hasFullData) {
      const val = Number(activeProduct.totalOverride) || 0;
      return { A: 0, B: 0, C: 0, D: 0, total: Number(val.toFixed(4)) };
    }
    
    let A = 0;
    activeProduct.materials.forEach(m => {
      let f = m.useDb ? (materialDB.find(db => db.id === m.factorId)?.factor || 0) : Number(m.customFactor);
      A += Number(m.weight) * f;
    });

    let B = 0;
    activeProduct.upstreamTransport.forEach(t => {
      const vFactor = TRANSPORT_FACTORS.find(vf => vf.id === t.vehicleId)?.factor || 0;
      B += (Number(t.weight) / 1000) * Number(t.distance) * vFactor;
    });

    const elecFactor = ELECTRICITY_FACTORS[activeProduct.year] || 0.495;
    let C = 0;
    if (activeProduct.manufacturing.mode === 'perUnit') {
      C = Number(activeProduct.manufacturing.electricityUsage) * elecFactor;
    } else {
      const perUnit = Number(activeProduct.manufacturing.electricityUsage) / (Number(activeProduct.manufacturing.totalOutput) || 1);
      C = perUnit * elecFactor;
    }

    const downTrans = activeProduct.downstreamTransport;
    const downVFactor = TRANSPORT_FACTORS.find(vf => vf.id === downTrans.vehicleId)?.factor || 0;
    const D = (Number(downTrans.weight) / 1000) * Number(downTrans.distance) * downVFactor;

    return {
      A: Number(A.toFixed(4)),
      B: Number(B.toFixed(4)),
      C: Number(C.toFixed(4)),
      D: Number(D.toFixed(4)),
      total: Number((A + B + C + D).toFixed(4))
    };
  }, [activeProduct, materialDB]);

  const transportValidation = useMemo(() => {
    if (!activeProduct) return {};
    const status: Record<number, any> = {};
    activeProduct.materials.forEach(m => {
      const related = activeProduct.upstreamTransport.filter(t => t.materialId === m.id);
      const totalW = related.reduce((sum, t) => sum + Number(t.weight), 0);
      status[m.id] = {
        name: m.name,
        originalWeight: Number(m.weight),
        totalTransportWeight: totalW,
        isValid: totalW >= (Number(m.weight) * 0.999),
        isMissing: related.length === 0
      };
    });
    return status;
  }, [activeProduct]);

  const chartData = useMemo(() => {
    if (calculation.total === 0) return [];
    return [
      { name: '原料 (A)', value: calculation.A, color: '#3B82F6', percent: calculation.A / calculation.total },
      { name: '運輸 (B)', value: calculation.B, color: '#10B981', percent: calculation.B / calculation.total },
      { name: '製造 (C)', value: calculation.C, color: '#F59E0B', percent: calculation.C / calculation.total },
      { name: '成品 (D)', value: calculation.D, color: '#6366F1', percent: calculation.D / calculation.total },
    ];
  }, [calculation]);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans text-slate-800">
      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(p => ({ ...p, isOpen: false }))}
      />

      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 shadow-sm z-20">
        <div className="p-5 bg-blue-900 text-white">
          <h1 className="font-extrabold text-xl tracking-tight">中華電信</h1>
          <p className="text-[10px] uppercase tracking-widest text-blue-300 font-bold mt-1">ISO 14067 碳管理平台</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {contracts.map(contract => (
            <div key={contract.id} className="group/contract border-b border-slate-100 pb-4 last:border-none">
              <div 
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${activeContractId === contract.id ? 'bg-blue-50 text-blue-800 ring-1 ring-blue-100' : 'hover:bg-slate-50 text-slate-600'}`}
                onClick={() => setActiveContractId(contract.id)}
              >
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <FileText className={`w-4 h-4 flex-shrink-0 ${activeContractId === contract.id ? 'text-blue-600' : 'text-slate-400'}`} />
                  <input 
                    type="text"
                    className="bg-transparent border-none focus:outline-none focus:ring-0 text-sm font-bold w-full truncate text-slate-900"
                    value={contract.name}
                    onChange={(e) => updateContractName(contract.id, e.target.value)}
                  />
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); openDeleteContractModal(contract.id, contract.name); }}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover/contract:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-2 ml-4 space-y-1">
                {contract.products.map(product => (
                  <div 
                    key={product.id}
                    onClick={() => { setActiveContractId(contract.id); setActiveProductId(product.id); }}
                    className={`group/product text-xs py-2 px-3 rounded-md cursor-pointer flex items-center justify-between transition-all ${activeProductId === product.id && activeContractId === contract.id ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    <span className="truncate flex-1 font-medium">{product.name}</span>
                    <div className="flex items-center opacity-0 group-hover/product:opacity-100 transition-opacity">
                        <button 
                            onClick={(e) => { e.stopPropagation(); openDeleteProductModal(contract.id, product.id, product.name); }}
                            className={`p-1 rounded-sm ${activeProductId === product.id ? 'text-blue-200 hover:text-white' : 'text-slate-400 hover:text-red-500'}`}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </div>
                  </div>
                ))}
                <button 
                  onClick={() => handleAddProduct(contract.id)} 
                  className="w-full text-left mt-2 py-1.5 px-3 text-[11px] font-bold text-blue-600 hover:bg-blue-50 rounded-md flex items-center transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> 新增產品
                </button>
              </div>
            </div>
          ))}
          
          <button
             onClick={handleAddContract} 
             className="w-full py-3 border-2 border-dashed border-slate-200 text-slate-400 text-sm font-bold hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all flex items-center justify-center"
          >
            <Plus className="w-4 h-4 mr-2" /> 新增契約草案
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeProduct ? (
          <>
            {/* Header */}
            <header className="bg-white border-b border-slate-200 p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-sm z-10">
              <div className="flex-1 min-w-0">
                <input 
                  type="text" 
                  className="text-2xl font-black text-slate-900 border-none focus:ring-0 bg-transparent w-full p-0 placeholder:text-slate-300"
                  value={activeProduct.name}
                  onChange={(e) => updateProduct('name', e.target.value)}
                  placeholder="未命名產品"
                />
                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div className="flex items-center bg-slate-100 px-2 py-1 rounded">
                    年份: 
                    <select 
                      className="ml-2 bg-transparent border-none focus:ring-0 text-slate-800 font-bold"
                      value={activeProduct.year}
                      onChange={(e) => updateProduct('year', Number(e.target.value))}
                    >
                      {Object.keys(ELECTRICITY_FACTORS).map(y => (
                        <option key={y} value={y}>{y} ({ELECTRICITY_FACTORS[Number(y)]})</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center cursor-pointer hover:text-blue-600 transition-colors font-bold">
                    <input 
                      type="checkbox" 
                      className="rounded border-2 border-black bg-white text-black focus:ring-black mr-2 h-4 w-4 appearance-none checked:bg-black checked:border-black relative after:content-['✓'] after:hidden checked:after:block after:absolute after:top-[-3px] after:left-[1px] after:text-white after:text-[10px] after:font-black transition-all"
                      checked={activeProduct.hasFullData}
                      onChange={(e) => updateProduct('hasFullData', e.target.checked)}
                    />
                    已有完整數據
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-8 bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">單位產品碳足跡</p>
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-4xl font-black text-blue-700 tabular-nums">{calculation.total}</span>
                    <span className="text-xs font-bold text-slate-500">kgCO₂e</span>
                  </div>
                </div>
                <SimplePieChart data={chartData} />
              </div>
            </header>

            {/* Editor Area */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-10">
              {activeProduct.hasFullData ? (
                <section className="max-w-3xl bg-white p-8 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="text-xl font-black mb-6 flex items-center text-slate-800">
                    <Save className="w-6 h-6 mr-3 text-blue-600" /> 直接輸入碳排放結果
                  </h3>
                  <div className="flex items-center space-x-4">
                    <div className="relative flex-1">
                      <input 
                        type="number"
                        step="any"
                        className="w-full text-2xl font-bold border-2 border-slate-100 rounded-2xl p-4 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 focus:outline-none transition-all tabular-nums text-slate-900 bg-white"
                        value={activeProduct.totalOverride}
                        onChange={(e) => updateProduct('totalOverride', Number(e.target.value))}
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">kgCO₂e</span>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-slate-500 italic font-medium">※ 使用此模式將跳過細部計算與係數選擇。</p>
                </section>
              ) : (
                <>
                  {/* A: 原料 */}
                  <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-blue-50/50 to-transparent">
                      <h3 className="text-lg font-black text-slate-800 flex items-center uppercase tracking-tight">
                        <Box className="w-5 h-5 mr-3 text-blue-600" /> A. 原料取得階段
                      </h3>
                      <div className="flex items-center bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-100">
                        {isDbLoading && <span className="animate-pulse w-2 h-2 rounded-full bg-blue-500 mr-2"></span>}
                        <span className="text-sm font-black text-blue-700 tabular-nums">{calculation.A} <span className="text-[10px] font-bold text-slate-400">kgCO₂e</span></span>
                      </div>
                    </div>
                    <div className="p-6">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <th className="pb-4 pl-2 w-1/4">零件/資材名稱</th>
                            <th className="pb-4 w-24 text-center">重量 (kg)</th>
                            <th className="pb-4 w-32 text-center">係數來源</th>
                            <th className="pb-4">係數 (kgCO₂e/kg)</th>
                            <th className="pb-4 w-12 text-center">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {activeProduct.materials.map((m, idx) => (
                            <tr key={m.id} className="group hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-2">
                                <input 
                                  type="text" 
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-900 placeholder:text-slate-300"
                                  placeholder="例如：機殼、主板"
                                  value={m.name}
                                  onChange={(e) => updateDeepProduct('materials', idx, 'name', e.target.value)}
                                />
                              </td>
                              <td className="py-3 px-2">
                                <input 
                                  type="number" 
                                  step="any"
                                  className="w-full text-center bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-100 tabular-nums text-slate-900 font-medium"
                                  value={m.weight}
                                  onChange={(e) => updateDeepProduct('materials', idx, 'weight', Number(e.target.value))}
                                />
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex items-center justify-center space-x-2">
                                   <button 
                                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${m.useDb ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                                      onClick={() => updateDeepProduct('materials', idx, 'useDb', true)}
                                   >資料庫</button>
                                   <button 
                                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${!m.useDb ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                                      onClick={() => updateDeepProduct('materials', idx, 'useDb', false)}
                                   >自訂</button>
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                {m.useDb ? (
                                  <SearchableSelect 
                                    options={materialDB}
                                    value={m.factorId}
                                    onChange={(val) => updateDeepProduct('materials', idx, 'factorId', val)}
                                    placeholder="搜尋碳係數..."
                                  />
                                ) : (
                                  <input 
                                    type="number"
                                    step="any"
                                    placeholder="輸入係數"
                                    className="w-full bg-white border border-amber-200 text-slate-900 rounded-lg p-2 focus:ring-2 focus:ring-amber-100 transition-all font-bold tabular-nums"
                                    value={m.customFactor}
                                    onChange={(e) => updateDeepProduct('materials', idx, 'customFactor', Number(e.target.value))}
                                  />
                                )}
                              </td>
                              <td className="py-3 px-2 text-center">
                                <button 
                                  onClick={() => {
                                    const newMaterials = activeProduct.materials.filter((_, i) => i !== idx);
                                    updateProduct('materials', newMaterials);
                                  }}
                                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button 
                        onClick={() => {
                          const newMat = { id: Date.now(), name: '', weight: 0, factorId: '', customFactor: 0, useDb: true };
                          updateProduct('materials', [...activeProduct.materials, newMat]);
                        }}
                        className="mt-6 text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center px-4 py-2 rounded-xl hover:bg-blue-50 transition-all w-fit"
                      >
                        <Plus className="w-4 h-4 mr-2" /> 新增料件項目
                      </button>
                    </div>
                  </section>

                  {/* B: 運輸 */}
                  <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-emerald-50/50 to-transparent">
                      <h3 className="text-lg font-black text-slate-800 flex items-center uppercase tracking-tight">
                        <Truck className="w-5 h-5 mr-3 text-emerald-600" /> B. 原料運輸階段
                      </h3>
                      <div className="flex items-center bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-100">
                        <span className="text-sm font-black text-emerald-700 tabular-nums">{calculation.B} <span className="text-[10px] font-bold text-slate-400">kgCO₂e</span></span>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center">
                          <AlertTriangle className="w-3.5 h-3.5 mr-1 text-emerald-500" /> 運輸重量與原料配對檢核
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {activeProduct.materials.map(m => {
                            const val = transportValidation[m.id];
                            return (
                              <div key={m.id} className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col justify-between shadow-sm">
                                <span className="text-xs font-bold text-slate-600 truncate mb-2">{m.name || '(未命名)'}</span>
                                <div className="flex items-center justify-between">
                                  <div className="text-[10px] font-bold text-slate-400">
                                    {val.totalTransportWeight} / {val.originalWeight} kg
                                  </div>
                                  {val.isValid ? (
                                    <span className="flex items-center text-[10px] font-black text-emerald-600"><CheckCircle className="w-3 h-3 mr-1"/> 合規</span>
                                  ) : (
                                    <span className="flex items-center text-[10px] font-black text-red-500"><AlertTriangle className="w-3 h-3 mr-1"/> 差額</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <th className="pb-4 pl-2 w-1/3">對應料件</th>
                            <th className="pb-4 w-24 text-center">重量 (kg)</th>
                            <th className="pb-4 w-24 text-center">距離 (km)</th>
                            <th className="pb-4">載具/係數</th>
                            <th className="pb-4 w-12 text-center">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {activeProduct.upstreamTransport.map((t, idx) => (
                            <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-2">
                                <select 
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-medium text-slate-900 shadow-sm"
                                  value={t.materialId}
                                  onChange={(e) => updateDeepProduct('upstreamTransport', idx, 'materialId', Number(e.target.value))}
                                >
                                  <option value="">選擇零件...</option>
                                  {activeProduct.materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                              </td>
                              <td className="py-3 px-2">
                                <input 
                                  type="number" 
                                  step="any"
                                  className="w-full text-center bg-white border border-slate-200 rounded-lg p-2 tabular-nums text-slate-900 font-medium"
                                  value={t.weight}
                                  onChange={(e) => updateDeepProduct('upstreamTransport', idx, 'weight', Number(e.target.value))}
                                />
                              </td>
                              <td className="py-3 px-2">
                                <input 
                                  type="number" 
                                  step="any"
                                  className="w-full text-center bg-white border border-slate-200 rounded-lg p-2 tabular-nums text-slate-900 font-medium"
                                  value={t.distance}
                                  onChange={(e) => updateDeepProduct('upstreamTransport', idx, 'distance', Number(e.target.value))}
                                />
                              </td>
                              <td className="py-3 px-2">
                                <select 
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-900 font-bold shadow-sm"
                                  value={t.vehicleId}
                                  onChange={(e) => updateDeepProduct('upstreamTransport', idx, 'vehicleId', e.target.value)}
                                >
                                  {TRANSPORT_FACTORS.map(v => <option key={v.id} value={v.id}>{v.name} ({v.factor})</option>)}
                                </select>
                              </td>
                              <td className="py-3 px-2 text-center">
                                <button 
                                  onClick={() => {
                                    const newT = activeProduct.upstreamTransport.filter((_, i) => i !== idx);
                                    updateProduct('upstreamTransport', newT);
                                  }}
                                  className="p-2 text-slate-300 hover:text-red-500"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button 
                        onClick={() => {
                          const newT = { id: Date.now(), materialId: '', weight: 0, distance: 0, vehicleId: 't1' };
                          updateProduct('upstreamTransport', [...activeProduct.upstreamTransport, newT]);
                        }}
                        className="mt-6 text-sm font-bold text-emerald-600 hover:text-emerald-800 flex items-center px-4 py-2 rounded-xl hover:bg-emerald-50 transition-all w-fit"
                      >
                        <Plus className="w-4 h-4 mr-2" /> 新增運輸段項目
                      </button>
                    </div>
                  </section>

                  {/* C: 製造 */}
                  <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-amber-50/50 to-transparent">
                      <h3 className="text-lg font-black text-slate-800 flex items-center uppercase tracking-tight">
                        <Factory className="w-5 h-5 mr-3 text-amber-600" /> C. 製造階段
                      </h3>
                      <div className="flex items-center bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-100">
                        <span className="text-sm font-black text-amber-700 tabular-nums">{calculation.C} <span className="text-[10px] font-bold text-slate-400">kgCO₂e</span></span>
                      </div>
                    </div>
                    <div className="p-6 space-y-6">
                      <div className="flex flex-col sm:flex-row gap-4 p-1 bg-slate-100 rounded-xl w-fit">
                        <button 
                          className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeProduct.manufacturing.mode === 'perUnit' ? 'bg-white shadow text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                          onClick={() => updateDeepProduct('manufacturing', 0, 'mode', 'perUnit')}
                        >單品直接耗能</button>
                        <button 
                          className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeProduct.manufacturing.mode === 'totalAllocated' ? 'bg-white shadow text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                          onClick={() => updateDeepProduct('manufacturing', 0, 'mode', 'totalAllocated')}
                        >批次產量分攤</button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-2 font-bold">
                            {activeProduct.manufacturing.mode === 'perUnit' ? '單品電力消耗 (kWh)' : '批次總電力消耗 (kWh)'}
                          </label>
                          <input 
                            type="number"
                            step="any"
                            className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xl font-bold focus:ring-2 focus:ring-amber-100 transition-all tabular-nums text-slate-900"
                            value={activeProduct.manufacturing.electricityUsage}
                            onChange={(e) => updateDeepProduct('manufacturing', 0, 'electricityUsage', Number(e.target.value))}
                          />
                        </div>
                        {activeProduct.manufacturing.mode === 'totalAllocated' && (
                          <div className="space-y-2 animate-in fade-in slide-in-from-left-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-2 font-bold">批次總產量 (Unit)</label>
                            <input 
                              type="number"
                              step="any"
                              className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xl font-bold focus:ring-2 focus:ring-amber-100 transition-all tabular-nums text-slate-900"
                              value={activeProduct.manufacturing.totalOutput}
                              onChange={(e) => updateDeepProduct('manufacturing', 0, 'totalOutput', Number(e.target.value))}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* D: 成品運輸 */}
                  <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-50/50 to-transparent">
                      <h3 className="text-lg font-black text-slate-800 flex items-center uppercase tracking-tight">
                        <Package className="w-5 h-5 mr-3 text-indigo-600" /> D. 分銷運輸階段
                      </h3>
                      <div className="flex items-center bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-100">
                        <span className="text-sm font-black text-indigo-700 tabular-nums">{calculation.D} <span className="text-[10px] font-bold text-slate-400">kgCO₂e</span></span>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-2 font-bold">成品重量 (kg)</label>
                          <input 
                            type="number"
                            step="any"
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold focus:ring-2 focus:ring-indigo-100 transition-all tabular-nums text-slate-900"
                            value={activeProduct.downstreamTransport.weight}
                            onChange={(e) => updateDeepProduct('downstreamTransport', 0, 'weight', Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-2 font-bold">運輸距離 (km)</label>
                          <input 
                            type="number"
                            step="any"
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold focus:ring-2 focus:ring-indigo-100 transition-all tabular-nums text-slate-900"
                            value={activeProduct.downstreamTransport.distance}
                            onChange={(e) => updateDeepProduct('downstreamTransport', 0, 'distance', Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-2 font-bold">載具/係數</label>
                          <select 
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold focus:ring-2 focus:ring-indigo-100 transition-all text-sm text-slate-900 shadow-sm"
                            value={activeProduct.downstreamTransport.vehicleId}
                            onChange={(e) => updateDeepProduct('downstreamTransport', 0, 'vehicleId', e.target.value)}
                          >
                            {TRANSPORT_FACTORS.map(v => <option key={v.id} value={v.id}>{v.name} ({v.factor})</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
            <div className="bg-white p-10 rounded-full shadow-2xl mb-8 border border-slate-200 animate-bounce">
              <Box className="w-20 h-20 opacity-20" />
            </div>
            <h2 className="text-xl font-black text-slate-800">尚未選擇產品項目</h2>
            <p className="mt-2 font-bold text-slate-400">請從左側導覽列選擇現有產品或點擊「新增產品」</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
