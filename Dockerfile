FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci

COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/server/prisma.config.ts ./server/prisma.config.ts
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./server/public
COPY docker-entrypoint.sh ./docker-entrypoint.sh

WORKDIR /app/server
EXPOSE 5000

CMD ["sh", "../docker-entrypoint.sh"]
