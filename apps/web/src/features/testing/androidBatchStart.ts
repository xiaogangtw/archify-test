type Device = { serial: string; booted: boolean; canControl: boolean; appiumBatch?: string };
type Status = { connected: boolean; appium: { ready: boolean }; devices: Device[] };
type Api = <T>(path: string, init?: RequestInit) => Promise<T>;

export class AndroidRunNotStarted extends Error {}

// Retry reads of the accepted run only. Losing a poll must never resend a
// phone operation or discard the rest of the batch after a transient outage.
export async function waitForBatchCase<T extends { id: string; status: string }>({
  api, run, active, onWaiting, now = Date.now,
  pause = ms => new Promise(resolve => window.setTimeout(resolve, ms)),
}: {
  api: Api; run: T; active: () => boolean; onWaiting: () => void;
  now?: () => number; pause?: (ms: number) => Promise<void>;
}): Promise<T> {
  let deadline: number | undefined;
  while (active() && ['queued', 'running'].includes(run.status)) {
    await pause(1000);
    if (!active()) break;
    try {
      const next = await api<T>(`/android/runs/${run.id}`, { signal: AbortSignal.timeout(4000) });
      if (next.id !== run.id || !['queued', 'running', 'passed', 'failed'].includes(next.status)) {
        throw Object.assign(new Error('執行結果回應格式錯誤。'), { status: 422 });
      }
      run = next;
      deadline = undefined;
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status !== undefined && status < 500 && status !== 408 && status !== 429) throw error;
      deadline ??= now() + 20000;
      if (now() >= deadline) throw error;
      onWaiting();
    }
  }
  return run;
}

const retryableRejection = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const status = (error as Error & {status?: number}).status;
  return status === 503 && error.message === '手機或 Appium 執行器尚未就緒。'
    || status === 409 && error.message === '此手機已有測試執行中。';
};

export async function startBatchCase<T>({ api, body, serials, batchId, waitBefore, active, onWaiting, now = Date.now, pause = ms => new Promise(resolve => window.setTimeout(resolve, ms)) }: {
  api: Api; body: object; serials: string[]; batchId?: string; waitBefore: boolean; active: () => boolean; onWaiting: () => void;
  now?: () => number; pause?: (ms: number) => Promise<void>;
}): Promise<T> {
  const deadline = now() + 20000;
  async function waitForReady() {
    onWaiting();
    while (active() && now() < deadline) {
      try {
        const status = await api<Status>('/android/status', { signal: AbortSignal.timeout(Math.max(1, Math.min(4000, deadline - now()))) });
        if (status.connected && status.appium?.ready && serials.every(serial => status.devices?.some(device => device.serial === serial && device.booted && (device.canControl || !!batchId && device.appiumBatch === batchId)))) return;
      } catch { /* Only read-only status checks are retried. */ }
      if (active() && now() < deadline) await pause(Math.min(1000, deadline - now()));
    }
    throw new AndroidRunNotStarted(active() ? '手機尚未準備完成，請確認連線後再試。' : '已離開測試畫面。');
  }
  if (waitBefore) await waitForReady();
  while (active()) {
    try { return await api<T>('/android/runs', { method: 'POST', body: JSON.stringify(body) }); }
    catch (error) {
      if (retryableRejection(error)) {
        if (now() >= deadline) throw new AndroidRunNotStarted((error as Error).message);
        await pause(Math.min(1000, deadline - now()));
        await waitForReady();
        continue;
      }
      const status = (error as {status?: unknown})?.status;
      if (typeof status === 'number' && [400,401,403,404,409,410,422,429].includes(status)) throw new AndroidRunNotStarted(error instanceof Error ? error.message : '服務拒絕執行要求。');
      // A network error or ambiguous server error may follow acceptance. Never resend it.
      throw error;
    }
  }
  throw new AndroidRunNotStarted('已離開測試畫面。');
}
