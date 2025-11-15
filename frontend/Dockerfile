FROM node:24-alpine AS build
WORKDIR /app/frontend
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN corepack enable
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build
