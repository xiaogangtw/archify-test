// Select replayable attributes from actual native evidence, never synthetic refs.
export function replayLocator(xml, target, index) {
  const nodes=xml.match(/<[A-Za-z_][\w:.$-]*\b[^>]*>/g)||[];
  const decode=value=>value.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  const attr=name=>{const match=target.match(new RegExp(`\\s${name}="([^"]*)"`));return match?decode(match[1]):'';};
  const quote=value=>!value.includes("'")?`'${value}'`:!value.includes('"')?`"${value}"`:`concat(${value.split("'").map(part=>`'${part}'`).join(',"\'",')})`;
  for(const [attribute,using]of [['resource-id','id'],['content-desc','accessibility id'],['text','xpath']]){
    const value=attr(attribute);if(!value)continue;
    const encoded=target.match(new RegExp(`\\s${attribute}="([^"]*)"`))[1];
    if(nodes.filter(node=>node.includes(` ${attribute}="${encoded}"`)).length===1)return {using,value:using==='xpath'?`//*[@text=${quote(value)}]`:value};
  }
  const id=attr('resource-id'),text=attr('text');
  if(id&&text){const selector=`//*[@resource-id=${quote(id)} and @text=${quote(text)}]`;const matches=nodes.filter(node=>node.includes(` resource-id="${target.match(/resource-id="([^"]*)"/)[1]}"`)&&node.includes(` text="${target.match(/\stext="([^"]*)"/)[1]}"`));if(matches.length===1)return {using:'xpath',value:selector};}
  return {using:'xpath',value:`(//*)[${index+1}]`};
}
