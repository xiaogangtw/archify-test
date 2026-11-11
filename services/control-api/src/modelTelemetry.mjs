// Only outer transport metadata counts; never trust a model name inside generated reply text.
export function reportedModel(envelope){
 const valid=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/.test(value);
 if(valid(envelope?.model))return envelope.model;
 const usage=envelope?.modelUsage||envelope?.stats?.models;
 const names=usage&&typeof usage==='object'&&!Array.isArray(usage)?Object.keys(usage).filter(valid):[];
 return names.length===1?names[0]:undefined;
}
