type Message = { role: 'user' | 'assistant'; content: string };

// Leave room for the newest request and keep the JSON body below the API limit,
// including when the conversation contains multibyte Chinese characters.
export function authoringMessages(history: Message[], content: string): Message[] {
  const recent = history.slice(-29);
  let omitted = history.length - recent.length;
  const encoder = new TextEncoder();
  for (;;) {
    const note = omitted ? `較早的 ${omitted} 則對話未包含在本次請求中；如果缺少判斷所需資訊，請詢問使用者。\n` : '';
    const current: Message = { role: 'user', content: note + content };
    const messages = [...recent, current];
    if (current.content.length > 200000) throw new Error('目前案例與對話資料過大，請縮短後再試。');
    const bytes = encoder.encode(JSON.stringify({ purpose: 'android-flow', agentId: 'code', messages })).length;
    if (bytes <= 900000) return messages;
    if (!recent.length) throw new Error('目前案例與畫面資料過大，請縮短後再試。');
    recent.shift(); omitted++;
  }
}
