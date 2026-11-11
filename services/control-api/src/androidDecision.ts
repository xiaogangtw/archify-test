import limits from './llmTimeouts.json' with {type:'json'};

export class AndroidDecisionTimeout extends Error {
 constructor(){super('30 秒內未取得下一步判斷，已暫停並保留草稿與操作紀錄。');}
}

// A late model reply must never dispatch an operation after we ask the user.
export async function androidDecision<T>(plan:()=>Promise<T>):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  return await Promise.race([new Promise<never>((_resolve,reject)=>{
   timer=setTimeout(()=>reject(new AndroidDecisionTimeout()),limits.androidDecisionMs);
  }),Promise.resolve().then(plan)]);
 }finally{clearTimeout(timer);}
}
