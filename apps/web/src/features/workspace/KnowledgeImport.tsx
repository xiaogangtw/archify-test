import { useEffect, useId, useRef, useState } from 'react';
import type { LocalConfig } from './client';
import { useAiJob } from './useAiJob';
import { AiJobStatus } from './AiJobStatus';
import { ActionButton, Banner, WorkspaceIcon } from '../../components/ui/ds';

export function KnowledgeImport({
  config,
  onImported,
  onBusy,
  compact = false,
}: {
  config: LocalConfig;
  onImported: () => void;
  onBusy?: (busy: boolean) => void;
  compact?: boolean;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const ai = useAiJob(config);

  useEffect(() => {
    if (ai.job?.kind === 'knowledge' && ai.job.status === 'completed') {
      setDocuments([]);
      onImported();
    }
  }, [ai.job?.id, ai.job?.status]);

  const [documents, setDocuments] = useState<{ name: string; base64: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    onBusy?.(busy || ai.running);
  }, [busy, ai.running]);

  async function files(input: HTMLInputElement) {
    setError('');
    setNotice('');
    setBusy(true);
    let prepared = false;
    try {
      const selected = Array.from(input.files || []);
      if (!selected.length) return;
      if (selected.length > 20) throw new Error('每次最多匯入 20 份文件。');
      if (
        selected.some(
          file =>
            !file.size ||
            !/\.(md|txt|html?|png|jpe?g|webp)$/i.test(file.name) ||
            file.size > 10 * 1024 * 1024,
        ) ||
        selected.reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024
      ) {
        throw new Error('支援 MD、HTML、TXT、PNG、JPEG、WebP，每份最多 10 MB，每批合計最多 20 MB。');
      }
      const docs = await Promise.all(
        selected.map(
          file =>
            new Promise<{ name: string; base64: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onerror = () => reject(new Error('無法讀取檔案，請重試。'));
              reader.onload = () => {
                const value = reader.result;
                if (typeof value !== 'string') return reject(new Error('檔案格式無法讀取。'));
                resolve({ name: file.name, base64: value.slice(value.indexOf(',') + 1) });
              };
              reader.readAsDataURL(file);
            }),
        ),
      );
      prepared = true;
      setDocuments(docs);
      await ai.start('ai-knowledge-start', { documents: docs });
    } catch (reason) {
      if (!prepared) setDocuments([]);
      setError(reason instanceof Error ? reason.message : '無法讀取文件，請使用 UTF-8 文字。');
    } finally {
      input.value = '';
      setBusy(false);
    }
  }

  async function submit() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await ai.start('ai-knowledge-start', { documents });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '匯入失敗，請重試。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${id}-files`} className={compact ? 'sr-only' : 'mb-2 block font-medium text-ink'}>
          匯入知識文件
        </label>
        <input
          ref={fileInput}
          id={`${id}-files`}
          type="file"
          multiple
          accept=".md,.txt,.html,.htm,.png,.jpg,.jpeg,.webp,text/plain,text/markdown,text/html,image/png,image/jpeg,image/webp"
          disabled={busy || ai.running}
          onChange={event => void files(event.currentTarget)}
          className={`${compact ? 'hidden' : 'block'} min-h-8 w-full min-w-0 rounded-lg border border-line bg-canvas p-1.5 text-body text-ink file:mr-3 file:min-h-8 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:py-1 file:text-body file:font-medium file:text-ink hover:file:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50`}
        />
        {compact && (
          <button
            type="button"
            disabled={busy || ai.running}
            onClick={() => fileInput.current?.click()}
            className="mx-auto flex aspect-square w-full max-w-xs flex-col items-center justify-center gap-4 rounded-xl border border-line-strong bg-surface p-6 hover:bg-brand-soft active:bg-surface-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-canvas text-muted">
              <WorkspaceIcon name="upload" className="h-6 w-6" />
            </span>
            <span className="font-medium text-ink">上傳文件</span>
          </button>
        )}
        <p className={compact ? 'mt-3 text-center text-muted' : 'mt-2 text-muted'}>
          {compact
            ? 'MD、HTML、TXT、圖片 · 單檔上限 10 MB'
            : '支援 MD、HTML、TXT、PNG、JPEG、WebP（單檔 10 MB、每批 20 份／20 MB，上傳後自動分類整理）'}
        </p>
      </div>

      {!!documents.length && (
        <ul
          className="space-y-1 rounded-lg border border-line bg-canvas p-3 font-mono text-muted"
          aria-label="本次上傳"
        >
          {documents.map((doc, index) => (
            <li key={index} className="break-all">
              {doc.name}
            </li>
          ))}
        </ul>
      )}

      <AiJobStatus
        variant={compact ? 'toast' : 'inline'}
        pendingStage={compact && busy && !ai.running ? '正在讀取並送出知識…' : undefined}
        job={ai.job}
        error={error ? undefined : ai.error}
        onCancel={() => void ai.cancel()}
      />

      {error && <Banner tone="danger">{error}</Banner>}
      {notice && <Banner tone="neutral">{notice}</Banner>}

      {!busy &&
        !ai.running &&
        !!documents.length &&
        (error || ai.job?.status === 'failed' || ai.job?.status === 'cancelled') && (
          <ActionButton icon="refresh" onClick={() => void submit()}>
            重新整理
          </ActionButton>
        )}
    </div>
  );
}
