FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile
COPY apps apps
COPY packages/shared packages/shared
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN corepack enable
COPY --from=build /workspace/package.json /workspace/pnpm-workspace.yaml /workspace/pnpm-lock.yaml ./
COPY --from=build /workspace/apps/api/package.json apps/api/package.json
COPY --from=build /workspace/apps/api/dist apps/api/dist
COPY --from=build /workspace/packages/shared/dist packages/shared/dist
RUN pnpm install --prod --frozen-lockfile
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
CMD ["pnpm", "--filter", "@grouppilot/api", "start"]
