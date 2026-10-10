FROM node:24-slim AS web
WORKDIR /app
COPY . .
RUN npm ci -w @rply/web && npm run build -w @rply/web

FROM node:24-slim
WORKDIR /app
COPY . .
RUN npm ci --omit=dev -w @rply/server
COPY --from=web /app/apps/web/dist apps/web/dist
ENV NODE_ENV=production PORT=8080 RPLY_DB=/data/rply.db
RUN mkdir -p /data
EXPOSE 8080
CMD ["node", "packages/server/src/index.ts"]
