import { frontendSnapshot } from '../../test-project/support/frontend-snapshot.mjs';
import { readdir, lstat, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { parse } from 'graphql';
import { graphqlPayload } from './graphql-payload.mjs';
import { extractRequests } from '../control-api/src/requestCatalog.ts';
import { child, noLinks } from './paths.mjs';

const secret = /password|passwd|secret|token|authorization|cookie|api[-_]?key|credential/i;
export const hash = value => createHash('sha256').update(value).digest('hex');
export function publicValue(value, key = '') {
  if (secret.test(key)) return `{{${key.replace(/[^a-z0-9_]/gi, '_').toUpperCase()}}}`;
  if (Array.isArray(value)) return value.map(item => publicValue(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, publicValue(item, name)]));
  return value;
}
function cleanBody(body, usages = []) {
  try {
    const value = publicValue(JSON.parse(body));
    return graphqlPayload(value, usages);
  } catch { return body ? '{{REQUEST_BODY}}' : null; }
}
function cleanEndpoint(endpoint) {
  if (/^https?:\/\//i.test(endpoint) && !endpoint.includes('{{')) {
    try { const url = new URL(endpoint); url.username = ''; url.password = ''; url.hash = ''; for (const key of [...url.searchParams.keys()]) if (secret.test(key)) url.searchParams.set(key, `{{${key.toUpperCase()}}}`); return url.toString().replaceAll('%7B', '{').replaceAll('%7D', '}'); } catch { return ''; }
  }
  // Query values can contain credentials even in relative URLs.
  return endpoint.replace(/([?&])([^=&]+)=([^&#]*)/g, (all, separator, key) => secret.test(key) ? `${separator}${key}={{${key.toUpperCase()}}}` : all);
}
export async function scanSource(sourceRoot, subdir = '', cache) {
  const directory = child(sourceRoot, subdir);
  await noLinks(directory);
  if (!(await lstat(directory)).isDirectory()) throw new Error('來源不是資料夾。');
  const { files, warnings, sourceHash } = await frontendSnapshot(directory);
  const extracted = cache?.directory===directory&&cache.sourceHash===sourceHash ? cache.extracted : extractRequests(files);
  if(cache)Object.assign(cache,{directory,sourceHash,extracted});
  const requests = new Map();
  for (const raw of extracted.requests) {
    const endpoint = cleanEndpoint(raw.endpoint), body = cleanBody(raw.body, raw.usages || []);
    const graphql = raw.kind === 'graphql';
    const query = graphql && body && typeof body === 'object' ? body.query : '';
    let operationType = '';
    if (query) try { operationType = parse(query).definitions.find(item => item.kind === 'OperationDefinition')?.operation || ''; } catch {}
    const key = graphql ? `graphql:${raw.operationName}:${hash(query || '')}` : `http:${raw.method}:${endpoint}`;
    const evidence = [...raw.evidence, ...(raw.usages || []).map(item => ({ path: item.path, line: item.line }))];
    if (requests.has(key)) {
      const previous = requests.get(key);
      previous.evidence.push(...evidence);
      if (JSON.stringify(previous.body) !== JSON.stringify(body) || JSON.stringify(previous.queryParams) !== JSON.stringify(publicValue(raw.queryParams))) previous.issues.push('同接口有不同請求資料；此草稿只保留第一份，請核對所有來源。');
      continue;
    }
    let service = '相對路徑（環境決定）';
    if (/^https?:\/\//.test(endpoint) && !endpoint.includes('{{')) service = new URL(endpoint).origin;
    else if (!endpoint || endpoint.includes('{{')) service = '動態端點（服務未確認）';
    requests.set(key, { id: hash(key).slice(0, 20), kind: raw.kind, method: raw.method, endpoint,
      name: graphql ? raw.operationName || '匿名 GraphQL 操作' : `${raw.method} ${endpoint || '未知端點'}`,
      operationName: raw.operationName, operationType, service,
      headers: Object.fromEntries(Object.entries(raw.headers).filter(([key]) => /^(content-type|accept)$/i.test(key))),
      queryParams: publicValue(raw.queryParams), body, evidence,
      issues: [...new Set([...(raw.issues.length ? ['包含環境、動態資料或認證需求，需核對來源。'] : []), '尚無業務斷言，產生後需設定測試資料與預期。',
        ...(operationType === 'subscription' ? ['Subscription 尚不支援 HTTP 單點執行。'] : []),
        ...(/\{\{/.test(JSON.stringify(body)) ? ['請求內容包含待設定變數。'] : [])])] });
  }
  for (const item of requests.values()) item.evidence = [...new Map(item.evidence.map(row => [`${row.path}:${row.line}`, row])).values()];
  return { schemaVersion: 1, scanId: randomUUID(), createdAt: new Date().toISOString(), sourceLabel: subdir || '.', files: files.length,
    requests: [...requests.values()], warnings: [...warnings, ...extracted.issues.map(() => '部分 import 或動態呼叫未能解析；清單不代表完整 API 覆蓋。')].filter((value, index, array) => array.indexOf(value) === index),
    sourceFiles: files.map(file => ({ path: file.path, hash: hash(file.source) })),
    sourceHash: hash(JSON.stringify(files.map(file => [file.path, hash(file.source)]))) };
}
