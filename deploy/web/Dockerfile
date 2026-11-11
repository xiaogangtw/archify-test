FROM node:24-bookworm-slim AS build
WORKDIR /build/apps/web
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web/ ./
COPY services/control-api/src/llmTimeouts.json /build/services/control-api/src/llmTimeouts.json
COPY services/android/flow-guide.json /build/services/android/flow-guide.json
RUN npm run build

FROM nginx:stable-alpine
COPY deploy/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
