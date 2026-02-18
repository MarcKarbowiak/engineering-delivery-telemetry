FROM node:20-bookworm-slim
WORKDIR /app

COPY package.json ./
COPY tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/event-model/package.json packages/event-model/package.json
COPY packages/dora-engine/package.json packages/dora-engine/package.json
COPY packages/reporting-engine/package.json packages/reporting-engine/package.json
COPY packages/storage-sqlite/package.json packages/storage-sqlite/package.json

RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@apps/api"]