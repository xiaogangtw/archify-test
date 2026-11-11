import type { APIRequestContext, APIResponse } from '@playwright/test';
import { bffUrl, bffHeaders, resolveData } from './bff.mjs';

export interface ApiOperation {
  kind: string;
  method: string;
  endpoint: string;
  operationType?: string;
  headers: Record<string, string | null>;
  queryParams: Record<string, unknown>;
  body: unknown;
}
export interface ApiCallOptions {
  /** GraphQL variables；同名頂層欄位覆寫，巢狀物件需完整傳入。 */
  variables?: Record<string, unknown>;
  /** REST body 或完整 GraphQL body，取代預設 body。 */
  body?: unknown;
  headers?: Record<string, string | null>;
  queryParams?: Record<string, string | number | boolean>;
  /** {{名稱}} 占位值，不同於 GraphQL variables。 */
  values?: Record<string, unknown>;
}

/** 僅在呼叫時發送一次請求；沒有斷言、登入狀態或自動重試。 */
export async function sendApi(request: APIRequestContext, operation: ApiOperation, options: ApiCallOptions = {}): Promise<APIResponse> {
  const method = operation.method.toUpperCase();
  if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(method)) throw new Error('API_METHOD_UNSUPPORTED');
  if (operation.operationType === 'subscription') throw new Error('API_SUBSCRIPTION_UNSUPPORTED');
  let body = options.body !== undefined ? options.body : operation.body;
  if (options.variables !== undefined) {
    if (operation.kind !== 'graphql' || !body || typeof body !== 'object' || Array.isArray(body)) throw new Error('API_VARIABLES_REQUIRE_GRAPHQL_BODY');
    const graph = body as Record<string, unknown>;
    body = { ...graph, variables: { ...(graph.variables && typeof graph.variables === 'object' ? graph.variables : {}), ...options.variables } };
  }
  if (operation.kind === 'graphql' && body && typeof body === 'object' && 'query' in body && typeof body.query === 'string' && body.query.includes('{{')) throw new Error('API_USE_GRAPHQL_VARIABLES');
  body = resolveData(body, options.values);
  const params = resolveData({ ...operation.queryParams, ...options.queryParams }, options.values);
  if (Object.values(params).some(value => !['string', 'number', 'boolean'].includes(typeof value))) throw new Error('API_QUERY_PARAMS_INVALID');
  return request.fetch(bffUrl(operation.endpoint, options.values), {
    method, headers: bffHeaders(operation.headers, options.headers, options.values),
    params: params as Record<string, string | number | boolean>,
    ...(!['GET', 'HEAD'].includes(method) && body !== null && body !== undefined ? { data: body } : {}),
    timeout: 30000, maxRedirects: 0, maxRetries: 0, failOnStatusCode: false
  }).catch(() => { throw new Error('API_CONNECTION_FAILED'); });
}
