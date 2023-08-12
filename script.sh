#!/bin/sh

# pull the latest changes from your repository
git pull

# function to manage the docker containers
handle_container() {
    local image_name="$1"
    local container_name="$2"
    local port_mapping="$3"
    local additional_args="${4:-}"

    # build the Docker image
    docker build -t "$image_name" .

    # check if the container already exists
    existing_container=$(docker ps -a -q -f name="$container_name")

    if [ -n "$existing_container" ]; then
        # stop and remove the existing container if it exists
        docker stop "$container_name"
        docker rm "$container_name"
    fi

    # run the new Docker image
    docker run -d --restart on-failure --network some-network --name "$container_name" "$port_mapping" $additional_args "$image_name"

    # view the application logs
    docker logs -f "$container_name"
}

# Handle curvemonitor-container
handle_container "curvemonitor" "curvemonitor-container" "-p 8443:443" "--env-file .env -v /etc/letsencrypt/live/api.curvemonitor.com/fullchain.pem:/usr/src/app/fullchain.pem -v /etc/letsencrypt/live/api.curvemonitor.com/privkey.pem:/usr/src/app/privkey.pem"

# Handle some-postgres
# Assuming the image name is "postgres" for the some-postgres container, and no additional arguments or port mappings are needed
handle_container "postgres" "some-postgres" ""

