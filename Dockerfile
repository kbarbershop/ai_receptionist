# Use official Node.js LTS image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (using npm install since package-lock.json is not committed)
RUN npm install --only=production

# Copy source code
COPY src/ ./src/

# Expose port (Cloud Run will override this)
EXPOSE 8080

# Set environment to production
ENV NODE_ENV=production

# Run the application
CMD ["node", "src/app.js"]
