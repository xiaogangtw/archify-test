export interface RequestDefinition {
 id:string;name:string;kind:'http'|'graphql';method:string;endpoint:string;
 headers:Record<string,string>;queryParams:Record<string,unknown>;body:string;variables:string;operationName:string;
 parameterTypes:string;evidence:{path:string;line:number}[];dependencies:Record<string,string>;
 issues:string[];definitionHash:string;implementationHash:string;category?:string;description?:string;origin?:'source'|'manual';responseVariables?:{name:string;path:string}[];defaults?:EditableRequest;
 family?:string;usages?:RequestUsage[];
 sourceRequest?:{headers?:Record<string,string>;queryParams?:Record<string,unknown>;body:string;variables:string;operationName:string;method:string;endpoint:string};
}
export interface RequestUsage {path:string;line:number;column?:number;caller:string;scope:'transport'|'caller';parameters:Record<string,string>;variables?:Record<string,unknown>;notes:string[]}
export interface RequestChange {requestId:string;name:string;kind:'added'|'removed'|'changed';details:string[];fields?:{label:string;before:string;after:string}[]}
export interface RequestCatalog {
 id:string;projectId:string;snapshotId:string;version:number;createdAt:string;sourceHash:string;
 requests:RequestDefinition[];changes:RequestChange[];issues:string[];revision?:number;name?:string;scanHash?:string;deletedAt?:string;folders?:string[];
}
export interface ApiScanPreview {id:string;baselineId:string|null;baselineName:string;requestCount:number;changes:RequestChange[];issues:string[];expiresAt:string}
export interface RequestEnvironment {id:string;name:string;baseUrl:string;projectIds:string[];authReferences:{id:string;name:string}[];baseEnvironmentId?:string;headerVariables?:string[];variables?:Record<string,string>;tokenVariable?:string;tokenHeader?:string;tokenPrefix?:string;secretVariables?:string[]}
export interface SavedApiCase {
 scenario?:'positive'|'negative';definitionHash?:string;pendingChecks?:string[];deletedAt?:string;
 id:string;projectId:string;requestId:string;name:string;version:number;catalogVersion:number;
 request:EditableRequest;scriptLinks:{scriptId:string;step:string}[];updatedAt:string;
}
export interface EditableRequest {
 expectedGraphqlErrors?:boolean;
 environmentId:string;authReference:string;method:string;endpoint:string;headers:Record<string,string>;
 queryParams:Record<string,unknown>;body:string;variables:Record<string,unknown>;operationName:string;expectedStatus:number;
 assertions:{path:string;operator:'exists'|'equals'|'contains';value?:unknown}[];
 responseVariables?:{name:string;path:string}[];
}
export interface ApiResponse {
 id:string;status:number;durationMs:number;body:string;contentType:string;
 outcome:'passed'|'failed';checks:{name:string;passed:boolean}[];schemaHash?:string;message:string;
 request?:{method:string;url:string;bodyHash:string;authReference:string};
}
export interface ApiImpact {caseId:string;caseName:string;reason:string[];inferred?:boolean;scripts:{id:string;name:string;step:string;version?:number;inferred?:boolean}[];flows:{id:string;name:string;steps:string[]}[]}
