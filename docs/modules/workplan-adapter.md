# Workplan Adapter

Adapter pattern สำหรับดึงข้อมูลงานผลิตจากระบบ Workplan

## Interface

```typescript
interface WorkplanProvider {
  getJobsForDate(date: Date): Promise<WorkplanJob[]>;
}
```

## Providers

### MockWorkplanProvider (default)

- Env: `WORKPLAN_PROVIDER=mock`
- Returns hardcoded demo jobs
- Used for development

### HttpWorkplanProvider (future)

- Env: `WORKPLAN_PROVIDER=http`
- Requires: `WORKPLAN_API_URL`
- Not yet implemented

## Jobs Sync

`JobsService.syncJobsForDate()` upserts Workplan jobs into `ProductionJob` table using `workplanRef` as unique key.

## Switching to Real API

1. Implement `HttpWorkplanProvider.getJobsForDate()`
2. Set `WORKPLAN_PROVIDER=http`
3. Set `WORKPLAN_API_URL=https://workplan.example.com/api`
4. No changes needed in formula-weighing or other modules
