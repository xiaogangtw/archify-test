import { createHash } from 'node:crypto';
import { imageSize } from 'image-size';
import { knowledgeInput } from './knowledge-input.mjs';
export const SOURCE_LIMIT = 10 * 1024 * 1024;
export const BATCH_LIMIT = 20 * 1024 * 1024;
export const CANONICAL_LIMIT = 128 * 1024;
export const hashBytes = bytes => createHash('sha256').update(bytes).digest('hex');
export function prepareUploads(documents) {
  if (!Array.isArray(documents) || !documents.length || documents.length > 20) throw new Error('每次請上傳 1 至 20 份文件或圖片。');
  let total = 0;
  return documents.map(doc => {
    if (!doc || typeof doc.name !== 'string' || doc.name.length > 200 || /[\\/\0\r\n]/.test(doc.name) || !/\.(md|txt|html?|png|jpe?g|webp)$/i.test(doc.name)) throw new Error('支援 MD、HTML、TXT、PNG、JPEG、WebP，檔名不可包含路徑。');
    let bytes;
    if (doc.base64 !== undefined) {
      if (typeof doc.base64 !== 'string' || doc.base64.length > Math.ceil(SOURCE_LIMIT / 3) * 4 || doc.base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(doc.base64)) throw new Error('上傳檔案編碼或大小不符。');
      bytes = Buffer.from(doc.base64, 'base64');
      if (bytes.toString('base64') !== doc.base64) throw new Error('上傳檔案編碼不合法。');
    } else if (typeof doc.content === 'string') bytes = Buffer.from(doc.content, 'utf8');
    else throw new Error('缺少上傳檔案內容。');
    total += bytes.length;
    if (!bytes.length || bytes.length > SOURCE_LIMIT || total > BATCH_LIMIT) throw new Error('每份最多 10 MB，每批合計最多 20 MB。');
    const extension = doc.name.split('.').at(-1).toLowerCase();
    const image = ['png', 'jpg', 'jpeg', 'webp'].includes(extension);
    let mediaType, dimensions, normalized;
    if (image) {
      try { dimensions = imageSize(bytes); } catch { throw new Error('圖片檔案無法辨識，請使用有效的 PNG、JPEG 或 WebP。'); }
      const expected = extension === 'jpeg' ? 'jpg' : extension;
      if (dimensions.type !== expected || !dimensions.width || !dimensions.height || dimensions.width > 12000 || dimensions.height > 12000 || dimensions.width * dimensions.height > 40000000) throw new Error('圖片格式與副檔名不符，或尺寸超過 12000 邊長／4000 萬像素。');
      mediaType = expected === 'jpg' ? 'image/jpeg' : 'image/' + expected;
    } else {
      let content; try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('文字文件請使用 UTF-8 編碼。'); }
      normalized = knowledgeInput([{ ...doc, base64: undefined, content }])[0];
      mediaType = extension.startsWith('htm') ? 'text/html' : extension === 'md' ? 'text/markdown' : 'text/plain';
    }
    const sha256 = hashBytes(bytes);
    return { bytes, normalized, source: { name: doc.name, sha256, path: `knowledge/sources/${sha256}.${extension}`, bytes: bytes.length, mediaType, kind: image ? 'image' : 'text', ...(dimensions ? { width: dimensions.width, height: dimensions.height } : {}) } };
  });
}
/** UTF-8 byte bounded segments; prefer a newline, never discard intervening text. */
export function splitKnowledge(content, limit = 96 * 1024) {
  const parts = []; let part = '', size = 0;
  for (const line of content.split(/(?<=\n)/u)) {
    const bytes = Buffer.byteLength(line);
    if (bytes <= limit) { if (size + bytes > limit) { parts.push(part); part = ''; size = 0; } part += line; size += bytes; continue; }
    for (const point of line) { const n = Buffer.byteLength(point); if (size + n > limit) { parts.push(part); part = ''; size = 0; } part += point; size += n; }
  }
  if (part) parts.push(part);
  return parts;
}
