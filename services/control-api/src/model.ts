import { z } from 'zod';
import {caseMetadataSchema} from './scriptCases.ts';
export const scriptSchema = z.object({id:z.string().min(1).max(100), name:z.string().trim().min(1).max(200), source:z.string().max(200000), version:z.number().int().min(0), caseType:z.enum(['test','flow']).optional(), metadata:caseMetadataSchema.optional(),agentTask:z.object({id:z.string().uuid(),draftRevision:z.number().int().min(0)}).strict().optional(),caseCode:z.string().regex(/^(?:TC|FC)-\d+$/).optional(),categoryId:z.string().nullable().optional(),maturity:z.enum(['candidate','draft']).optional(),messages:z.array(z.object({role:z.enum(['user','assistant']),text:z.string().max(20000)})).max(200)}).passthrough();
export const runSchema = z.object({scriptId:z.string().min(1),scriptVersion:z.number().int().positive(),requestId:z.uuid()});
export const batchSchema = z.object({
  requestId:z.uuid(),
  name:z.string().trim().max(100).optional(),
  manualCommits:z.object({frontend:z.string().regex(/^[a-fA-F0-9]{40}$/).optional(),bff:z.string().regex(/^[a-fA-F0-9]{40}$/).optional(),backend:z.string().regex(/^[a-fA-F0-9]{40}$/).optional()}).strict().optional(),
  scripts:z.array(z.object({scriptId:z.string().min(1).max(100),scriptVersion:z.number().int().positive()})).min(1).max(50),
}).refine(input=>new Set(input.scripts.map(script=>script.scriptId)).size===input.scripts.length,'Duplicate scripts');
export const terminal = new Set(['passed','failed','skipped','cancelled']);
export const documentKeys = new Set(['archify.llm-connections.v1','archify.api-drafts.v1','archify.testing.v1','archify.script-folders.v1','archify.git-connections.v1','archify.llm.v1','archify.agents.v1']);
export function snapshotSteps(source: string): string[] {
  return [...source.matchAll(/await\s+test\.step\(\s*['"`]([^'"`]+)['"`]/g)].map(match => match[1]);
}
export function publicRun(row: any) {
  return {...row.snapshot,id:row.id,scriptId:row.script_id,scriptVersion:row.script_version,testVersion:row.test_version,status:row.status,message:row.message,completed:row.completed,mode:'real',createdAt:row.created_at,startedAt:row.started_at,finishedAt:row.finished_at};
}
