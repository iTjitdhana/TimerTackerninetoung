/** kg ต่อ 1 หน่วยขาย — parse จาก fg.FG_Size เมื่อ conversion_rate ใน DB ยังเป็น default */
export function deriveKgPerUnitFromFgSize(
  fgSize: string | null | undefined,
): number | null {
  if (!fgSize?.trim()) return null;

  const text = fgSize.trim();

  // ไม่เดาข้อความซับซ้อน เช่น "1*5 แพ็ค"
  if (/\*/.test(text)) return null;

  // ตรวจ กก. ก่อน กรัม — ป้องกัน "1 กก." ถูก match เป็น "1 ก"
  const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:กก\.?|กิโลกรัม|kg)/i);
  if (kgMatch) {
    const kg = Number(kgMatch[1]);
    if (Number.isFinite(kg) && kg > 0) return kg;
  }

  const gramMatch = text.match(
    /(\d+(?:\.\d+)?)\s*(?:กรัม|g(?:ram)?s?)/i,
  );
  if (gramMatch) {
    const grams = Number(gramMatch[1]);
    if (Number.isFinite(grams) && grams > 0) return grams / 1000;
  }

  return null;
}

export function isDefaultConversionRate(rate: number): boolean {
  return rate === 1;
}
