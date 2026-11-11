import {Notice} from '../../components/ui/controls';
import {ConnectionLight} from './ConnectionLight';
import {providerNames,useModelConnections} from './modelConnections';
export function ConnectionStatus() {
 const {connections,error,loaded}=useModelConnections();
 return <div className="space-y-4">
  {error && <Notice error>狀態讀取失敗：{error}。下列既有狀態已失效，正在自動重試。</Notice>}
  {!loaded && <p role="status">讀取連線狀態…</p>}
  {loaded && !error && !connections.length && <p className="text-muted">尚未新增模型連線。</p>}
  {connections.map(connection=><section key={connection.id} className="space-y-3 rounded-xl border border-line bg-surface p-5">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="min-w-0 truncate text-section font-bold" title={connection.name}>{connection.name}</h2>{error?<span className="text-danger">無法確認目前狀態</span>:<ConnectionLight connection={connection}/>}</div>
   <p className="break-words text-body">{connection.agentName} · {providerNames[connection.provider]} · {connection.model || '工具預設模型'}</p>
   {connection.health.checkedAt && <p className="text-body text-muted">最後模型驗證：{new Date(connection.health.checkedAt).toLocaleString('zh-TW')}</p>}
  </section>)}
  <p className="text-body text-muted">狀態自動更新。綠燈代表最近一次模型驗證成功；灰色代表尚未驗證或已停用。</p>
 </div>;
}
