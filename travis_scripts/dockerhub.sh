#!/bin/bash

docker login -u="$DOCKER_USERNAME" -p="$DOCKER_PASSWORD"
docker build -t slidewiki/fileservice:latest-dev ./
docker push slidewiki/fileservice:latest-dev
