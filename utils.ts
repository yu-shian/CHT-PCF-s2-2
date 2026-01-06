import { Product, MaterialFactor } from './types';
import { ELECTRICITY_FACTORS, TRANSPORT_FACTORS } from './constants';

// --- GWP & Fuel Constants ---
export const GWP = { CO2: 1, CH4: 27, N2O: 273 };
export const CONVERSION_FACTOR = 4.1868 * Math.pow(10, -9);
export const FUEL_DATA: Record<string, { name: string; kcal: number; ef: { CO2: number; CH4: number; N2O: number } }> = {
    gasoline: { name: "汽油", kcal: 7609, ef: { CO2: 69300, CH4: 25, N2O: 8 } },
    diesel: { name: "柴油 (固定源)", kcal: 8642, ef: { CO2: 74100, CH4: 3, N2O: 0.6 } },
    diesel_mobile: { name: "柴油 (移動源)", kcal: 8642, ef: { CO2: 74100, CH4: 3.9, N2O: 3.9 } }
};

// --- Calculation Helpers ---

export const calculateFuelEmission = (amount: number, type: 'gasoline' | 'diesel' | 'diesel_mobile') => {
    if (!amount || amount <= 0) return 0;
    const d = FUEL_DATA[type];
    const co2 = amount * d.kcal * CONVERSION_FACTOR * d.ef.CO2 * GWP.CO2;
    const ch4 = amount * d.kcal * CONVERSION_FACTOR * d.ef.CH4 * GWP.CH4;
    const n2o = amount * d.kcal * CONVERSION_FACTOR * d.ef.N2O * GWP.N2O;
    return co2 + ch4 + n2o;
};

export const calculateProductTotal = (product: Product | null, materialDB: MaterialFactor[], electricityFactor: number) => {
    if (!product) return { A: 0, B: 0, C: 0, D: 0, total: 0 };

    if (product.totalOverride > 0) {
        return { A: 0, B: 0, C: 0, D: 0, total: Number(product.totalOverride) };
    }

    // Stage A: Materials
    const A = product.materials.reduce((sum, m) => {
        const factor = m.useDb ? (materialDB.find(db => db.id === m.factorId)?.factor || 0) : m.customFactor;
        return sum + (Number(m.weight) * factor);
    }, 0);

    // Stage B: Upstream Transport
    const B = product.upstreamTransport.reduce((sum, t) => {
        const factor = TRANSPORT_FACTORS.find(v => v.id === t.vehicleId)?.factor || 0;
        return sum + ((Number(t.weight) / 1000) * Number(t.distance) * factor);
    }, 0);

    // Stage C: Manufacturing
    let C = 0;
    const manufacturing = product.manufacturing;
    const factorToUse = 0.606; // 強制固定為 0.606

    if (manufacturing.mode === 'perUnit') {
        C = (Number(manufacturing.electricityUsage) || 0) * factorToUse;
    } else {
        const totalAllocated = (Number(manufacturing.electricityUsage) || 0) * factorToUse;
        C = manufacturing.totalOutput > 0 ? totalAllocated / Number(manufacturing.totalOutput) : 0;
    }

    // Stage D: Downstream Transport
    const D = product.downstreamTransport.reduce((sum, t) => {
        const factor = TRANSPORT_FACTORS.find(v => v.id === t.vehicleId)?.factor || 0;
        return sum + ((Number(t.weight) / 1000) * Number(t.distance) * factor);
    }, 0);

    return { A, B, C, D, total: A + B + C + D };
};

export const calculateLaborTotal = (data: any, electricityFactor: number) => {
    const cHours = Number(data.contractHours) || 0;
    const tHours = Number(data.totalCompanyHours) || 0;
    const ratio = (tHours > 0) ? (cHours / tHours) : 0;

    let totalCompanyEmissions = 0;
    let details = { elec: 0, gas: 0, die: 0 };

    if (data.mode === 'A') {
        totalCompanyEmissions = Number(data.totalEmissionsA) || 0;
    } else {
        const eUsage = Number(data.elecUsage) || 0;
        const gasUsage = Number(data.gasolineUsage) || 0;
        const dieUsage = Number(data.dieselUsage) || 0;
        const dieMobileUsage = Number(data.dieselMobileUsage) || 0;

        details.elec = eUsage * electricityFactor;
        details.gas = calculateFuelEmission(gasUsage, 'gasoline');
        details.die = calculateFuelEmission(dieUsage, 'diesel') + calculateFuelEmission(dieMobileUsage, 'diesel_mobile');

        totalCompanyEmissions = details.elec + details.gas + details.die;
    }

    const finalResult = totalCompanyEmissions * ratio;

    return {
        ratio,
        totalCompanyEmissions,
        finalResult,
        details
    };
};

export const parseCSVLine = (line: string) => {
    const result: string[] = [];
    let start = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
            result.push(line.substring(start, i));
            start = i + 1;
        }
    }
    result.push(line.substring(start));
    return result.map(s => s.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
};
