# FlowForge – Production image (Next.js standalone + tools for Bash/Python nodes)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL=postgresql://postgres:postgres@postgres:5432/flowforge
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
# ابزارهای لازم برای نودهای Bash/Python و healthcheck
RUN apk add --no-cache bash python3 curl wget jq git ca-certificates tzdata
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src/db ./src/db
COPY --from=build /app/drizzle.config.json ./
COPY --from=build /app/scripts ./scripts
RUN mkdir -p /files/inbox
EXPOSE 3000
# اعمال اسکیمای دیتابیس سپس اجرای سرور
CMD ["sh", "-c", "npx drizzle-kit push --force >/dev/null 2>&1 || true; npm run start"]
