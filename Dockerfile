# syntax=docker/dockerfile:1

# ---- 1. dependencies (cached separately from source changes)
FROM node:22-alpine AS install
WORKDIR /srv
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

# ---- 2. production build -> .next/standalone
FROM node:22-alpine AS compile
WORKDIR /srv
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=install /srv/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- 3. minimal runtime, unprivileged user
FROM node:22-alpine
WORKDIR /srv
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 vendorlens && adduser -S -u 1001 -G vendorlens vendorlens
COPY --from=compile --chown=vendorlens:vendorlens /srv/.next/standalone ./
COPY --from=compile --chown=vendorlens:vendorlens /srv/.next/static ./.next/static
USER vendorlens
EXPOSE 8080
CMD ["node", "server.js"]
