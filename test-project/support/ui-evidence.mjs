import { fileURLToPath } from 'node:url';
import { reportOptions, pngBuffer } from './report-options.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function captureUi(screen,testInfo,caption='測試結束畫面'){
 if(!reportOptions(root).screenshots)return false;
 if(typeof caption!=='string'||!caption.trim()||caption.length>200)throw new Error('截圖說明格式不符。');
 const bytes=pngBuffer(await screen());await testInfo.attach('archify-screenshot:'+caption,{body:bytes,contentType:'image/png'});return true;
}
