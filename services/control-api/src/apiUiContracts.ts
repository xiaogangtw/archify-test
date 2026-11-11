import type {EditableRequest} from './apiContracts.ts';

export type ApiRequestTab='body'|'params'|'headers'|'auth'|'checks'|'usage';
export type ApiPageTab='requests'|'diff'|'history';
export type ApiRequestPatch=Partial<Pick<EditableRequest,'method'|'endpoint'|'headers'|'queryParams'|'body'|'variables'|'operationName'|'expectedStatus'|'expectedGraphqlErrors'|'assertions'|'responseVariables'>>;
export type ApiUiAction=
 | {tool:'select_request';requestId:string}
 | {tool:'set_tab';page:ApiPageTab;tab?:ApiRequestTab}
 | {tool:'fill_request';requestId:string;patch:ApiRequestPatch}
 | {tool:'load_usage';requestId:string;index?:number}
 | {tool:'start_workflow';requestIds:string[];execute:boolean};
export interface ApiUiReply {reply:string;actions:ApiUiAction[]}
export interface ApiEditorContext {method:string;endpoint:string;query:string;variables:string;params:string;body:string;assertions:string;expectedStatus?:string;expectedGraphqlErrors?:string}
export interface ApiUiOutcome {results:string[];editor?:{requestId:string;values:ApiEditorContext}}
