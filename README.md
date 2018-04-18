# file-service #
[![Build Status](https://travis-ci.org/slidewiki/file-service.svg?branch=master)](https://travis-ci.org/slidewiki/file-service)
[![License](https://img.shields.io/badge/License-MPL%202.0-green.svg)](https://github.com/slidewiki/file-service/blob/master/LICENSE)
[![Language](https://img.shields.io/badge/Language-Javascript%20ECMA2017-lightgrey.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Framework](https://img.shields.io/badge/Framework-NodeJS%208.11.0-blue.svg)](https://nodejs.org/)
[![Webserver](https://img.shields.io/badge/Webserver-Hapi%2016.4.0-blue.svg)](http://hapijs.com/)
[![Coverage Status](https://coveralls.io/repos/github/slidewiki/file-service/badge.svg?branch=master)](https://coveralls.io/github/slidewiki/file-service?branch=master)
### Service ###
This service stores serves and creates media files (pictures, audio, videos). It also provides some metadata about uploaded pictures.
Currently, it only supports pictures.

### Preliminaries ###

Main Linux Dependencies (have a look at the Dockerfile for a complete list):
- imagemagick
- sha256 (coreutils)
- several xserver packages

We assume an ext4 filesystem or at least a filesystem with no restriction for the number of files per folder.
The service uses /tmp as a directory for temporary files. It can be speeded up massivly by having /tmp as a directory that lives in RAM. See [Tmpfs](https://wiki.archlinux.org/index.php/Tmpfs) for imformation about filesystem transfer into RAM.

### Configuration ###
The environment variable APPLICATION_PATH defines which folder is used to store and serve media files.
There are other environment variables. Have a look at the Docker-Compose file for a complete listing. Some functionality needs URIs of different other SlideWiki services to work correctly.

## Migrate thumbnails from SlideWiki 1.0 ##
```
cd /data/files
find ./ -name thumbnails -type d -exec find {} -name *.png \; > list
while read in; do cp "$in" /data/files/slideThumbnails/ ; done < list
cd slideThumbnails
for i in *.png ; do convert "$i" "${i%.*}.jpeg" ; done
find . -name "*.png" -type f -delete
```

## Migrate to new and better thumbnail creation in SlideWiki 2.0 (18.04) ##
```
cd /data/files/slideThumbnails
#remove all thumbnails
rm -Rf ./*
```
All thumbnails will be recreated automatically on first usage/request of the thumbnail with the new system.
