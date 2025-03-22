# Use Node.js as the base image
FROM node:18

# Set the working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json yarn.lock ./
RUN yarn install

# Copy the rest of the application
COPY . .

# Build the TypeScript project
RUN yarn build  # <=== Ensure TypeScript compiles the project

# Expose the port
EXPOSE 3100

# Start the server
CMD ["node", "dist/server.js"]
