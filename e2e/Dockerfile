# Build context: repository root. The image tag must match @playwright/test in e2e/package.json.
FROM mcr.microsoft.com/playwright:v1.49.0-jammy
WORKDIR /e2e
COPY e2e/package.json e2e/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY e2e/ ./
CMD ["npx", "playwright", "test"]
