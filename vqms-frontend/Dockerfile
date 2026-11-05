# Build stage
FROM node:22.12.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Empty = the browser calls same-origin /api, which nginx forwards to the gateway.
ARG VITE_API_GATEWAY_URL=
ENV VITE_API_GATEWAY_URL=$VITE_API_GATEWAY_URL
RUN npm run build

# Runtime stage: static files + /api reverse proxy to the API Gateway
FROM nginx:1.27.3-alpine
ENV API_GATEWAY_URL=http://gateway-service:8080
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
