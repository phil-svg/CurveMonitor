#!/bin/sh

# pull the latest changes from your repository
git pull

# build the Docker image
docker build -t curvemonitor .

# check if the container already exists
existing_container=$(docker ps -a -q -f name=curvemonitor-container)

if [ -n "$existing_container" ]; then
    # stop and remove the existing container if it exists
    docker stop curvemonitor-container
    docker rm curvemonitor-container
fi

# run the new Docker image
docker run -d --network some-network --name curvemonitor-container -p 8443:443 \
    --env-file .env \
    curvemonitor:latest

# view the application logs
docker logs -f curvemonitor-container
