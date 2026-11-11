// Wire layout follows Genymobile/scrcpy v3.3.3's serialization tests.
export const MAX_PACKET = 2 * 1024 * 1024;
export function controlPacket(event) {
  if (event.type === 'reset') return Buffer.from([17]);
  if (event.type === 'key') {
    if (![0, 1].includes(event.action) || ![3, 4, 19, 20, 21, 22, 61, 62, 66, 67, 187].includes(event.keycode)) throw new Error('不支援的按鍵。');
    const packet = Buffer.alloc(14); packet[0] = 0; packet[1] = event.action; packet.writeUInt32BE(event.keycode, 2); return packet;
  }
  if (event.type !== 'touch' || ![0, 1, 2].includes(event.action) || !Number.isInteger(event.pointerId) || event.pointerId < 0 || event.pointerId > 9) throw new Error('無效的觸控事件。');
  const { x, y, width, height } = event;
  if (![x, y, width, height].every(Number.isInteger) || width < 1 || height < 1 || width > 4096 || height > 4096 || x < 0 || y < 0 || x >= width || y >= height) throw new Error('觸控位置超出畫面。');
  const packet = Buffer.alloc(32); packet[0] = 2; packet[1] = event.action;
  packet.writeBigUInt64BE(BigInt(event.pointerId), 2); packet.writeUInt32BE(x, 10); packet.writeUInt32BE(y, 14);
  packet.writeUInt16BE(width, 18); packet.writeUInt16BE(height, 20);
  packet.writeUInt16BE(event.action === 1 ? 0 : 65535, 22);
  // Touchscreen events carry no mouse buttons.
  return packet;
}
export function encodeRelayFrame(serial, flags, timestamp, payload) {
  if (!/^emulator-\d+$/.test(serial) || payload.length > MAX_PACKET) throw new Error('無效影片封包。');
  const name = Buffer.from(serial), header = Buffer.alloc(1 + name.length + 9);
  header[0] = name.length; name.copy(header, 1); header[1 + name.length] = flags;
  header.writeBigUInt64BE(BigInt(timestamp), 2 + name.length);
  return Buffer.concat([header, payload]);
}
export function decodeRelayFrame(packet) {
  const length = packet[0];
  if (!length || length > 32 || packet.length < length + 10 || packet.length > MAX_PACKET + 42) throw new Error('無效中繼封包。');
  const serial = packet.subarray(1, length + 1).toString();
  if (!/^emulator-\d+$/.test(serial)) throw new Error('無效裝置。');
  return { serial, video: packet.subarray(length + 1) };
}
export class ScrcpyVideoParser {
  buffer = Buffer.alloc(0); phase = 'header';
  constructor(onMetadata, onPacket) { this.onMetadata = onMetadata; this.onPacket = onPacket; }
  feed(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.buffer.length > MAX_PACKET + 1024 * 1024) throw new Error('影片緩衝過大。');
    if (this.phase === 'header') {
      if (this.buffer.length < 77) return;
      if (this.buffer[0] !== 0 || this.buffer.readUInt32BE(65) !== 0x68323634) throw new Error('Scrcpy 協定或影片編碼不符。');
      const width = this.buffer.readUInt32BE(69), height = this.buffer.readUInt32BE(73);
      if (width < 1 || height < 1 || width > 4096 || height > 4096) throw new Error('無效影片尺寸。');
      this.onMetadata({ codec: 'h264', width, height }); this.buffer = this.buffer.subarray(77); this.phase = 'packets';
    }
    while (this.buffer.length >= 12) {
      const size = this.buffer.readUInt32BE(8);
      if (size < 1 || size > MAX_PACKET) throw new Error('Scrcpy 影片封包過大。');
      if (this.buffer.length < size + 12) return;
      const tag = this.buffer.readBigUInt64BE(0), flags = Number(tag >> 62n);
      const data = this.buffer.subarray(12, size + 12);
      this.onPacket(flags, tag & ((1n << 62n) - 1n), data);
      this.buffer = this.buffer.subarray(size + 12);
    }
  }
}
