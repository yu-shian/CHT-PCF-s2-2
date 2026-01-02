import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    Plus, Trash2, FileText, ChevronRight, Box,
    Truck, Factory, Save, CheckCircle, AlertTriangle, Info, Package, Download
} from 'lucide-react';
import {
    INITIAL_MATERIAL_DB,
    ELECTRICITY_FACTORS,
    TRANSPORT_FACTORS,
    GOOGLE_SHEET_CSV_URL
} from '../constants';
import { calculateProductTotal, parseCSVLine } from '../utils';
import {
    Contract, Product, MaterialFactor, MaterialItem,
    UpstreamTransport, ManufacturingConfig, DownstreamTransport
} from '../types';
import ConfirmModal from './ConfirmModal';
import SearchableSelect from './SearchableSelect';
import StackedBarChart from './StackedBarChart';
import PrecisionNumberInput from './PrecisionNumberInput';

// --- Helper Functions ---
const createDefaultProduct = (id: number, year?: number): Product => ({
    id,
    name: '新產品 ' + new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
    year: year || 2023,
    hasFullData: false,
    totalOverride: 0,
    materials: [],
    upstreamTransport: [],
    manufacturing: {
        mode: 'perUnit',
        electricityUsage: 0,
        electricityFactor: ELECTRICITY_FACTORS[(year || 2023) as keyof typeof ELECTRICITY_FACTORS] || 0.495,
        totalOutput: 1000
    },
    downstreamTransport: {
        vehicleId: 't1',
        weight: 100,
        distance: 50
    }
});



interface ProductPCFModuleProps {
    onTotalChange?: (val: number) => void;
    onCalculationChange?: (calc: { A: number; B: number; C: number; D: number; total: number }) => void;
    onAggregateCalculationChange?: (calc: { A: number; B: number; C: number; D: number; total: number }) => void;
    onContractsChange?: (contracts: Contract[]) => void;
    onActiveProductIdChange?: (id: number | null) => void;
    activeProductIdProp?: number | null;
    externalAddTrigger?: number;
    externalYear?: number;
    externalContractName?: string;
    embedded?: boolean;
    externalFactor?: number;
    onProductTotalsChange?: (totals: Record<number, number>) => void;
    externalMaterialDB?: MaterialFactor[];
    isAgentMode?: boolean;
}

const ProductPCFModule: React.FC<ProductPCFModuleProps> = ({
    onTotalChange,
    onCalculationChange,
    onAggregateCalculationChange,
    onContractsChange,
    onActiveProductIdChange,
    activeProductIdProp,
    externalAddTrigger,
    externalYear,
    externalContractName,
    embedded = false,
    externalFactor,
    onProductTotalsChange,
    externalMaterialDB,
    isAgentMode = false
}) => {
    // --- Data States ---
    const [materialDB, setMaterialDB] = useState<MaterialFactor[]>(INITIAL_MATERIAL_DB);
    const [isDbLoading, setIsDbLoading] = useState(false);
    const [dbError, setDbError] = useState<string | null>(null);

    // Sync or Fetch materialDB
    useEffect(() => {
        if (externalMaterialDB && externalMaterialDB.length > 0) {
            setMaterialDB(externalMaterialDB);
        } else {
            const fetchSheetData = async () => {
                setIsDbLoading(true);
                try {
                    const response = await fetch(GOOGLE_SHEET_CSV_URL);
                    if (response.ok) {
                        const text = await response.text();
                        const lines = text.split('\n').filter(line => line.trim() !== '');
                        const parsedData: MaterialFactor[] = lines.slice(1).map((line, index) => {
                            const cols = parseCSVLine(line);
                            // C (Index 2) -> factor, D (Index 3) -> unit1 (emission unit), F (Index 5) -> unit2 (declaration unit)
                            const name = cols[1] || 'Unknown';
                            const factor = parseFloat(cols[2]) || 0;
                            const unit1 = cols[3] || 'kgCO2e';
                            const unit2 = cols[5] || 'kg';

                            return {
                                id: String(5000 + index), // Use different range to avoid conflict if any
                                name,
                                factor,
                                unit1,
                                unit2
                            };
                        });
                        if (parsedData.length > 0) setMaterialDB(parsedData);
                    }
                } catch (error) {
                    console.error("Failed to fetch Google Sheet in Product module:", error);
                    setDbError("無法連線至雲端資料庫");
                } finally {
                    setIsDbLoading(false);
                }
            };
            fetchSheetData();
        }
    }, [externalMaterialDB]);

    const [contracts, setContracts] = useState<Contract[]>([
        { id: Date.now(), name: '採購合約 2024-001', products: [] }
    ]);
    const [activeContractId, setActiveContractId] = useState<number>(contracts[0].id);
    const [activeProductId, setActiveProductId] = useState<number | null>(null);

    // Sync activeProductId from Prop
    useEffect(() => {
        if (activeProductIdProp !== undefined && activeProductIdProp !== activeProductId) {
            setActiveProductId(activeProductIdProp);
        }
    }, [activeProductIdProp]);

    // External Add Trigger
    useEffect(() => {
        if (externalAddTrigger && externalAddTrigger > 0) {
            addProduct();
        }
    }, [externalAddTrigger]);

    // Force Sync External Year/Factor to all products
    useEffect(() => {
        if (externalYear === undefined && externalFactor === undefined) return;

        setContracts(prev => prev.map(contract => ({
            ...contract,
            products: contract.products.map(product => ({
                ...product,
                year: externalYear !== undefined ? externalYear : product.year,
                manufacturing: {
                    ...product.manufacturing,
                    electricityFactor: externalFactor !== undefined ? externalFactor : product.manufacturing.electricityFactor
                }
            }))
        })));
    }, [externalYear, externalFactor]);

    // Force Sync External Contract Name
    useEffect(() => {
        if (externalContractName !== undefined) {
            setContracts(prev => prev.map(c => ({ ...c, name: externalContractName })));
        }
    }, [externalContractName]);

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
        onConfirm: () => { }
    });



    // --- Derived State ---
    const activeContract = contracts.find(c => c.id === activeContractId) || contracts[0];
    const activeProduct = activeContract.products.find(p => p.id === activeProductId) || null;

    const electricityFactor = externalFactor !== undefined ? externalFactor : (ELECTRICITY_FACTORS[activeProduct?.year || 2023] || 0.495);

    // --- Calculation Logic ---
    const calculation = useMemo(() => {
        return calculateProductTotal(activeProduct, materialDB, electricityFactor);
    }, [activeProduct, materialDB, electricityFactor]);

    // Report Total and Breakdown Change to Parent
    const lastActiveBreakdown = useRef<{ A: number; B: number; C: number; D: number; total: number } | null>(null);
    useEffect(() => {
        if (onTotalChange) {
            onTotalChange(calculation.total);
        }
        if (activeProduct && onCalculationChange) {
            // Only report if values changed to avoid re-render loops
            if (!lastActiveBreakdown.current ||
                lastActiveBreakdown.current.A !== calculation.A ||
                lastActiveBreakdown.current.B !== calculation.B ||
                lastActiveBreakdown.current.C !== calculation.C ||
                lastActiveBreakdown.current.D !== calculation.D ||
                lastActiveBreakdown.current.total !== calculation.total) {
                lastActiveBreakdown.current = calculation;
                onCalculationChange(calculation);
            }
        }
    }, [calculation, onTotalChange, onCalculationChange, activeProduct]);

    // Report Aggregates and Sync Lists
    const lastAggregate = useRef<{ A: number; B: number; C: number; D: number; total: number } | null>(null);
    const lastProductTotals = useRef<string>('');
    const lastContracts = useRef<Contract[] | null>(null);
    const lastActiveId = useRef<number | null | undefined>(undefined);

    useEffect(() => {
        // Only report contracts if reference changed
        if (onContractsChange && lastContracts.current !== contracts) {
            lastContracts.current = contracts;
            onContractsChange(contracts);
        }

        // Only report active ID if value changed
        if (onActiveProductIdChange && lastActiveId.current !== activeProductId) {
            lastActiveId.current = activeProductId;
            onActiveProductIdChange(activeProductId);
        }

        if (onAggregateCalculationChange) {
            // Aggregate all products in active contract
            const totalsMap: Record<number, number> = {};
            const aggregate = activeContract.products.reduce((acc, p) => {
                const calc = calculateProductTotal(p, materialDB, electricityFactor);
                totalsMap[p.id] = calc.total;
                return {
                    A: acc.A + calc.A,
                    B: acc.B + calc.B,
                    C: acc.C + calc.C,
                    D: acc.D + calc.D,
                    total: acc.total + calc.total
                };
            }, { A: 0, B: 0, C: 0, D: 0, total: 0 });

            // Stable object check for aggregate
            if (!lastAggregate.current ||
                lastAggregate.current.A !== aggregate.A ||
                lastAggregate.current.B !== aggregate.B ||
                lastAggregate.current.C !== aggregate.C ||
                lastAggregate.current.D !== aggregate.D ||
                lastAggregate.current.total !== aggregate.total) {
                lastAggregate.current = aggregate;
                onAggregateCalculationChange(aggregate);
            }

            // Stable check for totalsMap
            const totalsStr = JSON.stringify(totalsMap);
            if (onProductTotalsChange && lastProductTotals.current !== totalsStr) {
                lastProductTotals.current = totalsStr;
                onProductTotalsChange(totalsMap);
            }
        }
    }, [contracts, activeContract, activeProductId, onContractsChange, onActiveProductIdChange, onAggregateCalculationChange, onProductTotalsChange, materialDB, electricityFactor]);

    // Validation Logic
    const transportValidation = useMemo(() => {
        if (!activeProduct) return {};
        const result: Record<number, { totalTransportWeight: number; originalWeight: number; isValid: boolean }> = {};

        activeProduct.materials.forEach(m => {
            const transportWeight = activeProduct.upstreamTransport
                .filter(t => t.materialId === m.id)
                .reduce((sum, t) => sum + Number(t.weight), 0);

            const originalWeight = Number(m.weight);
            // Allow small float diff
            const isValid = Math.abs(transportWeight - originalWeight) < 0.01;

            result[m.id] = { totalTransportWeight: transportWeight, originalWeight, isValid };
        });
        return result;
    }, [activeProduct]);


    // --- Handlers ---
    const updateContractName = (name: string) => {
        setContracts(prev => prev.map(c => c.id === activeContractId ? { ...c, name } : c));
    };

    const addProduct = () => {
        const newProduct = createDefaultProduct(Date.now(), externalYear);
        setContracts(prev => prev.map(c => {
            if (c.id === activeContractId) {
                return { ...c, products: [...c.products, newProduct] };
            }
            return c;
        }));
        setActiveProductId(newProduct.id);
    };

    const updateProduct = (key: keyof Product, value: any) => {
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

    const updateDeepProduct = (section: keyof Product, index: number, field: string, value: any) => {
        if (!activeProduct) return;

        // Explicitly handle each section to satisfy TypeScript union constraints
        if (section === 'materials') {
            const currentSection = activeProduct.materials;
            const newSection = [...currentSection];
            newSection[index] = { ...newSection[index], [field]: value };
            updateProduct('materials', newSection);
        } else if (section === 'upstreamTransport') {
            const currentSection = activeProduct.upstreamTransport;
            const newSection = [...currentSection];
            newSection[index] = { ...newSection[index], [field]: value };
            updateProduct('upstreamTransport', newSection);
        } else if (section === 'manufacturing') {
            const currentSection = activeProduct.manufacturing;
            const newObj = { ...currentSection, [field]: value };
            updateProduct('manufacturing', newObj);
        } else if (section === 'downstreamTransport') {
            const currentSection = activeProduct.downstreamTransport;
            const newObj = { ...currentSection, [field]: value };
            updateProduct('downstreamTransport', newObj);
        }
    };

    const deleteProduct = (pid: number) => {
        setConfirmConfig({
            isOpen: true,
            title: "刪除產品",
            message: "確定要刪除此產品項目嗎？此動作無法復原。",
            onConfirm: () => {
                setContracts(prev => prev.map(c => {
                    if (c.id !== activeContractId) return c;
                    return { ...c, products: c.products.filter(p => p.id !== pid) };
                }));
                if (activeProductId === pid) setActiveProductId(null);
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const generateProductReport = () => {
        if (!activeProduct) return;

        let rows: (string | number)[][] = [];
        rows.push(["產品碳足跡評估報告", ""]);
        rows.push(["產品名稱", activeProduct.name]);
        rows.push(["評估年度", activeProduct.year]);
        rows.push(["", ""]);

        // Summary
        rows.push(["階段", "排放量 (kgCO2e)", "占比"]);
        rows.push(["A.原料取得", calculation.A, (calculation.A / calculation.total * 100).toFixed(4) + "%"]);
        rows.push(["B.原料運輸", calculation.B, (calculation.B / calculation.total * 100).toFixed(4) + "%"]);
        rows.push(["C.製造階段", calculation.C, (calculation.C / calculation.total * 100).toFixed(4) + "%"]);
        rows.push(["D.分銷運輸", calculation.D, (calculation.D / calculation.total * 100).toFixed(4) + "%"]);
        rows.push(["總計", calculation.total, "100%"]);
        rows.push(["", ""]);

        // Details - Full Precision Export
        rows.push(["詳細數據", ""]);

        // A. Materials
        activeProduct.materials.forEach(m => {
            const factor = m.useDb ? (materialDB.find(db => db.id === m.factorId)?.factor || 0) : m.customFactor;
            const unit = m.useDb ? (materialDB.find(db => db.id === m.factorId)?.unit2 || 'kg') : (m.customUnit || 'kg');
            const subtotal = Number(m.weight) * factor;
            rows.push(["A.原料", m.name, m.weight, unit, factor, subtotal]);
        });
        rows.push(["", "", "", "", "A階段小計", calculation.A]);

        // B. Upstream Transport
        activeProduct.upstreamTransport.forEach(t => {
            const matName = activeProduct.materials.find(m => m.id === t.materialId)?.name || '未指定';
            const vFactor = TRANSPORT_FACTORS.find(vf => vf.id === t.vehicleId)?.factor || 0;
            const subtotal = (Number(t.weight) / 1000) * Number(t.distance) * vFactor;
            rows.push(["B.原料運輸", `運輸 - ${matName} `, `${t.weight} kg / ${t.distance} km`, "t-km", vFactor, subtotal]);
        });
        rows.push(["", "", "", "", "B階段小計", calculation.B]);

        // C. Manufacturing
        const cVal = calculation.C;
        rows.push(["C.製造", "電力消耗", activeProduct.manufacturing.electricityUsage, "kWh", ELECTRICITY_FACTORS[activeProduct.year as keyof typeof ELECTRICITY_FACTORS], cVal]);
        rows.push(["", "", "", "", "C階段小計", calculation.C]);

        // D. Downstream Transport
        const dTrans = activeProduct.downstreamTransport;
        const dFactor = TRANSPORT_FACTORS.find(vf => vf.id === dTrans.vehicleId)?.factor || 0;
        rows.push(["D.分銷運輸", `成品運輸`, `${dTrans.weight} kg / ${dTrans.distance} km`, "t-km", dFactor, calculation.D]);

        // CSV Logic
        let csvContent = "\uFEFF";
        rows.forEach(row => {
            csvContent += row.join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `PCF_Report_${activeProduct.name}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className={`flex ${embedded ? 'flex-col h-auto bg-white' : 'min-h-full bg-slate-50'} font-sans text-slate-900`}>
            {/* Sidebar - Navigation for Product (Hidden in Embedded Mode) */}
            {!embedded && (
                <aside className="w-80 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 shadow-sm z-20 sticky top-0 h-screen">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex items-center space-x-3 mb-4">
                            <Box className="w-8 h-8 mr-3 text-blue-600" />
                            <div>
                                <h2 className="text-lg font-black text-slate-800 tracking-tight leading-none">產品契約</h2>
                                <div className="text-xs font-bold text-slate-400 mt-1">設備採購情境 (二/三)</div>
                            </div>
                        </div>
                        <input
                            type="text"
                            value={activeContract.name}
                            onChange={(e) => updateContractName(e.target.value)}
                            className="w-full text-sm font-bold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-56">
                        <div className="flex justify-between items-center px-2 mb-2">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">產品列表</span>
                            <button onClick={addProduct} className="p-1 hover:bg-slate-100 rounded-full text-blue-600 transition-colors">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        {activeContract.products.map(p => (
                            <div
                                key={p.id}
                                onClick={() => setActiveProductId(p.id)}
                                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${activeProductId === p.id ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'}`}
                            >
                                <div className="flex items-center space-x-3 overflow-hidden">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.hasFullData ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                    <span className={`text-sm font-bold truncate ${activeProductId === p.id ? 'text-blue-900' : 'text-slate-600'}`}>
                                        {p.name}
                                    </span>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteProduct(p.id); }}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Bottom Panel: Chart & Total (Fixed Position within Aside) */}
                    {activeProduct && (
                        <div className="absolute bottom-0 left-0 right-0 p-5 bg-slate-50/90 backdrop-blur-md border-t border-slate-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.03)] z-30">
                            <div className="mb-5">
                                <StackedBarChart
                                    data={[
                                        { name: '原料', value: calculation.A, color: '#3b82f6', percent: calculation.total > 0 ? calculation.A / calculation.total : 0 },
                                        { name: '運輸', value: calculation.B, color: '#10b981', percent: calculation.total > 0 ? calculation.B / calculation.total : 0 },
                                        { name: '製造', value: calculation.C, color: '#f59e0b', percent: calculation.total > 0 ? calculation.C / calculation.total : 0 },
                                        { name: '分銷', value: calculation.D, color: '#6366f1', percent: calculation.total > 0 ? calculation.D / calculation.total : 0 },
                                    ]}
                                />
                            </div>
                            <div className="flex items-end justify-between">
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">本項產品碳足跡</div>
                                    <div className="text-3xl font-black text-slate-800 tabular-nums leading-none">
                                        {calculation.total.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                        <span className="text-xs font-bold text-slate-400 ml-1.5 uppercase">kgCO₂e</span>
                                    </div>
                                </div>
                                <button
                                    onClick={generateProductReport}
                                    className="bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center transform active:scale-95"
                                    title="下載報告"
                                >
                                    <Download className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </aside>
            )}

            {/* Main Content */}
            <main className={`flex-1 flex flex-col relative`}>
                {isAgentMode && (
                    <div className="m-4 bg-blue-50 border-l-4 border-blue-500 p-4 shadow-sm rounded-r-lg flex items-start space-x-3">
                        <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-blue-700 font-medium">
                            代理商請向供應商要求 ABCD 數據填寫，或將帳號交由供應商操作。
                        </p>
                    </div>
                )}
                {activeProduct ? (
                    <>
                        {/* Compact Header */}
                        <div className={`${embedded ? 'static border bg-slate-50 rounded-xl mb-4' : 'sticky top-0 bg-white/80 backdrop-blur-md border-b'} border-slate-200 p-4 flex items-center justify-between z-40`}>
                            <div className="flex items-center space-x-4">
                                <input
                                    type="text"
                                    className="text-xl font-black bg-transparent border-none focus:ring-0 text-slate-800 placeholder-slate-300 w-64"
                                    value={activeProduct.name}
                                    onChange={(e) => updateProduct('name', e.target.value)}
                                    placeholder="產品名稱"
                                />
                                {!embedded && (
                                    <>
                                        <div className="h-6 w-px bg-slate-200"></div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xs font-bold text-slate-400">評估年度</span>
                                            <select
                                                className="bg-slate-100 border-none text-xs font-bold rounded-lg py-1 pl-2 pr-6 focus:ring-2 focus:ring-blue-200 cursor-pointer"
                                                value={activeProduct.year}
                                                onChange={(e) => {
                                                    const newYear = Number(e.target.value);
                                                    updateProduct('year', newYear);
                                                    // Auto-update electricity factor
                                                    const fact = ELECTRICITY_FACTORS[newYear as keyof typeof ELECTRICITY_FACTORS] || 0.495;
                                                    updateDeepProduct('manufacturing', 0, 'electricityFactor', fact);
                                                }}
                                                disabled={externalFactor !== undefined}
                                            >
                                                {Object.entries(ELECTRICITY_FACTORS).map(([year, factor]) => (
                                                    <option key={year} value={year}>{year}年 ({factor} kg/kWh)</option>
                                                ))}
                                            </select>
                                            <div className="h-6 w-px bg-slate-200 mx-2"></div>
                                            <span className="text-xs font-bold text-slate-400">電力係數</span>
                                            <div className="relative">
                                                <PrecisionNumberInput
                                                    className="w-20 bg-blue-50 border-none text-xs font-bold rounded-lg py-1 px-2 text-blue-700 focus:ring-2 focus:ring-blue-200"
                                                    value={externalFactor ?? activeProduct.manufacturing.electricityFactor}
                                                    onChange={(val) => updateDeepProduct('manufacturing', 0, 'electricityFactor', val)}
                                                    readOnly={externalFactor !== undefined}
                                                />
                                                <span className="ml-1 text-[10px] text-slate-400 font-bold">kg/kWh</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <label className="flex items-center cursor-pointer group">
                                <div className="mr-3 text-right">
                                    <div className="text-xs font-bold text-slate-500 group-hover:text-blue-600 transition-colors">已有完整盤查數據？</div>
                                    <div className="text-[10px] text-slate-400 font-medium">直接輸入總量模式</div>
                                </div>
                                <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${activeProduct.hasFullData ? 'bg-blue-600' : 'bg-slate-200'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${activeProduct.hasFullData ? 'translate-x-6' : ''}`} />
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={activeProduct.hasFullData || false}
                                    onChange={(e) => updateProduct('hasFullData', e.target.checked)}
                                />
                            </label>
                        </div>

                        {/* Content Area */}
                        <div className={`p-4 lg:p-6 space-y-6 ${embedded ? '' : 'pb-24'}`}>
                            {activeProduct.hasFullData ? (
                                <section className="w-full bg-white p-8 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
                                    <h3 className="text-xl font-black mb-6 flex items-center text-slate-800">
                                        <Save className="w-6 h-6 mr-3 text-blue-600" /> 輸入碳足跡值
                                    </h3>
                                    <div className="flex items-center space-x-4">
                                        <div className="relative flex-1">
                                            <PrecisionNumberInput
                                                className="w-full text-2xl font-bold border-2 border-slate-100 rounded-2xl p-4 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 focus:outline-none transition-all tabular-nums text-slate-900 bg-white"
                                                value={activeProduct.totalOverride}
                                                onChange={(val) => updateProduct('totalOverride', val)}
                                            />
                                            <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">kgCO₂e</span>
                                        </div>
                                    </div>
                                    <p className="mt-4 text-sm text-slate-500 italic font-medium">※ 使用此模式將跳過細部計算與係數選擇，並於 Earth 系統中上傳佐證資料。</p>
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
                                                <span className="text-sm font-black text-blue-700 tabular-nums">{calculation.A.toFixed(4)} <span className="text-[10px] font-bold text-slate-400">kgCO₂e</span></span>
                                            </div>
                                        </div>

                                        <div className="p-6">
                                            <table className="w-full text-sm text-left">
                                                <thead>
                                                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                        <th className="pb-4 pl-2 w-1/4">材料名稱</th>
                                                        <th className="pb-4 w-40 text-center">用量 / 規模</th>
                                                        <th className="pb-4 w-32 text-center">模式</th>
                                                        <th className="pb-4 pl-4">碳排係數</th>
                                                        <th className="pb-4 w-12 text-center">操作</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {activeProduct.materials.map((m, idx) => {
                                                        const activeUnit = m.useDb ? (materialDB.find(db => db.id === m.factorId)?.unit2) : m.customUnit;
                                                        return (
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
                                                                    <div className="flex items-center space-x-2">
                                                                        <PrecisionNumberInput
                                                                            className="w-full text-center bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-100 tabular-nums text-slate-900 font-medium"
                                                                            value={m.weight}
                                                                            onChange={(val) => updateDeepProduct('materials', idx, 'weight', val)}
                                                                        />
                                                                        <span className="text-xs font-bold text-slate-400 whitespace-nowrap w-8">
                                                                            {activeUnit || 'kg'}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="py-3 px-2 text-center">
                                                                    <div className="flex justify-center space-x-1 bg-slate-100 p-1 rounded-lg flex-nowrap min-w-fit">
                                                                        <button
                                                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border whitespace-nowrap ${m.useDb ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                                                                            onClick={() => updateDeepProduct('materials', idx, 'useDb', true)}
                                                                        >資料庫</button>
                                                                        <button
                                                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border whitespace-nowrap ${!m.useDb ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
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
                                                                        <div className="flex items-center space-x-2">
                                                                            <PrecisionNumberInput
                                                                                placeholder="輸入係數"
                                                                                className="w-2/3 bg-white border border-amber-200 text-slate-900 rounded-lg p-2 focus:ring-2 focus:ring-amber-100 transition-all font-bold tabular-nums"
                                                                                value={m.customFactor}
                                                                                onChange={(val) => updateDeepProduct('materials', idx, 'customFactor', val)}
                                                                            />
                                                                            <span className="text-slate-400 font-bold">/</span>
                                                                            <input
                                                                                type="text"
                                                                                placeholder="單位"
                                                                                className="w-1/3 bg-white border border-amber-200 text-slate-500 rounded-lg p-2 focus:ring-2 focus:ring-amber-100 transition-all text-xs text-center"
                                                                                value={m.customUnit || ''}
                                                                                onChange={(e) => updateDeepProduct('materials', idx, 'customUnit', e.target.value)}
                                                                            />
                                                                        </div>
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
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                            <button
                                                onClick={() => {
                                                    const newMaterial = { id: Date.now(), name: '', weight: 0, factorId: '', customFactor: 0, useDb: true };
                                                    updateProduct('materials', [...activeProduct.materials, newMaterial]);
                                                }}
                                                className="mt-6 text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center px-4 py-2 rounded-xl hover:bg-blue-50 transition-all w-fit"
                                            >
                                                <Plus className="w-4 h-4 mr-2" /> 新增材料項目
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
                                                <span className="text-sm font-black text-emerald-700 tabular-nums">{calculation.B.toFixed(4)} <span className="text-[10px] font-bold text-slate-400">kgCO₂e</span></span>
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
                                                                        <span className="flex items-center text-[10px] font-black text-emerald-600"><CheckCircle className="w-3 h-3 mr-1" /> 合規</span>
                                                                    ) : (
                                                                        <span className="flex items-center text-[10px] font-black text-red-500"><AlertTriangle className="w-3 h-3 mr-1" /> 差額</span>
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
                                                                <PrecisionNumberInput
                                                                    className="w-full text-center bg-white border border-slate-200 rounded-lg p-2 tabular-nums text-slate-900 font-medium"
                                                                    value={t.weight}
                                                                    onChange={(val) => updateDeepProduct('upstreamTransport', idx, 'weight', val)}
                                                                />
                                                            </td>
                                                            <td className="py-3 px-2">
                                                                <PrecisionNumberInput
                                                                    className="w-full text-center bg-white border border-slate-200 rounded-lg p-2 tabular-nums text-slate-900 font-medium"
                                                                    value={t.distance}
                                                                    onChange={(val) => updateDeepProduct('upstreamTransport', idx, 'distance', val)}
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
                                                <span className="text-sm font-black text-amber-700 tabular-nums">{calculation.C.toFixed(4)} <span className="text-[10px] font-bold text-slate-400">kgCO₂e</span></span>
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
                                                    <PrecisionNumberInput
                                                        className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xl font-bold focus:ring-2 focus:ring-amber-100 transition-all tabular-nums text-slate-900"
                                                        value={activeProduct.manufacturing.electricityUsage}
                                                        onChange={(val) => updateDeepProduct('manufacturing', 0, 'electricityUsage', val)}
                                                    />
                                                </div>
                                                {activeProduct.manufacturing.mode === 'totalAllocated' && (
                                                    <div className="space-y-2 animate-in fade-in slide-in-from-left-4">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-2 font-bold">批次總產量 (Unit)</label>
                                                        <PrecisionNumberInput
                                                            className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xl font-bold focus:ring-2 focus:ring-amber-100 transition-all tabular-nums text-slate-900"
                                                            value={activeProduct.manufacturing.totalOutput}
                                                            onChange={(val) => updateDeepProduct('manufacturing', 0, 'totalOutput', val)}
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
                                                <span className="text-sm font-black text-indigo-700 tabular-nums">{calculation.D.toFixed(4)} <span className="text-[10px] font-bold text-slate-400">kgCO₂e</span></span>
                                            </div>
                                        </div>
                                        <div className="p-6">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-2 font-bold">成品重量 (kg)</label>
                                                    <PrecisionNumberInput
                                                        className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold focus:ring-2 focus:ring-indigo-100 transition-all tabular-nums text-slate-900"
                                                        value={activeProduct.downstreamTransport.weight}
                                                        onChange={(val) => updateDeepProduct('downstreamTransport', 0, 'weight', val)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-2 font-bold">運輸距離 (km)</label>
                                                    <PrecisionNumberInput
                                                        className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold focus:ring-2 focus:ring-indigo-100 transition-all tabular-nums text-slate-900"
                                                        value={activeProduct.downstreamTransport.distance}
                                                        onChange={(val) => updateDeepProduct('downstreamTransport', 0, 'distance', val)}
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
                        {/* Modal */}
                        <ConfirmModal
                            isOpen={confirmConfig.isOpen}
                            title={confirmConfig.title}
                            message={confirmConfig.message}
                            onConfirm={confirmConfig.onConfirm}
                            onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                        <div className="bg-white p-10 rounded-full shadow-2xl mb-8 border border-slate-200">
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

export default ProductPCFModule;
