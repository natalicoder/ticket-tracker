# Build context: repository root
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

FROM deps AS build
ARG VITE_SHOW_MAILPIT_LINK=true
ARG VITE_MAILPIT_PORT=8025
ENV VITE_SHOW_MAILPIT_LINK=$VITE_SHOW_MAILPIT_LINK VITE_MAILPIT_PORT=$VITE_MAILPIT_PORT
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w apps/web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
