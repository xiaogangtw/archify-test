export function workerCount(input) {const value=Number(input);return Number.isFinite(value)&&value>0?Math.max(1,Math.min(4,Math.floor(value))):3;}
export async function runWorkerPool(count,worker) {await Promise.all(Array.from({length:workerCount(count)},(_,index)=>worker(index)));}
