# deps → dev (Vite dev server with HMR, used by docker-compose.dev.yml)
#      → build → nginx (default target: static bundle)
FROM node:22-alpine AS deps
WORKDIR /app
# package.json only: a lockfile made on Windows can miss Linux-only native bindings.
COPY package.json ./
RUN npm install --no-audit --no-fund

FROM deps AS dev
# Source is bind-mounted over /app at runtime; node_modules stays from the image.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "80"]

FROM deps AS build
COPY . .
ARG VITE_MAPBOX_TOKEN=""
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
