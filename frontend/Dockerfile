# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Accept build-time env vars for Vite
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_INVENTORY_API_URL
# Standalone build: boot straight into the accelerator with no login. Defaults on here.
ARG VITE_STANDALONE_ACCELERATOR=true
# Write .env.production so Vite picks up whichever are provided
RUN { \
      [ -n "$VITE_API_URL" ] && echo "VITE_API_URL=$VITE_API_URL"; \
      [ -n "$VITE_GOOGLE_CLIENT_ID" ] && echo "VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID"; \
      [ -n "$VITE_INVENTORY_API_URL" ] && echo "VITE_INVENTORY_API_URL=$VITE_INVENTORY_API_URL"; \
      [ -n "$VITE_STANDALONE_ACCELERATOR" ] && echo "VITE_STANDALONE_ACCELERATOR=$VITE_STANDALONE_ACCELERATOR"; \
      true; \
    } > .env.production
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
