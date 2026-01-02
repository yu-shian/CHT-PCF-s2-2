import React, { useState, useEffect, useCallback } from 'react';
import ProductPCFModule from './ProductPCFModule';
import LaborServiceModule from './LaborServiceModule';
import { Layers, Calendar, Box, FileText, Truck, Factory, Package, Plus, User, Info, Download } from 'lucide-react';
import { ELECTRICITY_FACTORS, INITIAL_MATERIAL_DB, GOOGLE_SHEET_CSV_URL, TRANSPORT_FACTORS } from '../constants';
import StackedBarChart from './StackedBarChart';
import { Contract, MaterialFactor, Product } from '../types';
import { calculateProductTotal, calculateLaborTotal, parseCSVLine } from '../utils';

const ComprehensiveModule: React.FC = () => {
    const [productTotal, setProductTotal] = useState(0);
    const [laborTotal, setLaborTotal] = useState(0);
    const [activeProductBreakdown, setActiveProductBreakdown] = useState({ A: 0, B: 0, C: 0, D: 0 });
    const [aggregateTotal, setAggregateTotal] = useState(0);
    const [productTotals, setProductTotals] = useState<Record<number, number>>({});

    const [contractInfo, setContractInfo] = useState({ id: 'CHT-2024-COMP', name: '【情境四】產品採購 + 安裝勞務' });
    const [laborData, setLaborData] = useState({
        contractHours: '' as number | '',
        totalCompanyHours: '' as number | '',
        mode: 'A' as 'A' | 'B',
        totalEmissionsA: '' as number | '',
        elecUsage: '' as number | '',
        gasolineUsage: '' as number | '',
        dieselUsage: '' as number | ''
    });

    const [globalYear, setGlobalYear] = useState(2023);

    const [contracts, setContracts] = useState<Contract[]>([]);
    const [activeProductId, setActiveProductId] = useState<number | null>(null);
    const [addTrigger, setAddTrigger] = useState(0);

    const electricityFactor = ELECTRICITY_FACTORS[globalYear] || 0.495;
    const grandTotal = aggregateTotal + laborTotal;

    const [materialDB, setMaterialDB] = useState<MaterialFactor[]>(INITIAL_MATERIAL_DB);
    const [isDbLoading, setIsDbLoading] = useState(false);

    // Fetch DB lifted
    useEffect(() => {
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
                            id: String(1000 + index),
                            name,
                            factor,
                            unit1,
                            unit2
                        };
                    });
                    if (parsedData.length > 0) setMaterialDB(parsedData);
                }
            } catch (error) {
                console.error("Failed to fetch Google Sheet:", error);
            } finally {
                setIsDbLoading(false);
            }
        };
        fetchSheetData();
    }, []);

    const generateComprehensiveReport = () => {
        const cid = contractInfo.id || "Unknown_ID";
        const cname = contractInfo.name || "未命名契約";

        let rows: (string | number)[][] = [];
        rows.push(["中華電信綜合契約碳足跡報表", ""]);
        rows.push(["報表生成時間", new Date().toLocaleString()]);
        rows.push(["契約編號", cid]);
        rows.push(["契約名稱", cname]);
        rows.push(["評估年度", globalYear + "年"]);
        rows.push(["電力係數", electricityFactor.toFixed(4) + " kgCO2e/kWh"]);
        rows.push(["", ""]);

        // Part 1 details
        rows.push(["[PART 1] 產品設備明細 (Detailed Product Breakdown)", ""]);
        rows.push(["項目類別", "名稱", "載重重量 (kg)", "運送距離 (km)", "碳排係數(C)", "排放單位(D)", "宣告單位(F)", "碳排放量 (kgCO2e)"]);

        products.forEach(p => {
            const calc = calculateProductTotal(p, materialDB, electricityFactor);
            // Product Group Header
            rows.push(["[產品小計]", p.name, "-", "-", "-", "-", "-", calc.total.toFixed(4)]);

            // Stage A: Materials
            p.materials.forEach(m => {
                const dbFactor = m.useDb ? materialDB.find(db => db.id === m.factorId) : null;
                const f = dbFactor ? dbFactor.factor : (m.customFactor || 0);
                const u1 = dbFactor ? dbFactor.unit1 : (m.customUnit || "kgCO2e");
                const u2 = dbFactor ? dbFactor.unit2 : (m.customUnit || "kg");
                const emission = (Number(m.weight) || 0) * f;
                rows.push(["  (A) 原料零件", m.name || "(未命名)", Number(m.weight) || 0, "-", f.toFixed(4), u1, u2, emission.toFixed(4)]);
            });

            // Stage B: Upstream Transport (Itemized)
            p.upstreamTransport.forEach(t => {
                const material = p.materials.find(m => m.id === t.materialId);
                const materialName = material ? (material.name || "(未命名)") : "(未知零件)";
                const vehicle = TRANSPORT_FACTORS.find(v => v.id === t.vehicleId);
                const f = vehicle ? vehicle.factor : 0;
                const vName = vehicle ? vehicle.name : "未知載具";
                const emission = (Number(t.weight) / 1000) * Number(t.distance) * f;
                rows.push(["  (B) 原料運輸", materialName + " 運送 (" + vName + ")", Number(t.weight) || 0, Number(t.distance) || 0, f.toFixed(4), "kgCO2e", "t*km", emission.toFixed(4)]);
            });

            // Stage C: Manufacturing (Electricity)
            const unitElec = p.manufacturing.mode === 'perUnit'
                ? Number(p.manufacturing.electricityUsage) || 0
                : (Number(p.manufacturing.electricityUsage) || 0) / (Number(p.manufacturing.totalOutput) || 1);
            rows.push(["  (C) 製造電力", p.name + " 生產", unitElec.toFixed(4), "-", electricityFactor.toFixed(4), "kgCO2e", "kWh", calc.C.toFixed(4)]);

            // Stage D: Downstream Transport
            const dWeight = Number(p.downstreamTransport.weight) || 0;
            const dDist = Number(p.downstreamTransport.distance) || 0;
            const dVehicle = TRANSPORT_FACTORS.find(v => v.id === p.downstreamTransport.vehicleId);
            const df = dVehicle ? dVehicle.factor : 0;
            const dvName = dVehicle ? dVehicle.name : "未知載具";
            rows.push(["  (D) 分銷運輸", p.name + " 出貨 (" + dvName + ")", dWeight, dDist, df.toFixed(4), "kgCO2e", "t*km", calc.D.toFixed(4)]);

            rows.push(["", "", "", "", "", "", "", ""]); // spacer
        });
        rows.push(["", ""]);

        // Part 2 details
        rows.push(["[PART 2] 安裝與勞務明細 (Installation & Labor)", ""]);
        const laborCalc = calculateLaborTotal(laborData, electricityFactor);
        if (laborData.mode === 'B') {
            rows.push(["項目", "活動數據", "單位", "排放量 (kgCO2e)"]);
            rows.push(["電力消耗", String(laborData.elecUsage || 0), "kWh", laborCalc.details.elec.toFixed(4)]);
            rows.push(["汽油消耗", String(laborData.gasolineUsage || 0), "L", laborCalc.details.gas.toFixed(4)]);
            rows.push(["柴油消耗", String(laborData.dieselUsage || 0), "L", laborCalc.details.die.toFixed(4)]);
        } else {
            rows.push(["項目", "填報數值", "單位", "排放量 (kgCO2e)"]);
            rows.push(["直接填報公司總排放", String(laborData.totalEmissionsA || 0), "kgCO2e", laborCalc.totalCompanyEmissions.toFixed(4)]);
        }
        rows.push(["分攤比例 (工時比)", (laborCalc.ratio * 100).toFixed(4) + "%", "公式", "契約排放 = 公司總值 * 比例"]);
        rows.push(["勞務分攤結果", laborCalc.finalResult.toFixed(4), "kgCO2e", ""]);
        rows.push(["", ""]);

        // Summary Table (Final Compilation)
        rows.push(["[SUMMARY] 各項排放彙整分析表", ""]);
        rows.push(["類別", "項目名稱", "A.原料零件", "B.原料運輸", "C.製造階段", "D.分銷運輸", "最終碳排值 (kgCO2e)"]);
        products.forEach(p => {
            const calc = calculateProductTotal(p, materialDB, electricityFactor);
            rows.push([
                "產品設備",
                p.name,
                calc.A.toFixed(4),
                calc.B.toFixed(4),
                calc.C.toFixed(4),
                calc.D.toFixed(4),
                calc.total.toFixed(4)
            ]);
        });
        rows.push([
            "安裝勞務",
            "安裝與勞務分攤",
            "-",
            "-",
            "-",
            "-",
            laborCalc.finalResult.toFixed(4)
        ]);
        rows.push(["", "", "", "", "", "全案報表總計", grandTotal.toFixed(4)]);

        // CSV Logic
        let csvContent = "\uFEFF"; // UTF-8 BOM
        rows.forEach(row => {
            csvContent += row.join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `CHT_Comprehensive_Report_${cid}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const products = contracts[0]?.products || [];

    return (
        <div className="flex flex-col min-h-full bg-slate-50 font-sans text-slate-900">
            {/* Global Sync Header */}
            <div className="bg-white border-b border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-50 shadow-sm gap-4">
                <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-6 flex-1">
                    {/* Contract Identity */}
                    <div className="flex items-center space-x-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200 flex-1 max-w-2xl">
                        <FileText className="w-5 h-5 text-slate-400" />
                        <div className="flex flex-1 gap-2">
                            <input
                                type="text"
                                placeholder="契約編號"
                                className="bg-white border border-slate-200 text-xs font-bold rounded-xl py-1 px-3 focus:ring-2 focus:ring-blue-100 outline-none w-1/3"
                                value={contractInfo.id}
                                onChange={(e) => setContractInfo(prev => ({ ...prev, id: e.target.value }))}
                            />
                            <input
                                type="text"
                                placeholder="契約名稱"
                                className="bg-white border border-slate-200 text-xs font-bold rounded-xl py-1 px-3 focus:ring-2 focus:ring-blue-100 outline-none flex-1"
                                value={contractInfo.name}
                                onChange={(e) => setContractInfo(prev => ({ ...prev, name: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        <span className="text-sm font-black text-indigo-900">評估年度</span>
                        <select
                            className="bg-white border-slate-200 text-sm font-bold rounded-xl py-1 pl-2 pr-8 focus:ring-2 focus:ring-indigo-200 cursor-pointer shadow-sm"
                            value={globalYear}
                            onChange={(e) => setGlobalYear(Number(e.target.value))}
                        >
                            {Object.entries(ELECTRICITY_FACTORS).map(([year, factor]) => (
                                <option key={year} value={year}>{year}年 ({factor} kg/kWh)</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={generateComprehensiveReport}
                        className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-2xl font-black text-sm transition-all shadow-lg shadow-emerald-200 active:scale-95"
                    >
                        <Download className="w-4 h-4" />
                        <span>導出全案報表 (CSV)</span>
                    </button>
                </div>
                <div className="hidden lg:block text-[10px] font-bold text-slate-400 max-w-[180px] leading-tight text-right">
                    ※ 此處資訊將全域同步至下方產品與勞務核算模組。
                </div>
            </div>

            <div className="flex flex-1 relative">
                {/* Summary Sidebar - Sticky Context */}
                <aside className="w-80 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 shadow-sm z-20 sticky top-0 h-screen">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex items-center space-x-3 mb-2">
                            <Layers className="w-8 h-8 text-indigo-600" />
                            <div>
                                <h2 className="text-lg font-black text-slate-800 tracking-tight leading-none">綜合契約</h2>
                                <div className="text-xs font-bold text-slate-400 mt-1">產品 + 安裝服務 (情境四)</div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-6 flex-1 overflow-y-auto pb-80">
                        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                    <Box className="w-4 h-4 text-blue-600" />
                                    <span className="text-xs font-black text-blue-900 uppercase tracking-widest">產品設備細項</span>
                                </div>
                                <button
                                    onClick={() => setAddTrigger(prev => prev + 1)}
                                    className="p-1 hover:bg-blue-100 rounded-full text-blue-600 transition-colors"
                                    title="新增產品"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Product Navigation List */}
                            <div className="mb-4 space-y-2 max-h-60 overflow-y-auto pr-1">
                                {products.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => setActiveProductId(p.id)}
                                        className={`w-full group p-3 rounded-2xl cursor-pointer transition-all border ${activeProductId === p.id
                                            ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-100'
                                            : 'bg-white border-slate-100 hover:border-blue-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between pointer-events-none">
                                            <div className="flex items-center space-x-2">
                                                <Box className={`w-3.5 h-3.5 ${activeProductId === p.id ? 'text-blue-100' : 'text-slate-400'}`} />
                                                <span className={`text-xs font-black truncate max-w-[120px] ${activeProductId === p.id ? 'text-white' : 'text-slate-700'}`}>
                                                    {p.name || '未命名產品'}
                                                </span>
                                            </div>
                                            <div className={`text-[10px] font-bold ${activeProductId === p.id ? 'text-blue-200' : 'text-slate-400'}`}>
                                                #{(p.id % 1000).toString().padStart(3, '0')}
                                            </div>
                                        </div>
                                        {/* Individual Total Footprint */}
                                        <div className={`mt-2 flex items-center justify-end space-x-1.5 pt-2 border-t ${activeProductId === p.id ? 'border-blue-500/50 text-blue-50' : 'border-slate-50 text-slate-400'}`}>
                                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Total PCF</span>
                                            <span className="text-sm font-black tabular-nums">
                                                {(productTotals[p.id] || 0.0000).toFixed(4)}
                                            </span>
                                            <span className="text-[10px] font-bold opacity-60">kg</span>
                                        </div>
                                    </div>
                                ))}
                                {products.length === 0 && (
                                    <div className="text-[10px] text-slate-400 italic py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                                        尚無產品，請點擊上方 + 鈕新增
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 pt-3 border-t border-blue-100/50">
                                <div className="text-[10px] font-black text-blue-900/40 uppercase tracking-widest mb-1">本項階段明細</div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-500 flex items-center"><Box className="w-3 h-3 mr-1 opacity-50" /> A. 原料取得</span>
                                    <span className="text-xs font-black text-slate-700">{activeProductBreakdown.A.toFixed(4)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-500 flex items-center"><Truck className="w-3 h-3 mr-1 opacity-50" /> B. 原料運輸</span>
                                    <span className="text-xs font-black text-slate-700">{activeProductBreakdown.B.toFixed(4)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-500 flex items-center"><Factory className="w-3 h-3 mr-1 opacity-50" /> C. 製造階段</span>
                                    <span className="text-xs font-black text-slate-700">{activeProductBreakdown.C.toFixed(4)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-500 flex items-center"><Package className="w-3 h-3 mr-1 opacity-50" /> D. 分銷運輸</span>
                                    <span className="text-xs font-black text-slate-700">{activeProductBreakdown.D.toFixed(4)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 italic">
                            <div className="flex items-center space-x-2 mb-2">
                                <FileText className="w-4 h-4 text-emerald-600" />
                                <span className="text-xs font-black text-emerald-900 uppercase tracking-widest">安裝與勞務</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-500">本案分攤排放</span>
                                <span className="text-xs font-black text-emerald-700">{laborTotal.toFixed(4)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Fixed Bottom Panel */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-slate-50/95 backdrop-blur-md border-t border-slate-200 z-30 space-y-5">
                        <div className="space-y-2">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-0.5">組成占比分析</div>
                            <StackedBarChart
                                data={[
                                    { name: '產品', value: aggregateTotal, color: '#3b82f6', percent: grandTotal > 0 ? aggregateTotal / grandTotal : 0 },
                                    { name: '勞務', value: laborTotal, color: '#10b981', percent: grandTotal > 0 ? laborTotal / grandTotal : 0 },
                                ]}
                            />
                        </div>

                        <div className="pt-2">
                            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 pl-0.5">全案契約排放總量 (Grand Total)</div>
                            <div className="text-4xl font-black text-slate-900 tabular-nums tracking-tighter leading-none">
                                {grandTotal.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                <span className="text-sm font-bold text-slate-400 ml-2 uppercase">kgCO₂e</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-white border-t border-slate-200 text-xs text-slate-400 font-medium text-center">
                        數值自動加總自右側模組
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1">
                    <div className="p-4 lg:p-8 space-y-12 pb-24">
                        {/* Section 1: Product */}
                        <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                            <div className="bg-slate-50 px-6 py-2.5 flex items-center justify-between border-b border-slate-200">
                                <div className="flex items-center space-x-2">
                                    <Box className="w-4 h-4 text-slate-400" />
                                    <span className="font-black text-slate-500 uppercase tracking-widest text-[10px]">Part 1. 產品設備填報</span>
                                </div>
                                {activeProductId && (
                                    <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 animate-pulse">
                                        正在編輯: {products.find(p => p.id === activeProductId)?.name}
                                    </div>
                                )}
                            </div>
                            <div className="p-4 bg-white min-h-[400px]">
                                <ProductPCFModule
                                    onTotalChange={setProductTotal}
                                    onCalculationChange={setActiveProductBreakdown}
                                    onAggregateCalculationChange={React.useCallback((calc: any) => setAggregateTotal(calc.total), [])}
                                    onContractsChange={setContracts}
                                    onActiveProductIdChange={setActiveProductId}
                                    activeProductIdProp={activeProductId}
                                    externalAddTrigger={addTrigger}
                                    externalYear={globalYear}
                                    externalFactor={electricityFactor}
                                    externalContractName={contractInfo.name}
                                    onProductTotalsChange={setProductTotals}
                                    embedded={true}
                                    externalMaterialDB={materialDB}
                                />
                                {!activeProductId && (
                                    <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex items-center justify-center p-8 text-center">
                                        <div className="max-w-xs animate-in fade-in zoom-in duration-500">
                                            <div className="bg-blue-600 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-200">
                                                <Plus className="w-8 h-8 text-white" />
                                            </div>
                                            <h3 className="text-xl font-black text-slate-800 mb-3 tracking-tight">準備好開始填報了嗎？</h3>
                                            <p className="text-sm font-medium text-slate-500 leading-relaxed mb-8">
                                                請先點擊左側「產品設備細項」旁的 <span className="text-blue-600 font-bold">+</span> 按鈕新增項目，即可開始填寫碳足跡資料。
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-center">
                            <div className="h-12 w-px bg-slate-300"></div>
                        </div>

                        {/* Section 2: Labor */}
                        <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm bg-white p-6">
                            <div className="mb-6 font-black text-slate-500 uppercase tracking-widest text-xs border-b border-slate-100 pb-2">
                                Part 2. 安裝與勞務 (全案唯一)
                            </div>
                            <LaborServiceModule
                                onTotalChange={setLaborTotal}
                                externalFactor={electricityFactor}
                                externalData={laborData}
                                onDataChange={setLaborData}
                                externalContractInfo={contractInfo}
                            />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default ComprehensiveModule;
