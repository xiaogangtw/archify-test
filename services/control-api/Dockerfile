FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY services/control-api/package.json services/control-api/package.json
RUN npm ci --omit=dev --workspace services/control-api
COPY services/control-api services/control-api
COPY services/android/scrcpy-protocol.mjs services/android/scrcpy-protocol.mjs
COPY services/android/flow-contract.mjs services/android/flow-contract.mjs
COPY services/android/flow-limits.mjs services/android/flow-limits.mjs
COPY services/android/flow-dependencies.mjs services/android/flow-dependencies.mjs
COPY services/android/flow-guide.json services/android/flow-guide.json
COPY services/android/appium-commands.mjs services/android/appium-commands.mjs
COPY services/android/appium-knowledge.mjs services/android/appium-knowledge.mjs
COPY services/runner/smoke.spec.ts services/runner/smoke.spec.ts
# Windows archives may preserve owner-only file modes. Image source contains no
# runtime secrets. Normalize source only: touching node_modules recursively causes
# expensive overlay copy-up for thousands of already-readable dependency files.
RUN chmod 755 /app /app/services /app/services/runner /app/services/android \
    && chmod a+r /app/package*.json /app/services/runner/smoke.spec.ts /app/services/android/*.mjs /app/services/android/flow-guide.json \
    && find /app/services/control-api -name node_modules -prune \
       -o -type d -exec chmod a+rx {} + \
       -o -type f -exec chmod a+r {} +
USER node
RUN node --import tsx --input-type=module -e "import { readFileSync, accessSync } from 'node:fs'; JSON.parse(readFileSync('package.json','utf8')); accessSync('services/control-api/src/container.ts'); await import('./services/control-api/src/android.ts'); const { androidFlowPrompt } = await import('./services/control-api/src/androidFlowAuthoring.ts'); if (!androidFlowPrompt([]).includes('scrollUntilVisible')) throw new Error('Android authoring guide unavailable'); console.log('Non-root API runtime read check passed')"
CMD ["node","--import","tsx","services/control-api/src/main.ts"]
