# pull the latest changes from your repository
git pull

# build the Docker image
docker build -t curvemonitor .

# stop and remove the existing container
docker stop curvemonitor-container
docker rm curvemonitor-container

# run the new Docker image
docker run --name curvemonitor-container --network some-network -p 3000:3000 -d --env-file .env curvemonitor

# view the application logs
docker logs -f curvemonitor-container