import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error Local Node middleware is authored as ESM JavaScript.
import { localWorkspacePlugin } from '../../services/local-workspace/plugin.mjs';
export default defineConfig({
  plugins: [react(), localWorkspacePlugin()],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
});
