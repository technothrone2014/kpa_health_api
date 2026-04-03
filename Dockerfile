# kpa_health_api/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production
RUN npm install -g ts-node typescript

# Copy source code
COPY src ./src

# Expose port
EXPOSE 8080

# Start the server
CMD ["npm", "run", "dev"]