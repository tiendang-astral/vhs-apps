FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# --legacy-peer-deps: react-scripts 5 xung đột peer với typescript 5
RUN npm ci --legacy-peer-deps
COPY . .
# CRA nhúng URL API vào lúc build, không đổi được lúc chạy
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY hub-url.sh /docker-entrypoint.d/90-hub-url.sh
