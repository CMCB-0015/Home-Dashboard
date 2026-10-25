# Home Assistant builds this on the Lenovo when you install or update the app.
# It downloads the latest code from GitHub, builds it, and runs the dashboard server.

FROM node:22-alpine AS build
ARG REPO_URL
ARG REPO_BRANCH=main
# Home Assistant passes the app version; using it here makes every new version
# download fresh code instead of reusing the last copy.
ARG BUILD_VERSION
RUN apk add --no-cache git
WORKDIR /src
RUN echo "Building Panel ${BUILD_VERSION}" \
 && git clone --depth 1 --branch "${REPO_BRANCH}" "${REPO_URL}" . \
 && npm ci --no-audit --no-fund \
 && npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /src/dist ./dist
COPY --from=build /src/dist-server ./dist-server
ENV NODE_ENV=production PANEL_DIST=/app/dist PANEL_PORT=8099
EXPOSE 8099
CMD ["node", "dist-server/index.mjs"]
