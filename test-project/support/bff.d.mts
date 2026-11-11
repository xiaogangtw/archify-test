/** 解析占位值並保留呼叫端的資料結構；實際資料仍須由案例驗證。 */
export function resolveData<T>(value: T, variables?: Record<string, unknown>): T;
export function bffUrl(endpoint: string, variables?: Record<string, unknown>): string;
export function bffHeaders(
  requestHeaders?: Record<string, string | null>,
  caseHeaders?: Record<string, string | null>,
  variables?: Record<string, unknown>
): Record<string, string>;
export function readPath(value: unknown, path?: string): unknown;
