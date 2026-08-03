# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install all deps (including devDeps needed for Vite build)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ─── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove the default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config (proxies /api/* to the backend)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
