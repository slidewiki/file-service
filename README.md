# file-service #
[![Build Status](https://travis-ci.org/slidewiki/file-service.svg?branch=master)](https://travis-ci.org/slidewiki/file-service)
[![License](https://img.shields.io/badge/License-MPL%202.0-green.svg)](https://github.com/slidewiki/file-service/blob/master/LICENSE)
[![Language](https://img.shields.io/badge/Language-Javascript%20ECMA2015-lightgrey.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Framework](https://img.shields.io/badge/Framework-NodeJS%206.4.0-blue.svg)](https://nodejs.org/)
[![Webserver](https://img.shields.io/badge/Webserver-Hapi%2014.1.0-blue.svg)](http://hapijs.com/)
[![LinesOfCode](https://img.shields.io/badge/LOC-0-lightgrey.svg)](https://github.com/slidewiki/file-service/blob/master/application/package.json)
[![Coverage Status](https://coveralls.io/repos/github/slidewiki/file-service/badge.svg?branch=master)](https://coveralls.io/github/slidewiki/file-service?branch=master)

### Service ###
This service just serves files from a given path (APPLICATION_PATH) by their names.
It will be deployed under fileservice.manfredfris.ch

### Details ###
With the environment variable APPLICATION_PATH the path for the service is determined.
As this service should use the files of the host machine, the docker-compose file maps a host directory (at the moment /data/files) to APPLICATION_PATH directory inside the container (with read only).
The concrete directories should be adopted for deployment.

### Integrity with other services ###
The input for this host directory should be the import-service.
The import-service should store the images on this directory (e.g. /data/files) (also via a volume).
As the import-service uses base64 from HTML as source for creating the files, the filenames should be inserted into to HTML after saving the files.
Also the import-service have to ensure that filenames are distinct.

#### Proposal for a shared directory ####
**Based on [docker-compose docs](https://docs.docker.com/engine/tutorials/dockervolumes/#/creating-and-mounting-a-data-volume-container)**

We will have a container which just contains one volume (which will be shared):
`docker create -v /data/files:/data/files --name volume_share training/postgres /bin/true`

Now the other containers (like file-service and import-service) are linked to the volume of the "volume_share" container.
In order to do this adopt the lines in [docker-compose.yml](https://github.com/slidewiki/file-service/blob/master/docker-compose.yml).
If the mapped host directory has the correct rights and file-service and import-service are privileged, they are able to share one directory in real-time (via a shared volume).
