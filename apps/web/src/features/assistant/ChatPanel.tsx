import { useEffect, useRef } from 'react';
import type { AssistantState } from './useAssistant';
import { Badge, Button, Textarea, cx } from '../../components/ui/controls';
import { Dropdown } from '../../components/ui/Dropdown';

export function ChatPanel({
  assistant,
  onConfigure,
}: {
  assistant: AssistantState;
  onConfigure: () => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  const { agents, selected, messages, input, setInput, send } = assistant;
  const model = selected.model && selected.model !== '使用預設模型'
    ? selected.model
    : assistant.connection.model;

  useEffect(() => {
    if (messages.length) end.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length, selected.id]);

  return (
    <section className="overflow-visible rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-5 border-b border-line p-5">
        <div className="w-full sm:w-72">
          <Dropdown
            label="對話 Agent"
            value={selected.id}
            options={agents.map(agent => ({ value: agent.id, label: agent.name }))}
            onChange={assistant.choose}
          />
          <p className="mt-2 text-body text-muted">{selected.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{model || '模型未連線'}</Badge>
          <Button variant="ghost" onClick={onConfigure}>連線設定</Button>
          <Button disabled={!messages.length} onClick={assistant.clearChat}>清空對話</Button>
        </div>
      </div>

      <div role="log" aria-label="對話紀錄" aria-live="polite" className="flex flex-col gap-6 p-5 md:p-8">
        {messages.length ? messages.map(message => (
          <article
            key={message.id}
            className={cx(
              'max-w-prose rounded-xl px-5 py-4',
              message.role === 'user' ? 'self-end bg-brand-soft' : 'self-start bg-canvas',
            )}
          >
            <p className="mb-2 text-body font-medium text-muted">
              {message.role === 'user' ? '你' : message.agentName}
            </p>
            <p className="whitespace-pre-wrap break-words text-body leading-8">{message.text}</p>
          </article>
        )) : (
          <div className="py-6 md:py-12">
            <h2 className="text-heading font-bold">想先處理哪個測試？</h2>
            <p className="mt-3 text-muted">描述需求，或從一個問題開始。</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {['規劃登入測試', '分析失敗原因', '整理 API 步驟'].map(text => (
                <Button key={text} disabled={assistant.busy} onClick={() => send(text)}>{text}</Button>
              ))}
            </div>
          </div>
        )}
        <div ref={end} />
      </div>

      <form
        className="border-t border-line p-5"
        onSubmit={event => { event.preventDefault(); send(); }}
      >
        <label htmlFor="chat-input" className="sr-only">訊息</label>
        <Textarea
          id="chat-input"
          rows={3}
          maxLength={8000}
          value={input}
          onChange={event => setInput(event.target.value)}
          placeholder={`傳送訊息給 ${selected.name}`}
          onKeyDown={event => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
              event.preventDefault(); send();
            }
          }}
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <p className="text-body text-muted">{assistant.busy ? '等待模型回覆…' : 'Ctrl + Enter 送出。'}</p>
          <Button variant="primary" type="submit" disabled={!input.trim() || assistant.busy}>送出訊息</Button>
        </div>
      </form>
    </section>
  );
}

