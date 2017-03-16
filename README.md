# file-service #
[![Build Status](https://travis-ci.org/slidewiki/file-service.svg?branch=master)](https://travis-ci.org/slidewiki/file-service)
[![License](https://img.shields.io/badge/License-MPL%202.0-green.svg)](https://github.com/slidewiki/file-service/blob/master/LICENSE)
[![Language](https://img.shields.io/badge/Language-Javascript%20ECMA2015-lightgrey.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Framework](https://img.shields.io/badge/Framework-NodeJS%206.7.0-blue.svg)](https://nodejs.org/)
[![Webserver](https://img.shields.io/badge/Webserver-Hapi%2014.1.0-blue.svg)](http://hapijs.com/)
[![LinesOfCode](https://img.shields.io/badge/LOC-0-lightgrey.svg)](https://github.com/slidewiki/file-service/blob/master/application/package.json)
[![Coverage Status](https://coveralls.io/repos/github/slidewiki/file-service/badge.svg?branch=master)](https://coveralls.io/github/slidewiki/file-service?branch=master)

### Service ###
This service stores and serves media files (pictures, audio, videos) and their metadata by their names.
Currently, it just offers methods for pictures.

### Preliminaries ###

Linux Dependencies:
- imagemagick
- sha256 (coreutils)

We assume a ext4 filesystem or at least a filesystem with no restriction for the number of files per folder.
The service uses /tmp as a directory for temporary files. It can be speeded up massivly by having /tmp as a directory that lives in RAM. See [Tmpfs](https://wiki.archlinux.org/index.php/Tmpfs) for imformation about filesystem transfer into RAM.

### Configuration ###
The environment variable APPLICATION_PATH defines which folder is used to store and serve media files.

## Migrate thumbnails ##
```
cd /data/files
find ./ -name thumbnails -type d -exec find {} -name *.png \; > list
while read in; do cp "$in" /data/files/slideThumbnails/ ; done < list
cd slideThumbnails
for i in *.png ; do convert "$i" "${i%.*}.jpeg" ; done
find . -name "*.png" -type f -delete
```

