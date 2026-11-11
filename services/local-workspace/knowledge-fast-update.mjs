import { CANONICAL_LIMIT } from './knowledge-upload.mjs';

const comparable = text => text.normalize('NFC').replace(/\s+/gu, ' ').trim();
function signature(text) {
  const counts = new Map();
  for (let i = 0; i <= text.length - 5; i++) {
    const key = text.slice(i, i + 5); counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}
function similarity(a, b) {
  let overlap = 0;
  for (const [key, count] of a) overlap += Math.min(count, b.get(key) || 0);
  const size = map => [...map.values()].reduce((sum, n) => sum + n, 0);
  return 2 * overlap / (size(a) + size(b));
}

export function quickKnowledgePlan(uploads, before) {
  const documents = before.documents;
  const current = new Map(documents.map(row => [row.id, row.hash]));
  const receipts = (before.uploadReceipts || []).filter(row => Array.isArray(row.documents) && row.documents.length && row.documents.every(doc => current.get(doc.id) === doc.hash));
  const seen = new Set(), skipped = [], active = [];
  for (const upload of uploads) {
    const text = upload.normalized?.content;
    if (seen.has(upload.source.sha256) || receipts.some(row => row.sha256 === upload.source.sha256) || (text && documents.some(row => row.content === text))) skipped.push(upload.source.name);
    else active.push(upload);
    seen.add(upload.source.sha256);
  }
  if (!active.length) return { direct: [], pending: [], skipped };
  const candidates = documents.filter(row => !(row.sources || []).some(source => source.kind === 'image')).map(row => ({ row, text: comparable(row.content) }));
  const matches = active.map(upload => {
    if (!upload.normalized || Buffer.byteLength(upload.normalized.content) > CANONICAL_LIMIT) return null;
    const text = comparable(upload.normalized.content);
    const ranked = [];
    let input;
    for (const candidate of candidates) {
      const ratio = Math.min(text.length, candidate.text.length) / Math.max(text.length, candidate.text.length);
      if (text === candidate.text) ranked.push({ row: candidate.row, score: 1 });
      else if (Math.min(text.length, candidate.text.length) >= 80 && ratio >= 0.85) {
        input ||= signature(text);
        const score = similarity(input, signature(candidate.text));
        if (score >= 0.87) ranked.push({ row: candidate.row, score });
      }
    }
    ranked.sort((a, b) => b.score - a.score);
    return ranked[0]?.score >= 0.92 && (!ranked[1] || ranked[0].score - ranked[1].score >= 0.05) ? ranked[0].row : null;
  });
  const counts = new Map();
  for (const match of matches) if (match) counts.set(match.id, (counts.get(match.id) || 0) + 1);
  const direct = [], pending = [];
  active.forEach((upload, index) => {
    const match = matches[index];
    if (match && counts.get(match.id) === 1) direct.push({ upload, previous: match });
    else pending.push(upload);
  });
  return { direct, pending, skipped };
}
