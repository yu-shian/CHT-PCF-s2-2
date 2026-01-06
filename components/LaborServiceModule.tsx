import React, { useState, useMemo, useEffect } from 'react';
import { FileText, Save, CheckCircle, AlertTriangle, Info, Download } from 'lucide-react';
import PrecisionNumberInput from './PrecisionNumberInput';
import { ELECTRICITY_FACTORS } from '../constants';
import { calculateFuelEmission, CONVERSION_FACTOR } from '../utils';

// --- Constants & Helpers ---


interface LaborServiceModuleProps {
    onTotalChange?: (val: number) => void;
    externalFactor?: number;
    externalData?: {
        contractHours: number | '';
        totalCompanyHours: number | '';
        mode: 'A' | 'B';
        totalEmissionsA: number | '';
        elecUsage: number | '';
        gasolineUsage: number | '';
        dieselUsage: number | '';
        dieselMobileUsage: number | '';
        elecFactor?: number;
    };
    onDataChange?: (data: any) => void;
    externalContractInfo?: { id: string; name: string };
}

const LaborServiceModule: React.FC<LaborServiceModuleProps> = ({
    onTotalChange,
    externalFactor,
    externalData,
    onDataChange,
    externalContractInfo
}) => {
    // --- State ---
    // --- State (Internal or Parent-driven) ---
    const [contractIdInternal, setContractIdInternal] = useState('');
    const [contractNameInternal, setContractNameInternal] = useState('');

    const [contractHoursInternal, setContractHoursInternal] = useState<number | ''>('');
    const [totalCompanyHoursInternal, setTotalCompanyHoursInternal] = useState<number | ''>('');

    const [modeInternal, setModeInternal] = useState<'A' | 'B'>('A');

    // Mode A Data
    const [totalEmissionsAInternal, setTotalEmissionsAInternal] = useState<number | ''>('');

    // Mode B Data
    const [elecYear, setElecYear] = useState('0.495');

    // Sync with externalFactor if provided
    useEffect(() => {
        if (externalFactor !== undefined) {
            setElecYear(String(externalFactor));
        }
    }, [externalFactor]);

    const [elecUsageInternal, setElecUsageInternal] = useState<number | ''>('');
    const [gasolineUsageInternal, setGasolineUsageInternal] = useState<number | ''>('');
    const [dieselUsageInternal, setDieselUsageInternal] = useState<number | ''>('');
    const [dieselMobileUsageInternal, setDieselMobileUsageInternal] = useState<number | ''>('');

    // Mapping states to use either external or internal values
    const contractId = externalContractInfo?.id ?? contractIdInternal;
    const contractName = externalContractInfo?.name ?? contractNameInternal;

    const contractHours = externalData?.contractHours ?? contractHoursInternal;
    const totalCompanyHours = externalData?.totalCompanyHours ?? totalCompanyHoursInternal;
    const mode = externalData?.mode ?? modeInternal;
    const totalEmissionsA = externalData?.totalEmissionsA ?? totalEmissionsAInternal;
    const elecUsage = externalData?.elecUsage ?? elecUsageInternal;
    const gasolineUsage = externalData?.gasolineUsage ?? gasolineUsageInternal;
    const dieselUsage = externalData?.dieselUsage ?? dieselUsageInternal;
    const dieselMobileUsage = externalData?.dieselMobileUsage ?? dieselMobileUsageInternal;

    // Helper to update both internal and external state
    const updateField = (field: string, value: any) => {
        if (onDataChange) {
            onDataChange({
                contractHours,
                totalCompanyHours,
                mode,
                totalEmissionsA,
                elecUsage,
                gasolineUsage,
                dieselUsage,
                dieselMobileUsage,
                elecFactor: Number(field === 'elecYear' ? value : elecYear),
                [field]: value
            });
        }

        // Always update internal for standalone use cases
        switch (field) {
            case 'contractHours': setContractHoursInternal(value); break;
            case 'totalCompanyHours': setTotalCompanyHoursInternal(value); break;
            case 'mode': setModeInternal(value); break;
            case 'totalEmissionsA': setTotalEmissionsAInternal(value); break;
            case 'elecUsage': setElecUsageInternal(value); break;
            case 'gasolineUsage': setGasolineUsageInternal(value); break;
            case 'dieselUsage': setDieselUsageInternal(value); break;
            case 'dieselMobileUsage': setDieselMobileUsageInternal(value); break;
        }
    };

    // --- Calculations ---
    const calculation = useMemo(() => {
        const cHours = Number(contractHours) || 0;
        const tHours = Number(totalCompanyHours) || 0;
        const ratio = (tHours > 0) ? (cHours / tHours) : 0;

        let totalCompanyEmissions = 0;

        if (mode === 'A') {
            totalCompanyEmissions = Number(totalEmissionsA) || 0;
        } else {
            const elecFactor = parseFloat(elecYear);
            const eUsage = Number(elecUsage) || 0;
            const gasUsage = Number(gasolineUsage) || 0;
            const dieUsage = Number(dieselUsage) || 0;

            const elecEmission = eUsage * elecFactor;
            const gasEmission = calculateFuelEmission(gasUsage, 'gasoline');
            const dieEmission = calculateFuelEmission(dieUsage, 'diesel');

            totalCompanyEmissions = elecEmission + gasEmission + dieEmission;
        }

        const finalResult = totalCompanyEmissions * ratio;

        return {
            ratio,
            totalCompanyEmissions,
            finalResult
        };
    }, [contractHours, totalCompanyHours, mode, totalEmissionsA, elecYear, elecUsage, gasolineUsage, dieselUsage, dieselMobileUsage]);

    // Report Total Change
    useEffect(() => {
        if (onTotalChange) {
            onTotalChange(calculation.finalResult);
        }
    }, [calculation.finalResult, onTotalChange]);

    // --- Handlers ---
    const generateReport = () => {
        if (calculation.finalResult <= 0) {
            alert("請先輸入數據再生成報表！");
            return;
        }

        const cid = contractId || "Unknown_ID";
        const cname = contractName || "未命名契約";

        let rows = [
            ["中華電信供應商碳管理回報報表", ""],
            ["報表生成時間", new Date().toLocaleString()],
            ["", ""],
            ["[1] 契約基本資料", ""],
            ["契約編號", cid],
            ["契約名稱", cname],
            ["", ""],
            ["[2] 分攤邏輯與計算過程", ""],
            ["本項契約總工時 (HR)", String(contractHours || 0)],
            ["全公司同期間總工時 (HR)", String(totalCompanyHours || 0)],
            ["分攤比例 (工時比)", (calculation.ratio * 100).toFixed(4) + "%"],
            ["公式", "契約碳排 = 公司總排放 * 分攤比例"],
            ["", ""]
        ];

        if (mode === 'A') {
            rows.push(["[3] 排放數據數據 (模式 A)", ""]);
            rows.push(["直接填報公司總排放量 (kg CO2e)", String(calculation.totalCompanyEmissions)]);
        } else {
            rows.push(["[3] 能源活動數據 (模式 B)", ""]);
            rows.push(["電力度數 (kWh)", String(elecUsage || 0)]);
            rows.push(["電力係數 (kg CO2e/kWh)", elecYear]);
            rows.push(["汽油用量 (L)", String(gasolineUsage || 0)]);
            rows.push(["柴油 - 固定源用量 (L)", String(dieselUsage || 0)]);
            rows.push(["柴油 - 移動源用量 (L)", String(dieselMobileUsage || 0)]);
            rows.push(["", ""]);
            rows.push(["[4] 核心技術係數備註", ""]);
            rows.push(["GWP 來源", "IPCC AR6 (CO2:1, CH4:27, N2O:273)"]);
            rows.push(["汽油低位熱值", "7609 kcal/L"]);
            rows.push(["柴油熱值 (固定/移動)", "8642 kcal/L"]);
            rows.push(["單位轉換因子 (TJ/kcal)", String(CONVERSION_FACTOR)]);
        }

        rows.push(["", ""]);
        rows.push(["[5] 核算結果", ""]);
        rows.push(["公司總排放量 (kg CO2e)", calculation.totalCompanyEmissions.toFixed(4)]);
        rows.push(["契約執行分攤排放量 (kg CO2e)", calculation.finalResult.toFixed(4)]);

        // CSV Logic
        let csvContent = "\uFEFF"; // UTF-8 BOM
        rows.forEach(row => {
            // Escape quotes if needed, though simple data here mainly
            csvContent += row.join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `CHT_ESG_Report_${cid}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 font-sans text-slate-800">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div className="flex items-center">
                    <div className="text-3xl font-black text-blue-800 mr-2 tracking-tighter">CHT</div>
                    <div className="h-8 w-px bg-gray-300 mx-3 hidden md:block"></div>
                    <h1 className="text-xl font-bold text-blue-900">勞務 / 安裝作業</h1>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center space-x-2 bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100 shadow-sm">
                        <label className="text-sm font-black text-indigo-900 whitespace-nowrap">評估年度</label>
                        <select
                            className="bg-white border-slate-200 text-sm font-bold rounded-xl py-1 pl-2 pr-8 focus:ring-2 focus:ring-indigo-200 cursor-pointer"
                            value={elecYear}
                            onChange={e => {
                                const val = e.target.value;
                                setElecYear(val);
                                updateField('elecYear', val);
                            }}
                        >
                            {Object.entries(ELECTRICITY_FACTORS).map(([year, factor]) => (
                                <option key={year} value={factor}>{year}年 ({factor} kg CO₂e/kWh)</option>
                            ))}
                        </select>
                    </div>
                    <div className="text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full w-fit">
                        系統狀態：計算中
                    </div>
                </div>
            </header>

            {/* Step 1 (Hidden if external info is provided) */}
            {!externalContractInfo && (
                <section className="bg-white rounded-xl shadow-sm border-l-4 border-blue-600 p-6 mb-6">
                    <h2 className="text-lg font-bold text-blue-800 mb-4 flex items-center">
                        <span className="bg-blue-800 text-white rounded-full w-6 h-6 flex items-center justify-center mr-2 text-sm font-black">1</span>
                        契約基本資料
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block font-semibold text-gray-700 mb-2">契約編號</label>
                            <input
                                type="text"
                                placeholder="例如：CHT-2024-XXXX"
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all outline-none"
                                value={contractIdInternal}
                                onChange={e => setContractIdInternal(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block font-semibold text-gray-700 mb-2">契約名稱</label>
                            <input
                                type="text"
                                placeholder="例如：113年基站維修勞務作業"
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all outline-none"
                                value={contractNameInternal}
                                onChange={e => setContractNameInternal(e.target.value)}
                            />
                        </div>
                    </div>
                </section>
            )}

            {/* Step 2 -> becomes 1 if embedded */}
            <section className="bg-white rounded-xl shadow-sm border-l-4 border-blue-600 p-6 mb-6">
                <h2 className="text-lg font-bold text-blue-800 mb-4 flex items-center">
                    <span className="bg-blue-800 text-white rounded-full w-6 h-6 flex items-center justify-center mr-2 text-sm font-black">
                        {externalContractInfo ? '1' : '2'}
                    </span>
                    工時投入分攤 (核算權重)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block font-semibold text-gray-700 mb-2">本項契約總工時 (HR)</label>
                        <PrecisionNumberInput
                            placeholder="本案投入時數"
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all outline-none"
                            value={Number(contractHours)}
                            onChange={val => updateField('contractHours', val)}
                        />
                    </div>
                    <div>
                        <label className="block font-semibold text-gray-700 mb-2">公司同期間總工時 (HR)</label>
                        <PrecisionNumberInput
                            placeholder="全公司總工時"
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all outline-none"
                            value={Number(totalCompanyHours)}
                            onChange={val => updateField('totalCompanyHours', val)}
                        />
                    </div>
                </div>
            </section>

            {/* Step 3 -> becomes 2 if embedded */}
            <section className="bg-white rounded-xl shadow-sm border-l-4 border-blue-600 p-6 mb-6">
                <h2 className="text-lg font-bold text-blue-800 mb-4 flex items-center">
                    <span className="bg-blue-800 text-white rounded-full w-6 h-6 flex items-center justify-center mr-2 text-sm font-black">
                        {externalContractInfo ? '2' : '3'}
                    </span>
                    排放數據填寫
                </h2>

                <div className="mb-6">
                    <label className="font-semibold mb-3 block text-gray-600 text-sm italic">請選擇數據來源模式：</label>
                    <div className="flex space-x-6">
                        <label className="inline-flex items-center cursor-pointer group">
                            <input
                                type="radio"
                                name="mode"
                                value="A"
                                checked={mode === 'A'}
                                onChange={() => updateField('mode', 'A')}
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                            <span className="ml-2 group-hover:text-blue-700 transition-colors">模式 A：直接填寫總排放量</span>
                        </label>
                        <label className="inline-flex items-center cursor-pointer group">
                            <input
                                type="radio"
                                name="mode"
                                value="B"
                                checked={mode === 'B'}
                                onChange={() => updateField('mode', 'B')}
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                            <span className="ml-2 group-hover:text-blue-700 transition-colors font-semibold">模式 B：能源活動數據 (推薦)</span>
                        </label>
                    </div>
                </div>

                {mode === 'A' ? (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-4">
                            <div>
                                <label className="block font-semibold text-gray-700 mb-2">公司該期間總碳排放量 (<span style={{ textTransform: 'none' }}>kg CO<sub>2</sub>e</span>)</label>
                                <PrecisionNumberInput
                                    placeholder="請參考公司 ISO 14064-1 盤查報告"
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all outline-none"
                                    value={Number(totalEmissionsA)}
                                    onChange={val => updateField('totalEmissionsA', val)}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-blue-50 rounded-xl border border-blue-100">
                            <div className="col-span-2">
                                <label className="block font-semibold text-blue-900 mb-2">總用電量 (kWh)</label>
                                <PrecisionNumberInput
                                    className="w-full p-2.5 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all outline-none"
                                    value={Number(elecUsage)}
                                    onChange={val => updateField('elecUsage', val)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-6 border border-orange-200 rounded-xl bg-orange-50/50">
                                <label className="block font-semibold text-orange-900 mb-2">汽油總量 (L)</label>
                                <PrecisionNumberInput
                                    className="w-full p-2.5 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-500 bg-white transition-all outline-none"
                                    value={Number(gasolineUsage)}
                                    onChange={val => updateField('gasolineUsage', val)}
                                />
                            </div>
                            <div className="p-6 border border-emerald-200 rounded-xl bg-emerald-50/50">
                                <label className="block font-semibold text-emerald-900 mb-2">柴油 - 固定源 (L)</label>
                                <PrecisionNumberInput
                                    className="w-full p-2.5 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 bg-white transition-all outline-none"
                                    value={Number(dieselUsage)}
                                    onChange={val => updateField('dieselUsage', val)}
                                />
                                <span className="text-[10px] text-emerald-600/60 mt-1 block">發電機、鍋爐等固定設施</span>
                            </div>
                            <div className="p-6 border border-indigo-200 rounded-xl bg-indigo-50/50">
                                <label className="block font-semibold text-indigo-900 mb-2">柴油 - 移動源 (L)</label>
                                <PrecisionNumberInput
                                    className="w-full p-2.5 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 bg-white transition-all outline-none"
                                    value={Number(dieselMobileUsage)}
                                    onChange={val => updateField('dieselMobileUsage', val)}
                                />
                                <span className="text-[10px] text-indigo-600/60 mt-1 block">工程車輛、貨車等交通工具</span>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* Result Box */}
            <section className="bg-gradient-to-br from-blue-700 to-blue-600 text-white rounded-2xl p-8 shadow-xl mb-8 transform hover:scale-[1.01] transition-transform duration-300">
                <div className="text-blue-200 text-sm uppercase tracking-widest mb-2 font-black">契約執行碳排放核算結果</div>
                <div className="text-5xl font-black mb-4 tabular-nums tracking-tight">
                    {calculation.finalResult.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                    <span className="text-2xl font-medium ml-2 opacity-80" style={{ textTransform: 'none' }}>kg CO<sub>2</sub>e</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 border-t border-blue-500/50 pt-6 text-sm font-medium text-blue-100">
                    <div className="flex justify-between md:justify-start md:space-x-4">
                        <span className="opacity-70">工時分攤佔比</span>
                        <span className="font-bold text-white">{(calculation.ratio * 100).toFixed(4)}%</span>
                    </div>
                    <div className="flex justify-between md:justify-start md:space-x-4">
                        <span className="opacity-70">基準總排放</span>
                        <span className="font-bold text-white">{calculation.totalCompanyEmissions.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} <span style={{ textTransform: 'none' }}>kg CO<sub>2</sub>e</span></span>
                    </div>
                </div>
            </section>

            {!externalContractInfo && (
                <div className="flex flex-col items-center">
                    <button
                        onClick={generateReport}
                        className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-4 px-12 rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center space-x-3"
                    >
                        <Download className="w-6 h-6" />
                        <span className="text-lg">確認並生成報表 (Google Sheets 相容格式)</span>
                    </button>
                    <p className="mt-4 text-xs text-gray-400 italic">※ 點擊後將下載詳細計算報表，您可以上傳至 Google Sheets 進行管理。</p>
                </div>
            )}

            <footer className="mt-16 text-center text-gray-400 text-xs">
                © 2025 中華電信供應商永續管理系統 | ISO 14064-1 & 範疇三勞務計算模組
            </footer>
        </div>
    );
};

export default LaborServiceModule;
