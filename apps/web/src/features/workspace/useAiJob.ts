import { useEffect, useState } from 'react';
import { operation } from './client';
import type { LocalConfig } from './client';
export interface AiJob { id: string; kind: string; status: 'running' | 'completed' | 'failed' | 'cancelled'; stage: string; error?: string; result?: { updated?: number; replaced?: number; conflicts?: string[]; coverage?: { features: number } } }
export function useAiJob(config?: LocalConfig) {
  const [job,setJob]=useState<AiJob>(),[error,setError]=useState('');
  useEffect(()=>{if(!config?.initialized)return;let disposed=false;void operation<AiJob|null>(config,'ai-status').then(value=>{if(!disposed&&value)setJob(value);}).catch(()=>{});return()=>{disposed=true;};},[config?.projectRoot]);
  useEffect(()=>{if(!config||job?.status!=='running')return;let disposed=false;const timer=setInterval(()=>{void operation<AiJob>(config,'ai-status',{id:job.id}).then(value=>{if(!disposed){setJob(value);setError('');}}).catch(reason=>{if(!disposed){const message=reason instanceof Error?reason.message:'無法讀取 AI 狀態，請確認本機服務仍在執行。';setError(message);if(message.includes('工作不存在或服務已重啟'))setJob(previous=>previous?{...previous,status:'failed',stage:'服務已重啟，請重新分析'}:previous);}});},1500);return()=>{disposed=true;clearInterval(timer);};},[config,job?.id,job?.status]);
  async function start(action:string,input={}){if(!config)throw new Error('工作區尚未設定');setError('');try{const value=await operation<AiJob>(config,action,input);setJob(value);return value;}catch(reason){setError(reason instanceof Error?reason.message:'AI 無法啟動');throw reason;}}
  async function cancel(){if(!config||!job)return;try{setJob(await operation<AiJob>(config,'ai-cancel',{id:job.id}));}catch(reason){setError(reason instanceof Error?reason.message:'取消失敗');}}
  return {job,error,start,cancel,running:job?.status==='running'};
}
