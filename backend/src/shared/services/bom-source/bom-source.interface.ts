export const BOM_SOURCE_PROVIDER = "BOM_SOURCE_PROVIDER";

export interface BomSourceComponent {
  rawCode: string;
  /** db: undefined (ใช้ชื่อจาก material table), http: rm_name */
  rawName?: string;
  rawQty: number;
  rawUnit: string;
  lineOrder?: number;
}

export interface BomFormula {
  fgCode: string;
  productName?: string;
  /** ข้อมูลเสริมจาก API */
  batchSize?: number;
  batchUnit?: string;
  components: BomSourceComponent[];
}

export interface BomSourceProvider {
  getFormula(fgCode: string): Promise<BomFormula | null>;
}
