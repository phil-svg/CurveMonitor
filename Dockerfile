# Use an official Node.js runtime as a base image
FROM node:20.1.0

# Set the working directory in the container to /usr/src/app
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install any needed packages specified in package.json
RUN npm install

# Copy all necessary source files into the Docker image
COPY . .

# Run the TypeScript Compiler to build the project
RUN npm run build

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Define the command to run the app
CMD ["node", "dist/App.js"]