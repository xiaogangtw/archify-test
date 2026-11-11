import {useState} from 'react';
import {ScriptLibrary} from './ScriptLibrary';
import {ScriptWorkspace} from './ScriptWorkspace';
import {Button} from '../../components/ui/controls';
import {Modal} from '../../components/ui/Modal';
export function AutomationLibrary(){
 const [editing,setEditing]=useState<string|null>(null),[dirty,setDirty]=useState(false),[confirm,setConfirm]=useState(false),[revision,setRevision]=useState(0);
 return <div className="min-w-0 space-y-3">{editing?<><div className="flex justify-end"><Button onClick={()=>dirty?setConfirm(true):setEditing(null)}>返回案例庫</Button></div><ScriptWorkspace key={editing} scriptId={editing} flowOnly onDirtyChange={setDirty} onSaved={()=>{setDirty(false);setEditing(null);setRevision(value=>value+1);}}/></>:<ScriptLibrary key={revision} scope="flow" onEdit={id=>{setDirty(false);setEditing(id);}}/>}<Modal compact open={confirm} title="尚有未儲存修改" onClose={()=>setConfirm(false)}><p>返回案例庫會放棄目前修改。</p><div className="mt-3 flex flex-wrap gap-2"><Button onClick={()=>setConfirm(false)}>繼續編輯</Button><Button variant="danger" onClick={()=>{setConfirm(false);setDirty(false);setEditing(null);}}>放棄修改並返回</Button></div></Modal></div>;
}
