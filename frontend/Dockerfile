FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production: serve with Nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config: route all requests to index.html for SPA routing
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    location /api/ {\n\
        proxy_pass http://api:8000;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
    }\n\
    location /ws/ {\n\
        proxy_pass http://api:8000;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Upgrade $http_upgrade;\n\
        proxy_set_header Connection "upgrade";\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
