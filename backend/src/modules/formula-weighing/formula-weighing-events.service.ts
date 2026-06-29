import { Injectable } from "@nestjs/common";
import { Observable, Subject } from "rxjs";
import { filter, map } from "rxjs/operators";

type FormulaWeighingEvent = {
  jobId: string;
  payload: unknown;
};

@Injectable()
export class FormulaWeighingEventsService {
  private readonly stream$ = new Subject<FormulaWeighingEvent>();
  private readonly signatures = new Map<string, string>();
  private readonly subscriberCounts = new Map<string, number>();

  emit(jobId: string, payload: unknown): void {
    const signature = this.computeSignature(payload);
    if (this.signatures.get(jobId) === signature) {
      return;
    }
    this.signatures.set(jobId, signature);
    this.stream$.next({ jobId, payload });
  }

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
