FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# --legacy-peer-deps: react-scripts 5 xung đột peer với typescript 5
# Cache /root/.npm giữa các lần build + retry: mạng VPS hay đứt (ECONNRESET), build lại chỉ tải phần còn thiếu
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps --no-audit --no-fund \
      --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000
COPY . .
# CRA nhúng URL API vào lúc build, không đổi được lúc chạy
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY hub-url.sh /docker-entrypoint.d/90-hub-url.sh
