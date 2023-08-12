#!/bin/sh

# Pull the latest changes from your repository
git pull

# Build the Docker image
docker build -t curvemonitor .

# Check if the application container already exists
existing_container=$(docker ps -a -q -f name=curvemonitor-container)
if [ -n "$existing_container" ]; then
    # Stop and remove the existing container if it exists
    docker stop curvemonitor-container
    docker rm curvemonitor-container
fi

# Check if the postgres container already exists
existing_postgres_container=$(docker ps -a -q -f name=some-postgres)
if [ -z "$existing_postgres_container" ]; then
    # Run the postgres container only if it doesn't exist, with a volume attached
    docker run -d --restart on-failure --network some-network --name some-postgres \
        -v 22b2c8f92e81601cd70a2610c88134e95b260c6506c445d1c94a17ebc9e555a0:/var/lib/postgresql/data \
        postgres:latest
else
    # Otherwise, just start the existing postgres container
    docker start some-postgres
fi

# Run the new Docker image for the application
docker run -d --restart on-failure --network some-network --name curvemonitor-container -p 8443:443 \
    --env-file .env \
    -v /etc/letsencrypt/live/api.curvemonitor.com/fullchain.pem:/usr/src/app/fullchain.pem \
    -v /etc/letsencrypt/live/api.curvemonitor.com/privkey.pem:/usr/src/app/privkey.pem \
    curvemonitor:latest

# View the application logs
docker logs -f curvemonitor-container
