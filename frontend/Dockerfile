# Build the static bundle, then serve it with nginx.
FROM node:22-alpine AS build
WORKDIR /app
# package.json only: a lockfile made on Windows can miss Linux-only native bindings.
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
ARG VITE_MAPBOX_TOKEN=""
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
