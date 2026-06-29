import { Injectable } from "@nestjs/common";
import { Observable, Subject } from "rxjs";
import { filter, map } from "rxjs/operators";

type ProductionTimerEvent = {
  jobId: string;
  payload: unknown;
};

/**
 * In-memory pub/sub สำหรับ Production Timer (singleton ตัวเดียวทั้ง process).
 *
 * - ใช้ rxjs Subject เป็น event bus — ไม่ใช้ DB connection เพิ่มเลย
 * - dedup ด้วย signature เพื่อกันส่ง payload ซ้ำ (เช่น mutation emit แล้ว poller มา emit ค่าเดิม)
 * - นับ subscriber รายเหตุ jobId เพื่อให้ poller รู้ว่าต้องเฝ้างานไหนบ้าง (เฝ้าเฉพาะงานที่มีคนเปิดดู)
 */
@Injectable()
export class ProductionTimerEventsService {
  private readonly stream$ = new Subject<ProductionTimerEvent>();
  private readonly signatures = new Map<string, string>();
  private readonly subscriberCounts = new Map<string, number>();

  /**
   * ส่ง session ล่าสุดให้ subscriber ของ job นั้น — จะ "ไม่ส่ง" ถ้าเนื้อหาเหมือนเดิม (dedup)
   */
  emit(jobId: string, payload: unknown): void {
    const signature = this.computeSignature(payload);
    if (this.signatures.get(jobId) === signature) {
      return;
    }
    this.signatures.set(jobId, signature);
    this.stream$.next({ jobId, payload });
  }

  /** stream ของ payload เฉพาะ job ที่ระบุ */
  onJob(jobId: string): Observable<unknown> {
    return this.stream$.asObservable().pipe(
      filter((event) => event.jobId === jobId),
      map((event) => event.payload),
    );
  }

  trackSubscriber(jobId: string): void {
    this.subscriberCounts.set(jobId, (this.subscriberCounts.get(jobId) ?? 0) + 1);
  }

  untrackSubscriber(jobId: string): void {
    const next = (this.subscriberCounts.get(jobId) ?? 0) - 1;
    if (next <= 0) {
      this.subscriberCounts.delete(jobId);
      this.signatures.delete(jobId);
    } else {
      this.subscriberCounts.set(jobId, next);
    }
  }

  /** jobId ที่กำลังมีคนเปิดดูอยู่ (มี SSE connection ค้าง) */
  getActiveJobIds(): string[] {
    return [...this.subscriberCounts.keys()];
  }

  private computeSignature(payload: unknown): string {
    try {
      return JSON.stringify(payload);
    } catch {
      return String(Date.now());
    }
  }
}
