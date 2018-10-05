#!/bin/bash

#reconstruct path to videos
path=''
if [ -z ${APPLICATION_PATH} ]; then
  path=$PWD
else
  path=$APPLICATION_PATH
fi

if [[ $path != */ ]]; then
  path="$path/"
fi

path="${path}videos/"

#get a list of all videos that are older than 8 weeks and delete these
find $path -maxdepth 1 -type f -mtime +56 -name "*.mp4" -delete;
