# Clip render service for Cloudflare Containers (or any Docker host).
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server.mjs .
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
