#!/bin/sh

# pull the latest changes from your repository
git pull

# build the Docker image
docker build -t curvemonitor .

# check if the container already exists
if [ $(docker ps -a -q -f name=curvemonitor-container) ]; then
    # stop and remove the existing container if it exists
    docker stop curvemonitor-container
    docker rm curvemonitor-container
fi

# run the new Docker image
docker run --name curvemonitor-container --network some-network -p 3000:3000 -d --env-file .env curvemonitor

# view the application logs
docker logs -f curvemonitor-container
