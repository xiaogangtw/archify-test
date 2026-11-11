import { createAndroidBridge } from './bridge.mjs';
const bridge = createAndroidBridge();
try {
  const status = await bridge.status();
  console.log(JSON.stringify(status, null, 2));
  if (!status.sdk.ready) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify(error.androidStatus || { issues: [error.message] }, null, 2));
  process.exitCode = 1;
} finally { bridge.close(); }
