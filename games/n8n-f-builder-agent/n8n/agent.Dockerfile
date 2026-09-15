# اپ Next.js (Automation Builder Agent) + Codex CLI
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL=postgresql://postgres:postgres@postgres:5432/agent
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Codex CLI برای حالت codex-cli (احراز هویت از volume مشترک /home/node/.codex خوانده می‌شود)
RUN npm install -g @openai/codex && apk add --no-cache bash git
COPY --from=build /app ./
USER node
EXPOSE 3000
# اعمال اسکیما و اجرای سرور
CMD ["sh", "-c", "npx drizzle-kit push --force && npm run start"]
