
export interface MaterialFactor {
  id: string;
  name: string;
  factor: number;
  unit1: string;
  unit2: string;
}

export interface MaterialItem {
  id: number;
  name: string;
  weight: number;
  factorId: string;
  customFactor: number;
  useDb: boolean;
}

export interface UpstreamTransport {
  id: number;
  materialId: number | string;
  weight: number;
  distance: number;
  vehicleId: string;
}

export interface ManufacturingConfig {
  mode: 'perUnit' | 'totalAllocated';
  electricityUsage: number;
  totalOutput: number;
}

export interface DownstreamTransport {
  weight: number;
  distance: number;
  vehicleId: string;
}

export interface Product {
  id: number;
  name: string;
  year: number;
  hasFullData: boolean;
  totalOverride: number;
  materials: MaterialItem[];
  upstreamTransport: UpstreamTransport[];
  manufacturing: ManufacturingConfig;
  downstreamTransport: DownstreamTransport;
}

export interface Contract {
  id: number;
  name: string;
  products: Product[];
}

export interface TransportFactor {
  id: string;
  name: string;
  factor: number;
  unit: string;
}
