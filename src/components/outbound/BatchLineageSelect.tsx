export interface ColdBatchOption {
  id: string;
  code: string; // CR-XXXX
  storeName?: string; // 保鲜预冷A区
  storeCode?: string; // BX-01
  gender?: string;
  weightTier?: string;
  specLabel?: string;
  intakeCount?: number;
  availableCount?: number;
  refTaskCode?: string;
  farmerSummary?: string;
}

export interface SpecDemand {
  gender: string;
  weightTier: string;
  count: number;
}
