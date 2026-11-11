import {ToolIcon} from '../../components/ui/ToolIcon';
import {useState} from 'react';
import {Button,Input} from '../../components/ui/controls';
import type {RequestDefinition,RequestUsage} from '../../../../../services/control-api/src/apiContracts';
function parameterRows(parameters:Record<string,string>){const rows:[string,string][]=[];function walk(path:string,value:unknown,depth:number){if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length&&depth<4){for(const [key,item] of Object.entries(value))walk(path+'.'+key,item,depth+1);}else rows.push([path,typeof value==='string'?value:JSON.stringify(value)]);}for(const [name,text] of Object.entries(parameters)){let value:unknown=text;try{value=JSON.parse(text);}catch{}walk(name,value,0);}return rows;}


function sourceBody(item:RequestDefinition){const body=item.sourceRequest?.body||item.body;try{return JSON.parse(body).query||body;}catch{return body;}}
function fileName(path:string){return path.split(/[/\\]/).pop()||path;}

export function ApiUsagePanel({definitions,onUse}:{definitions:RequestDefinition[];onUse:(definition:RequestDefinition,usage?:RequestUsage)=>void}){
 const [search,setSearch]=useState('');
 const term=search.trim().toLocaleLowerCase();
 const count=definitions.reduce((sum,item)=>sum+(item.usages?.length||0),0);
 const matches=definitions.map(item=>({item,usages:(item.usages||[]).filter(usage=>[item.name,item.operationName,usage.path,usage.caller].join(' ').toLocaleLowerCase().includes(term))}));
 return <div className="min-w-0 space-y-6">
  <section aria-label="用途摘要" className="space-y-2">
   <h3 className="text-body font-medium">用途與呼叫位置</h3>
   <p className="text-menu text-muted">已靜態辨識 {count} 個呼叫位置。展開位置可查看傳入欄位與來源，再帶入請求編輯器。</p>
   {definitions[0]?.description?<p className="whitespace-pre-wrap break-words text-menu">{definitions[0].description}</p>:<p className="text-menu text-muted">尚未填寫用途說明，以下保留來源中的函式與檔名。</p>}
  </section>
  <Input type="search" aria-label="搜尋呼叫位置" placeholder="搜尋函式、檔名或路徑" value={search} onChange={event=>setSearch(event.target.value)}/>
  {term&&!matches.some(group=>group.usages.length)&&<p role="status" className="text-menu text-muted">沒有符合的呼叫位置。</p>}
  {matches.filter(({item,usages})=>!term||usages.length||[item.name,item.operationName].join(' ').toLocaleLowerCase().includes(term)).map(({item,usages})=><section key={item.id} className="min-w-0 space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="min-w-0 break-words text-body font-medium">{item.operationName||item.name}</h3><Button aria-label="帶入前端請求" title="帶入前端請求" onClick={()=>onUse(item)}><ToolIcon name="pull"/></Button></div>
   {!item.usages?.length&&<p className="text-menu text-muted">尚未辨識到呼叫位置。{item.origin==='manual'?'這是手動建立的接口。':'可展開技術細節核對來源。'}</p>}
   <div className="space-y-2">{usages.map((usage,index)=>{
    const rows=parameterRows(usage.parameters);
    return <details key={usage.path+usage.line+index} className="min-w-0 rounded-lg border border-line p-3">
     <summary className="min-h-11 cursor-pointer rounded-lg py-2 text-menu hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:bg-sidebar"><span className="break-words font-medium">{usage.caller||fileName(usage.path)}</span><span className="block break-words text-muted">{fileName(usage.path)}:{usage.line} · {usage.scope==='caller'?'前端呼叫':'請求包裝層'} · {rows.length} 個可辨識欄位</span></summary>
     <div className="min-w-0 space-y-3 pt-3">
      <p className="break-all text-menu text-muted">來源位置：{usage.path}:{usage.line}</p>
      {rows.length?<div className="overflow-x-auto"><table className="w-full table-fixed text-left text-menu"><caption className="pb-2 text-left text-muted">前端顯式傳入的欄位，非完整 Schema 必填清單。</caption><thead><tr><th scope="col" className="w-1/3 border-b border-line py-2 pr-4 font-medium">傳入欄位</th><th scope="col" className="border-b border-line py-2 font-medium">前端提供的值／來源</th></tr></thead><tbody>{rows.map(([name,value])=><tr key={name}><td className="break-all border-b border-line py-2 pr-4 align-top">{name}</td><td className="whitespace-pre-wrap break-all border-b border-line py-2 font-mono">{value}</td></tr>)}</tbody></table></div>:<p className="text-menu text-muted">{usage.notes.length?'參數未完整解析，請核對來源。':'此呼叫未顯式傳入參數。'}</p>}
      {usage.notes.length>0&&<div className="space-y-2 rounded-lg border border-line bg-canvas p-3"><p className="text-menu font-medium">解析限制</p>{usage.notes.map((note,i)=><p key={i} className="break-words text-menu text-muted">{note}</p>)}</div>}
      <Button aria-label="帶入請求編輯器" title="帶入請求編輯器" onClick={()=>onUse(item,usage)}><ToolIcon name="pull"/></Button>
     </div>
    </details>;
   })}</div>
   <details className="min-w-0 rounded-lg border border-line p-3"><summary className="min-h-11 cursor-pointer rounded-lg py-2 text-menu font-medium hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:bg-sidebar">技術細節：型別、原始請求與來源依據</summary><div className="space-y-4 pt-3">
    {item.parameterTypes&&<section className="space-y-2"><h4 className="text-menu font-medium">參數型別</h4><pre className="whitespace-pre-wrap break-words font-mono text-menu text-muted">{item.parameterTypes}</pre></section>}
    <section className="space-y-2"><h4 className="text-menu font-medium">原始 Query／請求內容</h4><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-canvas p-3 font-mono text-menu">{sourceBody(item)||'此請求沒有內容。'}</pre></section>
    <section className="space-y-2"><h4 className="text-menu font-medium">來源依據</h4>{item.evidence.length?item.evidence.map(source=><p key={source.path+source.line} className="break-all text-menu text-muted">{source.path}:{source.line}</p>):<p className="text-menu text-muted">沒有來源位置資料。</p>}{item.issues.map((issue,index)=><p key={index} className="break-words text-menu text-muted">{issue}</p>)}</section>
   </div></details>
  </section>)}
  <p className="text-menu text-muted">資料來自靜態解析，動態參數與間接引用可能不完整。</p>
 </div>;
}
