export type FlowMessage = { role: 'user' | 'assistant'; text: string };
export type FlowCase = { id: string; name: string; source: string; version: number; messages: FlowMessage[] };
export const flowKey = (projectId: string) => `archify.android-flow-cases.v1.${projectId}`;
export function readFlowCases(storage: Pick<Storage, 'getItem'>, projectId: string): FlowCase[] {
  const raw = storage.getItem(flowKey(projectId));
  if (raw) {
    const rows: unknown = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.source !== 'string' || !Number.isInteger(row.version) || row.version < 0 || !Array.isArray(row.messages) || row.messages.some((message: FlowMessage) => !message || !['user','assistant'].includes(message.role) || typeof message.text !== 'string'))) throw new Error('Flow Case 紀錄無法讀取，原始資料未被覆蓋。');
    return rows;
  }
  const legacy = storage.getItem(`archify.e2e-plans.v1.${projectId}`);
  if (!legacy) return [];
  const rows: unknown = JSON.parse(legacy);
  if (!Array.isArray(rows)) throw new Error('舊流程草稿無法讀取，原始資料未被覆蓋。');
  return rows.filter(row => row?.platform === 'android').map(row => {
    if (typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.target !== 'string' || !Array.isArray(row.actors) || !Array.isArray(row.steps)) throw new Error('舊流程草稿格式錯誤，原始資料未被覆蓋。');
    return { id: row.id, name: row.name, source: definitionSource(row), version: 0, messages: [] };
  });
}
export function definitionSource(plan: unknown) {
  return '// 流程定義草稿，尚未轉為可執行的 Appium 腳本。\nexport const flow = ' + JSON.stringify(plan, null, 2) + ' as const;\n';
}
export function flowPreview(source: string): { label: string; expected?: string; actor?: string }[] {
  const definition = /export const flow = ([\s\S]+) as const;/.exec(source);
  if (definition) {
    try {
      const plan = JSON.parse(definition[1]);
      if (Array.isArray(plan.steps)) return plan.steps.filter((step: any) => typeof step?.action === 'string').map((step: any) => ({ label: step.action, expected: typeof step.expected === 'string' ? step.expected : '', actor: plan.actors?.find((actor: any) => actor.id === step.actorId)?.name || '' }));
    } catch { /* Invalid or free-form TypeScript remains editable, never evaluated. */ }
  }
  return [...source.matchAll(/await\s+(?:test\.)?step\(\s*(['"])([^'"\n]+)\1\s*,/g)].map(match => ({ label: match[2] }));
}
export function newFlowCase(template = false): FlowCase {
  return { id: crypto.randomUUID(), name: template ? '雙帳號名片交換' : '', version: 0, messages: [], source: template ? definitionSource({ platform: 'android', target: '', actors: [{ id: 'a', name: '使用者 A' }, { id: 'b', name: '使用者 B' }], steps: [
    { actorId: 'a', action: '從已登入的手機 A 開啟自己的名片', expected: '顯示 A 的名片畫面' },
    { actorId: 'a', action: '向 B 發送交換邀請', expected: '顯示邀請已送出' },
    { actorId: 'b', action: '在手機 B 等待邀請出現並接受', expected: '顯示交換完成' },
    { actorId: 'a', action: '返回名片收藏', expected: '顯示 B 的名片' },
  ] }) : '' };
}
