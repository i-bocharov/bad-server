FROM node:24-alpine
RUN mkdir /app
WORKDIR /app
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN corepack enable
RUN pnpm install --frozen-lockfile
COPY . .
CMD ["npm", "run", "dev"]
