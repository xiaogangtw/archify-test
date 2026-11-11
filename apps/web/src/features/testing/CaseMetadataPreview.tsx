import type {ScriptDraft} from './scriptModel';

type Row = [string, string | string[] | undefined];
function ContentRows({rows}:{rows:Row[]}) {
 return <dl className="space-y-4">{rows.filter(([,value])=>Array.isArray(value)?value.length:!!value).map(([label,value])=><div key={label} className="min-w-0 space-y-1">
  <dt className="font-medium">{label}</dt>
  <dd className="min-w-0 text-muted">{Array.isArray(value)?<ul className="list-disc space-y-1 pl-5">{value.map((item,index)=><li key={index} className="whitespace-pre-wrap break-words">{item}</li>)}</ul>:<p className="whitespace-pre-wrap break-words">{value}</p>}</dd>
 </div>)}</dl>;
}

export function CaseMetadataPreview({draft}:{draft:ScriptDraft}){
 const metadata=draft.metadata;
 if(!metadata&&!draft.caseCode)return null;
 const business:Row[]=[['測試目的',metadata?.objective],['預期結果',metadata?.expectedResults],['前置條件',metadata?.preconditions],['資料還原',metadata?.cleanup]];
 const evidence:Row[]=[['來源案例',metadata?.referenceCaseCode],['分類建議',metadata?.categorySuggestion],['測試資料參照',metadata?.dataRefs],['需求依據',metadata?.requirementRefs],['證據來源',metadata?.sourceRefs]];
 const hasEvidence=evidence.some(([,value])=>Array.isArray(value)?value.length:!!value);
 return <section aria-label="案例業務內容" className="min-w-0 space-y-4 border-b border-line pb-4 text-menu">
  <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-body font-medium">案例內容</h2><div className="flex flex-wrap gap-2 text-muted">{draft.maturity==='candidate'&&<span>候選情境</span>}{draft.caseCode&&<span aria-label={`案例編碼 ${draft.caseCode}`}>{draft.caseCode}</span>}</div></div>
  <ContentRows rows={business}/>
  {!!metadata?.assumptions?.length&&<ContentRows rows={[[ '待確認',metadata.assumptions ]]}/>}
  {hasEvidence&&<details className="min-w-0"><summary className="min-h-11 cursor-pointer rounded-lg py-3 font-medium text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">技術與證據</summary><div className="min-w-0 pt-2"><ContentRows rows={evidence}/></div></details>}
 </section>;
}
