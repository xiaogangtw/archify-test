import { parse } from 'parse5';
export function knowledgeInput(documents) {
  if(!Array.isArray(documents)||!documents.length||documents.length>20)throw new Error('每次請匯入 1 至 20 份 MD、HTML 或 TXT。');
  let total=0;
  return documents.map(doc=>{
    if(!doc||typeof doc.name!=='string'||!/\.(md|txt|html?)$/i.test(doc.name)||/[\\/\0\r\n]/.test(doc.name)||doc.name.length>200||typeof doc.content!=='string'||!doc.content.trim()||doc.content.includes('\0'))throw new Error('請使用非空白 UTF-8 MD、HTML 或 TXT，檔名不可包含路徑。');
    const size=Buffer.byteLength(doc.content);total+=size;if(size>10*1024*1024||total>20*1024*1024)throw new Error('每份最多 10 MB，每批最多 20 MB。');
    let content=doc.content;
    if(/\.html?$/i.test(doc.name)) {
      const root=parse(content),pieces=[];
      const ignored=new Set(['script','style','template','noscript','iframe','object','embed','svg','canvas']);
      const stack=[{node:root,end:false}],blocks=new Set(['p','div','section','article','h1','h2','h3','h4','li','tr','table','br','header','footer']);
      while(stack.length){const {node,end}=stack.pop();if(end){pieces.push('\n');continue;}if(ignored.has(node.tagName))continue;if(node.nodeName==='#text')pieces.push(node.value);if(blocks.has(node.tagName))stack.push({node,end:true});for(let i=(node.childNodes||[]).length-1;i>=0;i--)stack.push({node:node.childNodes[i],end:false});}
      content=pieces.join(' ').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
    }
    if(!content.trim())throw new Error('文件沒有可分析的文字，請匯出含文字內容的 MD 或 HTML。');
    return {...doc,name:doc.name.replace(/\.html?$/i,'.md'),content,sourceName:doc.name,sourceFormat:/\.html?$/i.test(doc.name)?'html':/\.md$/i.test(doc.name)?'md':'txt'};
  });
}
