FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY server/package.json ./
RUN npm install --production

# Copy server and frontend
COPY server/index.js ./
COPY public/ ./public/

# SQLite data lives here — mount a volume at this path to persist it
RUN mkdir -p /data
ENV DB_PATH=/data/cards.db
ENV PORT=3000

EXPOSE 3000

CMD ["node", "index.js"]
