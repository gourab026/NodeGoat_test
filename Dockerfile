FROM node:24-alpine AS dependencies
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /home/node/app
COPY --from=dependencies --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --chown=node:node . .
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e 'const http = require("http"); const req = http.get({host: "127.0.0.1", port: process.env.PORT || 4000, path: "/login"}, res => { res.resume(); process.exit(res.statusCode === 200 ? 0 : 1); }); req.on("error", () => process.exit(1)); req.setTimeout(4000, () => { req.destroy(); process.exit(1); });'
CMD ["node", "server.js"]
