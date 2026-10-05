FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3010 HOSTNAME=0.0.0.0
RUN addgroup -S court && adduser -S court -G court
COPY --from=build --chown=court:court /app/.next/standalone ./
COPY --from=build --chown=court:court /app/.next/static ./.next/static
COPY --from=build --chown=court:court /app/public ./public
USER court
EXPOSE 3010
# One process/replica: state and simulated-execution idempotency are in memory.
CMD ["node", "server.js"]
