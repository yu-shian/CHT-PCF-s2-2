
import React from 'react';
import {
  Plus, Trash2, Info, ChevronRight, FileText, Truck,
  Factory, Box, Save, AlertTriangle, CheckCircle,
  Search, X, Database, ChevronDown
} from 'lucide-react';
import { TransportFactor } from './types';

export const INITIAL_MATERIAL_DB = [
  { id: 'm1', name: '鋁合金 (Aluminum)', factor: 6.7, unit1: 'kgCO₂e', unit2: 'kg' },
  { id: 'm2', name: '不鏽鋼 (Stainless Steel)', factor: 6.1, unit1: 'kgCO₂e', unit2: 'kg' },
  { id: 'm3', name: '銅 (Copper)', factor: 3.8, unit1: 'kgCO₂e', unit2: 'kg' },
  { id: 'm4', name: 'ABS 樹脂', factor: 3.1, unit1: 'kgCO₂e', unit2: 'kg' },
  { id: 'm5', name: 'PVC', factor: 2.5, unit1: 'kgCO₂e', unit2: 'kg' },
  { id: 'm6', name: '瓦楞紙板', factor: 0.9, unit1: 'kgCO₂e', unit2: 'kg' },
  { id: 'm7', name: '印刷電路板 (PCB)', factor: 18.5, unit1: 'kgCO₂e', unit2: 'kg' },
];

export const ELECTRICITY_FACTORS: Record<number, number> = {
  2022: 0.495,
  2023: 0.494,
  2024: 0.474,
};

export const TRANSPORT_FACTORS: TransportFactor[] = [
  { id: 't1', name: '大貨車 (柴油)', factor: 0.131, unit: 'kgCO₂e/t-km' },
  { id: 't2', name: '小貨車 (柴油)', factor: 0.587, unit: 'kgCO₂e/t-km' },
  { id: 't3', name: '小貨車 (汽油)', factor: 0.683, unit: 'kgCO₂e/t-km' },
  { id: 't4', name: '國際海運貨物運輸服務', factor: 1.98, unit: 'kgCO₂e/t-km' },
  { id: 't5', name: '國際航運', factor: 1.16, unit: 'kgCO₂e/t-km' },
];

export const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1KicP3sEwRexAy8M3A2xRcQIMbwcB_cmlYEsRWKK_FTw/export?format=csv&gid=0';
