FROM node:20-slim

# Node backend also shells out to git (repo cloning) and semgrep (scanning),
# so both need to be present in the image alongside Node.
RUN apt-get update && apt-get install -y --no-install-recommends \
      git \
      python3 \
      python3-pip \
      curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages semgrep

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src ./src

ENV PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["node", "src/server.js"]
