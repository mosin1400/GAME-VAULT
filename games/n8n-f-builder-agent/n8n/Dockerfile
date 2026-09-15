# ==========================================================
# n8n + نودهای سفارشی (Bale, BaleTrigger, WorkflowBuilder)
#     + پکیج Codex Chat Model (@chrishdx/n8n-nodes-codex-cli-lm)
#     + Codex CLI (برای احراز هویت با اشتراک ChatGPT شما)
# ==========================================================
ARG N8N_VERSION=latest
FROM n8nio/n8n:${N8N_VERSION} AS base

USER root

# ابزارهای مورد نیاز برای بیلد نودهای TypeScript و اجرای Codex CLI
RUN apk add --no-cache git bash curl

# --- Codex CLI (اشتراک ChatGPT / Codex کاربر) ---
RUN npm install -g @openai/codex

# --- پکیج Codex Chat Model برای n8n ---
RUN mkdir -p /home/node/.n8n/nodes \
 && cd /home/node/.n8n/nodes \
 && npm init -y >/dev/null \
 && npm install @chrishdx/n8n-nodes-codex-cli-lm

# --- نودهای سفارشی این پروژه: بیلد و نصب به‌عنوان community package محلی ---
COPY custom-nodes /tmp/n8n-nodes-bale
RUN cd /tmp/n8n-nodes-bale \
 && npm install --no-audit --no-fund \
 && npm run build \
 && npm pack --silent \
 && cd /home/node/.n8n/nodes \
 && npm install /tmp/n8n-nodes-bale/n8n-nodes-bale-1.0.0.tgz \
 && rm -rf /tmp/n8n-nodes-bale

RUN chown -R node:node /home/node/.n8n
USER node

# n8n نودهای community را از این مسیر بارگذاری می‌کند
ENV N8N_COMMUNITY_PACKAGES_ENABLED=true
ENV N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
