# syntax=docker/dockerfile:1

# --- Build: web app + server bundle ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY web/package.json web/
COPY server/package.json server/
RUN npm ci
COPY shared shared
COPY web web
COPY server server
RUN npm -w web run build && npm -w server run build

# --- Run: one Node process serving the API and the web app ---
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data \
    STATIC_DIR=/app/public \
    TRUST_PROXY=1
WORKDIR /app
COPY --from=build /app/server/dist/server.js ./server.js
COPY --from=build /app/web/dist ./public
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8787
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
