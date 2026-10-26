#!/bin/sh
# Chạy lúc container khởi động (nginx /docker-entrypoint.d): thay __HUB_URL__ trong index.html bằng biến HUB_URL
sed -i "s|__HUB_URL__|${HUB_URL}|g" /usr/share/nginx/html/index.html
