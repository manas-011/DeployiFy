FROM node:20-alpine

# Install git
RUN apk add --no-cache git bash

# Set working directory
WORKDIR /home/app

# Copy package.json and package-lock.json first (for caching npm install)
COPY package*.json ./

# Install dependencies
RUN npm install

COPY main.sh main.sh
COPY script.js script.js

# Make scripts executable
RUN chmod +x main.sh script.js

ENTRYPOINT ["/home/app/main.sh"]
