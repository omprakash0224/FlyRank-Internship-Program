FROM node:20-alpine

WORKDIR /app

# Install ALL dependencies first (prisma CLI is a devDep — needed for generate)
COPY package*.json ./
RUN npm ci

# Copy Prisma schema and generate client (requires prisma CLI from devDeps)
COPY prisma ./prisma
RUN npx prisma generate

# Prune devDependencies to keep the final image lean
RUN npm prune --omit=dev

# Copy source
COPY src ./src

EXPOSE 3000

CMD ["node", "src/index.js"]
