# Use the official Node.js 20 as a parent image
FROM node:20

# Set the working directory in the container
WORKDIR /code

# Copy package.json and package-lock.json first for better layer caching
COPY package*.json ./

# Install dependencies in Linux environment (this will compile native modules for Linux)
RUN npm ci

# Copy the source code (excluding node_modules via .dockerignore)
COPY . .

# Build the TypeScript code
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose WebSocket port used by the runner
EXPOSE 3005

# Define the command to run your app
CMD [ "node", "dist/index.js" ]