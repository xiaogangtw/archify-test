import {useState} from 'react';
import type { PageId } from '../../types';
import { Notice } from '../../components/ui/controls';
import { useAssistant } from './useAssistant';
import { ChatPanel } from './ChatPanel';
import { AgentEditor } from './AgentEditor';
import { ConnectionSettings } from './ConnectionSettings';

interface Props {
  page: PageId;
  canManage: boolean;
  canConfigure: boolean;
  onNavigate: (page: PageId) => void;
}

export function AssistantWorkspace({
  page,
  canManage,
  canConfigure,
  onNavigate,
}: Props) {
  const [pendingConnection,setPendingConnection]=useState<{provider:string;agentId:string;inherit:boolean}|null>(null);
  const assistant = useAssistant(page, canManage, canConfigure);

  return (
    <>
      {assistant.notice && <Notice>{assistant.notice}</Notice>}
      {assistant.error && <Notice error>{assistant.error}</Notice>}

      {page === 'chat' && (
        <ChatPanel assistant={assistant} onConfigure={() => onNavigate('llm')} />
      )}

      {page === 'agents' && (
        <AgentEditor
          assistant={assistant}
          canManage={canManage}
          onConfigure={provider=>{setPendingConnection({provider,agentId:assistant.draft.id,inherit:!assistant.draft.modelConnectionId&&!assistant.draft.modelProvider});onNavigate('llm');}}
        />
      )}

      {(page === 'llm' || page === 'llm-status') && (
        <ConnectionSettings assistant={assistant} canConfigure={canConfigure} initialProvider={pendingConnection?.provider} onCreated={pendingConnection?connection=>{if(!pendingConnection.inherit&&assistant.draft.id===pendingConnection.agentId)assistant.setDraft({...assistant.draft,modelProvider:connection.provider as typeof assistant.draft.modelProvider,modelConnectionId:connection.id});setPendingConnection(null);onNavigate('agents');}:undefined} onCancel={pendingConnection?()=>{setPendingConnection(null);onNavigate('agents');}:undefined}/>
      )}
    </>
  );
}

