// Keep each offline volume compatible with existing readers. Never discard an image.
export function reportParts(cases, { imageLimit = 8, byteLimit = 4 * 1024 * 1024 } = {}) {
  const fragments = [];
  for (const item of cases) {
    const images = item.screenshots || [];
    const chunks = [];
    let chunk = [], bytes = 0;
    for (const image of images) {
      const size = Buffer.byteLength(image.data, 'base64');
      if (size > byteLimit) throw new Error('單張截圖超過報告容量。');
      if (chunk.length && (chunk.length >= imageLimit || bytes + size > byteLimit)) { chunks.push(chunk); chunk = []; bytes = 0; }
      chunk.push(image); bytes += size;
    }
    if (chunk.length) chunks.push(chunk);
    if (!chunks.length) chunks.push([]);
    const count = Math.max(chunks.length, Math.ceil((item.steps || []).length / 1000));
    for (let index = 0; index < count; index++) {
      const steps = item.steps?.slice(index * 1000, (index + 1) * 1000);
      fragments.push({ ...item, screenshots: chunks[index] || [],
        ...(steps ? { steps: steps.length ? steps : [{ name: '畫面證據續卷', expected: '操作與預期見同案例其他分卷；本卷圖片標題對應原操作', status: item.status }] } : {}),
        ...(count > 1 ? { evidencePart: { index: index + 1, total: count },
          purpose: `此案例證據第 ${index + 1}／${count} 卷；相同案例，並非新增執行。` + item.purpose } : {}) });
    }
  }
  const parts = []; let part = [], bytes = 0;
  for (const fragment of fragments) {
    const size = (fragment.screenshots || []).reduce((sum, image) => sum + Buffer.byteLength(image.data, 'base64'), 0);
    // Same-case fragments must be in different volumes (reader IDs are unique).
    if (part.length && (bytes + size > byteLimit || part.some(item => item.id === fragment.id) || part.length >= 2000)) { parts.push(part); part = []; bytes = 0; }
    part.push(fragment); bytes += size;
  }
  if (part.length) parts.push(part);
  return parts;
}
