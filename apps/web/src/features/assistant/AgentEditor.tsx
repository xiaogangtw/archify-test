import {ToolIcon} from '../../components/ui/ToolIcon';
import {Dropdown} from '../../components/ui/Dropdown';
import {providerNames,useModelConnections} from './modelConnections';
import type { AssistantState } from './useAssistant';
import { Button, Field, Input, Textarea, cx } from '../../components/ui/controls';

interface Props {
  assistant: AssistantState;
  canManage: boolean;
  onConfigure:(provider:string)=>void;
}

export function AgentEditor({ assistant, canManage,onConfigure }: Props) {
  const { agents, selected, draft, setDraft } = assistant;
  const {connections,loaded,error:connectionError}=useModelConnections();
  const provider=draft.modelProvider||connections.find(item=>item.id===draft.modelConnectionId)?.provider||'inherit';
  const matches=connections.filter(item=>item.provider===provider&&item.enabled);
  const missing=provider!=='inherit'&&!matches.length;
  const invalid=provider!=='inherit'&&(!draft.modelConnectionId||!matches.some(item=>item.id===draft.modelConnectionId));
  const globalConnection=connections.find(item=>item.globalDefault&&item.enabled)||(connections.every(item=>item.globalDefault===undefined)&&connections.filter(item=>item.enabled).length===1?connections.find(item=>item.enabled):undefined);
  return (
    <div className="grid min-h-0 flex-1 items-stretch gap-3 lg:grid-cols-3">
      <section className="min-w-0 lg:min-h-0 lg:overflow-y-auto">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-heading font-bold">你的 Agents</h2>
          <Button disabled={!canManage || assistant.busy} onClick={assistant.addAgent}>新增 Agent</Button>
        </div>
        <div className="space-y-3">
          {agents.map(agent => (
            <button
              type="button"
              key={agent.id}
              aria-pressed={selected.id === agent.id}
              onClick={() => assistant.choose(agent.id)}
              className={cx(
                'block min-h-11 w-full rounded-lg border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                selected.id === agent.id
                  ? 'border-brand bg-brand-soft'
                  : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <span className="block break-words font-medium">{agent.name}</span>
              <span className="mt-1 block break-words text-body text-muted">{agent.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Agent 設定" className="flex min-h-0 min-w-0 flex-col rounded-xl border border-line bg-surface p-3 lg:col-span-2">
        <h2 className="mb-3 shrink-0 text-body font-bold">Agent 設定</h2>
          <form onSubmit={event=>{if(invalid){event.preventDefault();return;}void assistant.saveAgent(event);}} className="flex min-h-0 flex-1 flex-col gap-3">
            <fieldset disabled={!canManage} className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="grid shrink-0 gap-3 md:grid-cols-2">
                <Field label="名稱">
                  <Input required maxLength={60} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} />
                </Field>
                <Field label="工作簡介">
                  <Input maxLength={120} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} />
                </Field>
              </div>
              <div className="shrink-0 space-y-2">
                <Dropdown label="使用模型" value={provider} disabled={!loaded||assistant.busy} options={[{value:'inherit',label:'全域預設'},...Object.entries(providerNames).map(([value,label])=>({value,label}))]} onChange={value=>{const choices=connections.filter(item=>item.provider===value&&item.enabled);setDraft({...draft,modelProvider:value==='inherit'?undefined:value as typeof draft.modelProvider,modelConnectionId:value==='inherit'?undefined:choices.length===1?choices[0].id:undefined});}}/>
                {!loaded?<p className="text-menu text-muted">讀取連線…</p>:provider==='inherit'?(globalConnection?<p className="text-menu text-muted">{providerNames[globalConnection.provider]+' · '+(globalConnection.model||'工具預設')}</p>:<div className="flex flex-wrap items-center gap-2"><span className="text-menu text-danger">未設定全域</span><Button onClick={()=>onConfigure(connections.some(item=>item.enabled)?'':'codex')}>{connections.some(item=>item.enabled)?'設定連線':'新增連線'}</Button></div>):missing?<div className="flex flex-wrap items-center gap-2"><span role="status" className="text-menu text-danger">{connections.some(item=>item.provider===provider)?providerNames[provider]+' 已停用':'未設定 '+providerNames[provider]}</span><Button disabled={assistant.busy} onClick={()=>onConfigure(provider)}>新增連線</Button></div>:<Dropdown label="模型連線" value={draft.modelConnectionId||''} options={[{value:'',label:'選擇連線'},...matches.map(item=>({value:item.id,label:item.name+' · '+(item.model||'工具預設')+(item.health.state==='failed'?'（驗證失敗）':item.health.state==='checking'?'（驗證中）':'')}))]} onChange={id=>setDraft({...draft,modelConnectionId:id||undefined})}/>}
                {connectionError&&<p role="status" className="text-menu text-danger">連線讀取失敗</p>}
              </div>
              <Field label="工作指示" fill>
                <Textarea required maxLength={8000} rows={7} resizable={false} className="min-h-64 flex-1" value={draft.instructions} onChange={event => setDraft({ ...draft, instructions: event.target.value })} />
              </Field>
            </fieldset>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Button type="submit" variant="primary" disabled={!canManage || assistant.busy||invalid}>儲存 Agent</Button><Button aria-label="刪除 Agent" variant="danger" disabled={!canManage || assistant.busy || agents.length < 2} onClick={assistant.removeAgent}><ToolIcon name="trash"/></Button>
            </div>
            {!canManage && <p className="text-body text-warning">目前角色僅能檢視。</p>}
          </form>
      </section>
    </div>
  );
}

