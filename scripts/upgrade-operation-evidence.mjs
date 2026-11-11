import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
const root=resolve(process.argv[2] || '');
const config=JSON.parse(readFileSync(join(root,'archify.config.json'),'utf8'));
if(config.schemaVersion!==2 || config.framework!=='playwright')throw new Error('只接受已初始化的 Playwright 獨立測試專案。');
const backup=join(root,'legacy/framework-upgrades/operation-evidence-'+Date.now());
function save(part,content){const path=join(root,part);if(existsSync(path)){const old=readFileSync(path,'utf8');if(old===content)return;const copy=join(backup,part);mkdirSync(dirname(copy),{recursive:true});copyFileSync(path,copy);}mkdirSync(dirname(path),{recursive:true});writeFileSync(path,content);console.log('已更新：'+part);}
for(const part of ['support/web-test.ts','support/operation-evidence.mjs','support/operation-evidence.d.mts','support/ui-diagnostics.mjs','support/check-ui-evidence.mjs','support/archify-reporter.mjs','support/commands.mjs','framework/report-parts.mjs','framework/html.mjs','framework/html.d.mts','framework/journey-report.mjs','framework/report-theme.mjs','framework/text-report.mjs','skills/playwright-test-report/scripts/build-report.mjs'])save(part,readFileSync(new URL('../test-project/'+part,import.meta.url),'utf8'));
const packageFile=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));packageFile.scripts['check:ui-evidence']='node support/check-ui-evidence.mjs';save('package.json',JSON.stringify(packageFile,null,2)+'\n');
let source=readFileSync(join(root,'playwright.config.ts'),'utf8');
if(!source.includes('check-ui-evidence.mjs')){
  if(source.includes('globalSetup:'))throw new Error('既有 globalSetup 需人工合併，未覆寫。');
  source=source.replace("reporter: [['./support/archify-reporter.mjs']],", "reporter: [['./support/archify-reporter.mjs']],\n  globalSetup: './support/check-ui-evidence.mjs',");
  if(!source.includes('check-ui-evidence.mjs'))throw new Error('找不到可辨識的框架設定，需人工合併。');
  save('playwright.config.ts',source);
}
// Existing user instructions remain in place; append the current shared contract.
for(const part of ['AGENTS.md','README.md','skills/write-web-tests/SKILL.md','skills/playwright-test-report/SKILL.md','skills/implement-tests/SKILL.md','skills/write-tests/SKILL.md']){
  let text=readFileSync(join(root,part),'utf8');
  if(text.includes('## 固定逐操作證據契約'))continue;
  text=text.replaceAll('截圖預設關閉','新建框架截圖預設開啟，既有明確關閉保留');
  text += '\n## 固定逐操作證據契約\n\n本節取代舊的結束畫面及八張上限說明：網頁從 support/web-test.js 匯入 test／expect，fixture browser 建立的 page／自訂 context 自動對每次常用操作及畫面斷言留圖。多角色立即 setUiRole(page, 角色名稱)；evaluate 或特殊操作使用 uiStep(page, 中文動作與預期, callback)。不得抽樣、八張後略過或只截結束畫面；globalSetup 及 npm run check:ui-evidence 驗證共用 import。截圖關閉仍不擷取，不自行繞過。圖中密碼與 autocomplete=one-time-code 輸入會遮罩，其他個資不保證遮蔽。所有圖依原順序保存並按容量自動分卷，同 runId／caseId 的各卷不是新案例；截圖失敗必須回報失敗，不能捏造證據。純 API、關閉頁面與釋放資源不拍圖。先 check:ui-evidence、check:types，再執行已獲授權的產品案例。\n';
  save(part,text);
}
for(const part of ['AGENTS.md','README.md','skills/write-web-tests/SKILL.md','skills/playwright-test-report/SKILL.md','skills/implement-tests/SKILL.md']){
  let text=readFileSync(join(root,part),'utf8');
  if(text.includes('## 圖文範本與就緒診斷契約'))continue;
  text=text.replace('## 舊圖文格式','## 範本來源與相容轉接').replace(/此 skill 原本來自使用者提供的 playwright-test-report\.7z[^\r\n]*/,
    '使用者提供的 playwright-test-report 圖文範本為現行視覺來源；網站、離線 HTML 及舊 results.json 轉接均使用 framework/journey-report.mjs，不降為 legacy。新案例仍使用統一 JSON，不另造結果格式。');
  text+='\n## 圖文範本與就緒診斷契約\n\n本節取代舊的通用清單／安全摘要規則：現行採使用者提供的深藍白紙角色圖文範本，網站及離線共用 journey-report。重要頁面用 setUiReady(page, selector) 明示就緒條件，完成後 setUiReady(page, null) 還原；不能只等 goto 返回或把白圖當成功。登入／註冊等回應使用 uiWaitForResponse(page, OperationName, trigger)，先監聽再觸發，逾時保存操作名、上限、安全診斷及當下圖，不重送。catalog 提供整體／規劃預期；uiStep 第四參數與 expect 中文訊息提供當步預期。不得以「依測試檔中的斷言」或同一句通用錯誤取代診斷。未知／舊資料明示未保存；不回填、捏造或輸出原始例外與秘密。\n';
  save(part,text);
}
console.log('原檔備份：'+backup);
