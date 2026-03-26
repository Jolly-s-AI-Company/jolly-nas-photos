# Jolly NAS 照片视频备份 - ARM64 Docker镜像
FROM node:22-alpine

WORKDIR /app

# 复制package.json
COPY package.json package-lock.json* ./

# 安装依赖
RUN npm ci --omit=dev

# 复制源代码
COPY . .

# 创建存储目录
RUN mkdir -p /app/storage/photos /app/storage/videos

# 暴露端口
EXPOSE 30000

# 环境变量
# PORT: HTTP端口 (默认30000)
# STORAGE_PATH: 存储路径 (默认/app/storage)

# 启动命令
CMD ["node", "server.js"]
