# Shared base for every image.
FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    TURBO_TELEMETRY_DISABLED=1
RUN npm install -g npm@11.19.1 --no-audit --no-fund

WORKDIR /app

# Copy manifests before source so dependency installs stay cached when only
# application code changes.
FROM base AS manifests
COPY package.json package-lock.json ./
COPY apps/api-gateway/package.json apps/api-gateway/
COPY apps/attendence/package.json apps/attendence/
COPY apps/identity/package.json apps/identity/
COPY apps/notification/package.json apps/notification/
COPY apps/web/package.json apps/web/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/types/package.json packages/types/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/ui/package.json packages/ui/

# Full dependency tree, including the dev tools needed for builds.
FROM manifests AS deps
RUN npm ci --no-audit --no-fund

FROM deps AS source
ENV CI=true
COPY . .

# Each app is built in its own stage. The trailing "..." tells Turbo to build
# workspace dependencies such as @repo/types first.
FROM source AS build-api-gateway
RUN ./node_modules/.bin/turbo run build --filter=./apps/api-gateway... --ui=stream

FROM source AS build-attendence
RUN ./node_modules/.bin/turbo run build --filter=./apps/attendence... --ui=stream

FROM source AS build-identity
RUN ./node_modules/.bin/turbo run build --filter=./apps/identity... --ui=stream

FROM source AS build-notification
RUN ./node_modules/.bin/turbo run build --filter=./apps/notification... --ui=stream

FROM source AS build-web
ARG GATEWAY_INTERNAL_URL=http://api-gateway:3001
ENV GATEWAY_INTERNAL_URL=$GATEWAY_INTERNAL_URL
RUN ./node_modules/.bin/turbo run build --filter=./apps/web... --ui=stream

# Production-only dependencies, scoped per service so the web toolchain is not
# shipped inside the Nest images.
FROM manifests AS prod-deps-api-gateway
RUN npm ci --omit=dev --workspace=api-gateway --include-workspace-root --no-audit --no-fund

FROM manifests AS prod-deps-attendence
RUN npm ci --omit=dev --workspace=attendence --include-workspace-root --no-audit --no-fund

FROM manifests AS prod-deps-identity
RUN npm ci --omit=dev --workspace=identity --include-workspace-root --no-audit --no-fund

FROM manifests AS prod-deps-notification
RUN npm ci --omit=dev --workspace=notification --include-workspace-root --no-audit --no-fund

# Shared runtime filesystem for the Nest services.
FROM base AS nest-runtime
ENV NODE_ENV=production
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node

FROM nest-runtime AS api-gateway
COPY --from=prod-deps-api-gateway --chown=node:node /app/node_modules ./node_modules
COPY --from=build-api-gateway --chown=node:node /app/apps/api-gateway/package.json ./apps/api-gateway/package.json
COPY --from=build-api-gateway --chown=node:node /app/apps/api-gateway/dist ./apps/api-gateway/dist
COPY --from=build-api-gateway --chown=node:node /app/packages/types/package.json ./packages/types/package.json
COPY --from=build-api-gateway --chown=node:node /app/packages/types/dist ./packages/types/dist
ENV PORT=3001
EXPOSE 3001
CMD ["node", "apps/api-gateway/dist/main.js"]

FROM nest-runtime AS attendence
COPY --from=prod-deps-attendence --chown=node:node /app/node_modules ./node_modules
COPY --from=build-attendence --chown=node:node /app/apps/attendence/package.json ./apps/attendence/package.json
COPY --from=build-attendence --chown=node:node /app/apps/attendence/dist ./apps/attendence/dist
COPY --from=build-attendence --chown=node:node /app/packages/types/package.json ./packages/types/package.json
COPY --from=build-attendence --chown=node:node /app/packages/types/dist ./packages/types/dist
ENV PORT=3003 \
    ATTENDENCE_UPLOAD_DIR=/app/uploads
EXPOSE 3003
CMD ["node", "apps/attendence/dist/main.js"]

FROM nest-runtime AS identity
COPY --from=prod-deps-identity --chown=node:node /app/node_modules ./node_modules
COPY --from=build-identity --chown=node:node /app/apps/identity/package.json ./apps/identity/package.json
COPY --from=build-identity --chown=node:node /app/apps/identity/dist ./apps/identity/dist
COPY --from=build-identity --chown=node:node /app/packages/types/package.json ./packages/types/package.json
COPY --from=build-identity --chown=node:node /app/packages/types/dist ./packages/types/dist
ENV PORT=3002
EXPOSE 3002
CMD ["node", "apps/identity/dist/main.js"]

FROM nest-runtime AS notification
COPY --from=prod-deps-notification --chown=node:node /app/node_modules ./node_modules
COPY --from=build-notification --chown=node:node /app/apps/notification/package.json ./apps/notification/package.json
COPY --from=build-notification --chown=node:node /app/apps/notification/dist ./apps/notification/dist
COPY --from=build-notification --chown=node:node /app/packages/types/package.json ./packages/types/package.json
COPY --from=build-notification --chown=node:node /app/packages/types/dist ./packages/types/dist
ENV PORT=3004
EXPOSE 3004
CMD ["node", "apps/notification/dist/main.js"]

# Next.js standalone runtime. The standalone bundle already contains the
# traced node_modules, so no dependency install is needed in this stage.
FROM base AS web
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build-web --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build-web --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build-web --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
