FROM node:24-bookworm-slim
WORKDIR /opt/runner
COPY services/runner/package*.json ./
RUN npm ci --omit=dev
COPY services/runner/harness.mjs services/runner/reporter.cjs ./
RUN chmod 755 /opt/runner \
    && chmod a+r /opt/runner/package*.json /opt/runner/harness.mjs /opt/runner/reporter.cjs
USER node
RUN node --input-type=module -e "import { readFileSync } from 'node:fs'; JSON.parse(readFileSync('package.json','utf8')); readFileSync('harness.mjs'); readFileSync('reporter.cjs'); console.log('Non-root runner read check passed')"
ENTRYPOINT ["node","/opt/runner/harness.mjs"]
