# syntax=docker/dockerfile:1.7
# Bot Boss — web container (static bundle served by nginx).
# Build context should be the repo root so we can pull in ../shared.
#   docker build -t botboss-web -f web/Dockerfile .

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY web/package.json web/pnpm-lock.yaml* ./web/
RUN cd web && pnpm install --frozen-lockfile || pnpm install

COPY shared ./shared
COPY web ./web
RUN cd web && pnpm build

FROM nginx:alpine AS runtime
COPY --from=build /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost/ > /dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
