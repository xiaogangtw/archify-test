import {useEffect,useState} from 'react';
import {Dropdown} from '../../components/ui/Dropdown';
import {api} from './controlApi';
import {ApiChat} from './ApiChat';
import {useTesting} from './TestingProvider';
import type {RequestCatalog,RequestEnvironment} from '../../../../../services/control-api/src/apiContracts';
type Library={catalog:RequestCatalog|null;environments:RequestEnvironment[]};
export function ApiAssistantLauncher({onOpenScript}:{onOpenScript?:(id:string)=>void}){
 const {data,refreshData}=useTesting();
 const projectId=data.project.id||'original';
 return <LibraryChat key={projectId} projectId={projectId} projectName={data.project.name} refreshData={refreshData} onOpenScript={onOpenScript}/>;
}
function LibraryChat({projectId,projectName,refreshData,onOpenScript}:{projectId:string;projectName:string;refreshData:()=>Promise<void>;onOpenScript?:(id:string)=>void}){
 const [library,setLibrary]=useState<Library|null>(null);
 const [environmentId,setEnvironmentId]=useState('');
 const [error,setError]=useState('');
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  let active=true;setError('');
  void api<Library>('/api-library/'+encodeURIComponent(projectId)).then(value=>{
   if(!active)return;setLibrary(value);
   let remembered='';try{remembered=localStorage.getItem('archify.api-environment.'+projectId)||'';}catch{}
   setEnvironmentId(value.environments.some(item=>item.id===remembered)?remembered:value.environments[0]?.id||'');
  }).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'讀取失敗');});
  return()=>{active=false;};
 },[projectId,reload]);
 const catalog=library?.catalog;
 const disabledReason=error||(!library?'讀取中…':!catalog?'請先在單點 API 測試掃描前端或建立接口版本。':!catalog.requests.length?'目前版本沒有接口。':!environmentId?'請先選擇測試環境。':'');
 return <ApiChat onOpen={()=>setReload(value=>value+1)} workflowOnly disabledReason={disabledReason} settings={library&&<Dropdown label="AI 測試環境" value={environmentId} options={library.environments.map(item=>({value:item.id,label:item.name}))} onChange={setEnvironmentId}/>} projectId={projectId} projectName={projectName} currentName="目前版本所有接口" catalogId={catalog?.id||''} version={catalog?.name||(catalog?'版本 '+catalog.version:'尚無版本')} environmentId={environmentId} environmentName={library?.environments.find(item=>item.id===environmentId)?.name||''} requestIds={catalog?.requests.map(item=>item.id)||[]} pageName="腳本案例與流程" uiToken={[catalog?.id,environmentId].join(':')} page="requests" tab="body" editor={{method:'',endpoint:'',query:'',variables:'',params:'',body:'',assertions:''}} onOperate={async()=>{throw new Error('請到單點 API 測試操作接口畫面。');}} onChanged={()=>void refreshData()} onOpenScript={onOpenScript?id=>{void refreshData().then(()=>onOpenScript(id));}:undefined}/>;
}
