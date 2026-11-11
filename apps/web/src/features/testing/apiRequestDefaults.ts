import {sourceVariables} from '../../../../../services/control-api/src/requestSourceVariables.js';
import type {RequestDefinition,EditableRequest} from '../../../../../services/control-api/src/apiContracts.ts';

export const requestMethods=['UNKNOWN','GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'];

export function initialRequest(item:RequestDefinition,environmentId:string):EditableRequest{
 const defaults=item.defaults?structuredClone(item.defaults):undefined;
 if(defaults)return {...defaults,environmentId,authReference:defaults.environmentId===environmentId?defaults.authReference:''};
 const source=item.sourceRequest||item;
 const variables=sourceVariables(item);
 return {environmentId,authReference:'',method:requestMethods.includes(source.method)?source.method:'UNKNOWN',endpoint:source.endpoint,headers:item.kind==='graphql'?{'Content-Type':'application/json',...('headers' in source?source.headers||{}:{})}:('headers' in source?source.headers||{}:{}),queryParams:'queryParams' in source?source.queryParams||{}:{},body:source.body,variables,operationName:source.operationName,expectedStatus:200,assertions:[],responseVariables:item.responseVariables||[]};
}
