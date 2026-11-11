import { api, serverStorage } from '../testing/controlApi';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { PageId } from '../../types';
import { defaultAgents, defaultConnection } from './types';
import type { Agent, Connection, Message } from './types';

const storageKey = 'archify.agents.v1';

function loadAgents(): Agent[] {
  try {
    const value: unknown = JSON.parse(serverStorage.getItem(storageKey) || 'null');
    const valid = Array.isArray(value) && value.length > 0 && value.length <= 50
      && value.every(agent => agent && ['id', 'name', 'description', 'instructions', 'model']
        .every(key => typeof agent[key] === 'string'))
      && new Set(value.map(agent => agent.id)).size === value.length;
    if (valid) return value as Agent[];
  } catch {
    // A blocked or malformed browser store does not prevent opening the app.
  }
  return defaultAgents.map(agent => ({ ...agent }));
}

export function useAssistant(page: PageId, canManage: boolean, canConfigure: boolean) {
  const [agents, setAgents] = useState(loadAgents);
  const [selectedId, setSelectedId] = useState(agents[0].id);
  const selected = agents.find(agent => agent.id === selectedId) || agents[0];
  const [draft, setDraft] = useState<Agent>({ ...selected });
  const [histories, setHistories] = useState<Record<string, Message[]>>({});
  const [input, setInput] = useState('');
  const [connection, setConnection] = useState<Connection>(defaultConnection);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const messages = histories[selected.id] || [];

  useEffect(() => {
    setApiKey('');
    setShowKey(false);
    setNotice('');
    setError('');
  }, [page, canConfigure]);

  function choose(id: string) {
    const agent = agents.find(item => item.id === id);
    if (!agent) return;
    setSelectedId(id);
    setDraft({ ...agent });
    setInput('');
    setNotice('');
    setError('');
  }

  async function saveAgent(event: FormEvent) {
    event.preventDefault();
    if (!canManage || busy) return;
    if (!draft.name.trim() || !draft.instructions.trim()) {
      setError('請填寫 Agent 名稱與工作指示。');
      return;
    }
    const next = agents.map(agent => agent.id === draft.id
      ? { ...draft, name: draft.name.trim() }
      : agent);
    setError('');
    setBusy(true);
    try {
      await serverStorage.setItem(storageKey, JSON.stringify(next));
      setAgents(next); setNotice('Agent 已儲存。');
    } catch {
      setError('Agent 儲存失敗，請重試。');
    } finally { setBusy(false); }
  }

  function addAgent() {
    if (!canManage || busy) return;
    if (agents.length >= 50) { setError('最多可建立 50 個 Agent。'); return; }
    const agent: Agent = {
      id: crypto.randomUUID(),
      name: '新 Agent',
      description: '自訂工作角色',
      instructions: '請使用繁體中文，協助我處理測試工作。',
      model: '使用預設模型',
    };
    setAgents([...agents, agent]);
    setSelectedId(agent.id);
    setDraft(agent);
    setError('');
    setNotice('已新增草稿，編輯完成後請儲存。');
  }

  async function removeAgent() {
    if (!canManage || busy) return;
    if (agents.length === 1) { setError('請至少保留一個 Agent。'); return; }
    setBusy(true); setError('');
    try {
      const next = agents.filter(agent => agent.id !== selected.id);
      await serverStorage.setItem(storageKey, JSON.stringify(next));
      setAgents(next); setSelectedId(next[0].id); setDraft({ ...next[0] });
      setNotice('Agent 已刪除。');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '刪除失敗'); }
    finally { setBusy(false); }
  }

  async function send(text = input) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const user: Message = { id: crypto.randomUUID(), role: 'user', text: trimmed, agentName: selected.name };
    const id = selected.id;
    const conversation = [...(histories[id] || []), user];
    setBusy(true); setError('');
    setHistories(items => ({
      ...items, [id]: conversation,
    }));
    setInput('');
    try {
      const result = await api<{reply:string}>('/llm', {method:'POST', body:JSON.stringify({agentId:id,
        messages:conversation.slice(-30).map(message => ({role:message.role, content:message.text}))})});
      setHistories(items => ({...items,[id]:[...(items[id] || []), {id:crypto.randomUUID(),role:'assistant',text:result.reply,agentName:selected.name}]}));
    } catch(reason) { setError(reason instanceof Error ? reason.message : '模型連線失敗'); setInput(trimmed); }
    finally { setBusy(false); }
  }

  function updateConnection(next: Connection) {
    if (next.provider !== connection.provider || next.method !== connection.method) {
      setApiKey('');
      setShowKey(false);
    }
    setConnection(next);
    setNotice('');
    setError('');
  }

  function saveConnection(event: FormEvent) {
    event.preventDefault();
    if (!canConfigure) return;
    if (!connection.model.trim()) { setError('請填寫模型名稱。'); return; }
    if (!apiKey.trim()) { setError('請填寫 API Key。'); return; }
    if (connection.endpoint.trim()) {
      try {
        if (new URL(connection.endpoint).protocol !== 'https:') throw new Error();
      } catch {
        setError('API 位址請使用完整的 HTTPS 網址。');
        return;
      }
    }
    setApiKey('');
    setShowKey(false);
    setError('');
    setNotice('已套用本次預覽設定。API Key 已清除，尚未連線模型。');
  }

  return {
    agents, selected, draft, setDraft, choose, addAgent, saveAgent, removeAgent, busy,
    messages, input, setInput, send,
    clearChat: () => setHistories(items => ({ ...items, [selected.id]: [] })),
    connection, updateConnection, saveConnection, apiKey, setApiKey,
    showKey, setShowKey, notice, setNotice, error,
  };
}

export type AssistantState = ReturnType<typeof useAssistant>;

