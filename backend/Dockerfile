FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY prisma/ ./prisma/
COPY .env.example ./
COPY entrypoint.sh ./

# Generate Prisma client
RUN npx prisma generate

# Make entrypoint script executable
RUN chmod +x entrypoint.sh

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the application with entrypoint
ENTRYPOINT ["./entrypoint.sh"]
CMD ["npm", "start"]

