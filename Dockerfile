FROM node:8-slim
MAINTAINER Roy Meissner <meissner@informatik.uni-leipzig.de>

ARG BUILD_ENV=local
ENV BUILD_ENV ${BUILD_ENV}

RUN mkdir /nodeApp
WORKDIR /nodeApp

# ---------------- #
#   Installation   #
# ---------------- #

RUN apt-get update && apt-get install -y imagemagick coreutils bzip2 libfontconfig libfreetype6

ADD ./application/ ./

RUN if [ "$BUILD_ENV" = "travis" ] ; then npm prune --production ; else rm -R node_modules ; npm install --production ; fi
# ----------------- #
#   Configuration   #
# ----------------- #

EXPOSE 80
VOLUME /data/files

# ----------- #
#   Cleanup   #
# ----------- #

RUN apt-get autoremove -y && apt-get -y clean && \
		rm -rf /var/lib/apt/lists/*

# -------- #
#   Run!   #
# -------- #

CMD npm start
