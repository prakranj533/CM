FROM node:22-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY . .
RUN npm run build -w @career-maps/core
RUN npm run build -w @career-maps/api

FROM node:22-bookworm-slim AS runtime
WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/package.json ./package.json
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/packages/core/package.json ./packages/core/package.json
COPY --from=build /workspace/packages/core/dist ./packages/core/dist
COPY --from=build /workspace/packages/core/data ./packages/core/data
CMD ["node", "apps/api/dist/index.js"]
