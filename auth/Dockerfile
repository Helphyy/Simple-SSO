# ── Build stage ──
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++ linux-headers
COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
RUN npx tsc

# ── Test stage ──
# Ne fait pas partie de la stack prod. À lancer avec :
#   docker build --target test -t auth-test ./auth && docker run --rm auth-test
FROM build AS test
COPY test ./test
CMD ["npm", "test"]

# ── Runtime stage ──
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# On copie node_modules du build stage pour ne pas recompiler les natifs
COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Prune devDependencies
RUN npm prune --omit=dev --no-audit --no-fund

# User non-root
RUN addgroup -S app && adduser -S app -G app && \
    mkdir -p /app/data && chown -R app:app /app
USER app

EXPOSE 4000
VOLUME ["/app/data"]

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:4000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
