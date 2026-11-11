import {test} from 'node:test';
import assert from 'node:assert/strict';
import {caseActual} from './case-narrative.mjs';
test('具體結果只採成功案例的實測敘述，失敗保留已完成與停止位置',()=>{
 const steps=[{name:'A：輸入驗證碼並完成註冊',status:'passed'},{name:'A：保存名片設定',status:'passed'},{name:'42. A／頁面1｜點擊：編輯名片',status:'failed',actual:'操作逾時。'},{name:'清理帳號',status:'failed',error:'刪除失敗'}];
 const result=caseActual({status:'failed',steps},'雙方申請正確。');
 assert.match(result,/完成註冊/);assert.match(result,/點擊：編輯名片/);assert.match(result,/後續業務結果尚未驗證/);assert.ok(!result.includes('雙方申請正確'));
 assert.equal(caseActual({status:'passed',steps:[]},'雙方待同意與待審核皆顯示申請，小明未收到重複推薦。'),'雙方待同意與待審核皆顯示申請，小明未收到重複推薦。');
 assert.match(caseActual({status:'passed',steps:[]}),/未保存具體業務結果/);
});
