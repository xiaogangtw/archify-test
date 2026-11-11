import { useEffect, useRef, useState } from 'react';

export type Touch = { type: 'touch'; action: number; pointerId: number; x: number; y: number; width: number; height: number };
export function useScrcpy(serial: string, enabled: boolean) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const socket = useRef<WebSocket | null>(null);
  const touches = useRef(new Map<number, Touch>());
  const [state, setState] = useState('連線中');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [control, setControl] = useState(false);
  function send(event: object) {
    const ws = socket.current;
    if (ws?.readyState !== WebSocket.OPEN || ws.bufferedAmount > 65536) { ws?.close(); return; }
    ws.send(JSON.stringify(event));
  }
  function touch(event: Touch) {
    send(event);
    if (event.action === 1) touches.current.delete(event.pointerId); else touches.current.set(event.pointerId, event);
  }
  function release() { for (const event of touches.current.values()) send({ ...event, action: 1 }); touches.current.clear(); }
  useEffect(() => {
    let disposed = false, retry: number | undefined, backgroundTimer: number | undefined, decoder: VideoDecoder | undefined;
    let config: Uint8Array | undefined, waitingKey = true, lastReset = 0;
    let software = false, failure = '', recoveryAttempts = 0;
    function disconnect() {
      release(); socket.current?.close(); socket.current = null;
      if (decoder && decoder.state !== 'closed') decoder.close(); decoder = undefined;
      config = undefined; waitingKey = true; setReady(false); setControl(false); window.clearTimeout(retry);
    }
    function connect() {
      disconnect();
      if (disposed) return;
      if (!enabled || document.hidden) { failure = ''; setError(''); setState('已暫停'); return; }
      if (!('VideoDecoder' in window)) { setState('無法播放'); setError('此瀏覽器無法解碼影片，請用 Chrome 或 Edge，並以 localhost 或 HTTPS 開啟。'); return; }
      setState('連線中');
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/android/devices/${serial}/scrcpy`);
      socket.current = ws; ws.binaryType = 'arraybuffer';
      function reset() {
        waitingKey = true;
        if (Date.now() - lastReset > 2000) { lastReset = Date.now(); send({ type: 'reset' }); }
      }
      decoder = new VideoDecoder({
        output(frame) {
          try {
            const target = canvas.current;
            if (!target || disposed || socket.current !== ws) return;
            target.width = frame.displayWidth; target.height = frame.displayHeight;
            target.getContext('2d')?.drawImage(frame, 0, 0, target.width, target.height);
            failure = ''; recoveryAttempts = 0; window.clearTimeout(retry); setReady(true); setState('即時串流中'); setError('');
          } finally { frame.close(); }
        },
        error(reason) {
          if (disposed || socket.current !== ws) return;
          software = true;
          failure = `瀏覽器影片解碼失敗（${reason.name}），改用軟體解碼重連。`;
          setError(failure); ws.close();
        },
      });
      ws.onmessage = event => {
        if (disposed || socket.current !== ws) return;
        try {
          if (typeof event.data === 'string') {
            const message = JSON.parse(event.data);
            if (message.type === 'connected') { setControl(message.control === true); setState('影片通道已連線，等待畫面'); }
            if (message.type === 'error') {
              setError(message.message); setState('等待畫面'); setReady(false);
              // Older workers can leave an open viewer socket after the device
              // stream exits. Recreate the subscription rather than requiring
              // a manual pause/resume. Never retry device input.
              if (recoveryAttempts < 3) {
                window.clearTimeout(retry);
                retry = window.setTimeout(() => { recoveryAttempts++; connect(); }, 2000);
              }
            }
            return;
          }
          const data = new Uint8Array(event.data);
          if (data.length < 10 || data.length > 2200000) throw new Error();
          const flags = data[0], payload = data.subarray(9);
          if (flags & 2) {
            config = payload.slice();
            // Annex B SPS identifies the decoder profile. Keep parameter sets
            // and prepend them to the first keyframe after configuration.
            for (let i = 0; i + 7 < payload.length; i++) {
              const prefix = payload[i] === 0 && payload[i + 1] === 0 && (payload[i + 2] === 1 ? 3 : payload[i + 2] === 0 && payload[i + 3] === 1 ? 4 : 0);
              if (prefix && (payload[i + prefix] & 31) === 7) {
                const codec = 'avc1.' + [...payload.subarray(i + prefix + 1, i + prefix + 4)].map(n => n.toString(16).padStart(2, '0')).join('');
                decoder!.configure({ codec, optimizeForLatency: true, hardwareAcceleration: software ? 'prefer-software' : 'no-preference' }); waitingKey = true; break;
              }
            }
            return;
          }
          const key = !!(flags & 1);
          if (!decoder || decoder.state !== 'configured' || (waitingKey && !key)) return;
          if (decoder.decodeQueueSize > 3) { decoder.reset(); reset(); return; }
          let chunk = payload;
          if (key && config) { chunk = new Uint8Array(config.length + payload.length); chunk.set(config); chunk.set(payload, config.length); }
          const timestamp = Number(new DataView(data.buffer, data.byteOffset + 1, 8).getBigUint64(0));
          decoder.decode(new EncodedVideoChunk({ type: key ? 'key' : 'delta', timestamp, data: chunk })); waitingKey = false;
        } catch (reason) {
          failure = `無法解讀影片（${reason instanceof Error ? reason.name : '資料格式錯誤'}），正在重新連線。`;
          setError(failure); ws.close();
        }
      };
      ws.onclose = event => {
        if (disposed || socket.current !== ws) return;
        disconnect(); setState('重新連線中');
        setError(failure || (event?.code === 1008 ? event.reason === 'Invalid control' ? '影片操作被拒絕：此視窗沒有操作權，或操作資料未通過檢查。'
          : event.reason === 'Unavailable or forbidden' ? '影片握手被拒絕：執行器影片通道、裝置、網站來源或觀看人數未通過檢查。'
          : '執行器影片連線已失效，正在重新連線。'
          : event?.code === 1012 ? '執行器或裝置連線已中斷，正在重連。'
          : event?.code === 1013 ? '影片傳送壅塞，正在重新連線以清除積壓畫面。'
          : `影片連線中斷（${event?.code || '未取得狀態碼'}），正在重連；請確認 dev 視窗仍在執行。`));
        retry = window.setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
    }
    function visibilityChanged() {
      window.clearTimeout(backgroundTimer);
      if (document.hidden) {
        release();
        // Switching applications can merely blur the window. A brief hidden
        // transition should not tear down and start the Android encoder again.
        backgroundTimer = window.setTimeout(() => {
          if (!document.hidden || disposed) return;
          disconnect(); setState('背景暫停，返回後自動恢復'); setError('');
        }, 1500);
      } else {
        if (socket.current && (socket.current.readyState === WebSocket.OPEN || socket.current.readyState === WebSocket.CONNECTING)) return;
        connect();
      }
    }
    connect();
    document.addEventListener('visibilitychange', visibilityChanged); window.addEventListener('blur', release);
    return () => { disposed = true; window.clearTimeout(backgroundTimer); disconnect(); document.removeEventListener('visibilitychange', visibilityChanged); window.removeEventListener('blur', release); };
  }, [serial, enabled]);
  return { canvas, state, error, ready, control, touch, release, key(keycode: number) { send({ type: 'key', action: 0, keycode }); send({ type: 'key', action: 1, keycode }); } };
}
