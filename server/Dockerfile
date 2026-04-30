FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy source
COPY . .

# Create drizzle dir if it doesn't exist (migrations generated at runtime)
RUN mkdir -p drizzle

# Build TypeScript
RUN npm run build

# Production image
FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/drizzle ./drizzle
COPY --from=base /app/public ./public

EXPOSE 3000
CMD ["node", "dist/index.js"]
