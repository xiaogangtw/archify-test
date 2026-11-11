import limits from './llmOutputLimits.json' with {type:'json'};

function valueType(value){return value===null?'null':Array.isArray(value)?'array':typeof value;}

export function parseModelReply(content){
 if(typeof content!=='string')throw new Error('MODEL_REPLY_FORMAT: 模型未回傳 JSON 文字。');
 if(content.length>limits.responseCharacters)throw new Error(`MODEL_RESPONSE_LIMIT: 模型回應 ${content.length} 字元，超過 ${limits.responseCharacters} 字元上限。`);
 let answer;
 try{answer=JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/g,''));}
 catch{throw new Error('MODEL_REPLY_JSON: 模型回覆不是完整有效的 JSON，可能未完成輸出；原進度保留。');}
 if(!answer || typeof answer!=='object' || Array.isArray(answer))throw new Error('MODEL_REPLY_FORMAT: 回覆外層必須是包含 reply 的物件。');
 if(typeof answer.reply!=='string')throw new Error(`MODEL_REPLY_FORMAT: reply 欄位必須是字串，目前為 ${valueType(answer.reply)}。`);
 if(answer.reply.length>limits.replyCharacters)throw new Error(`MODEL_REPLY_LIMIT: reply 回覆 ${answer.reply.length} 字元，超過 ${limits.replyCharacters} 字元上限；請減少單批操作數量。`);
 if(answer.source!=null && typeof answer.source!=='string')throw new Error(`MODEL_SOURCE_FORMAT: source 欄位必須是字串或 null，目前為 ${valueType(answer.source)}。`);
 if(answer.source?.length>limits.sourceCharacters)throw new Error(`MODEL_SOURCE_LIMIT: 腳本超過 ${limits.sourceCharacters} 字元上限。`);
 return {reply:answer.reply,...(answer.source?{source:answer.source}:{})};
}
