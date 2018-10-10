FROM node:8-slim
MAINTAINER Roy Meissner <meissner@informatik.uni-leipzig.de>

ARG BUILD_ENV=local
ENV BUILD_ENV ${BUILD_ENV}

RUN mkdir /nodeApp
WORKDIR /nodeApp

# --------------------- #
#   Installation Cron   #
# --------------------- #

RUN apt-get update
RUN apt-get install -y cron supervisor

# --------------------------- #
#   Installation Custom App   #
# --------------------------- #

RUN apt-get install -y imagemagick coreutils bzip2 libfontconfig libfreetype6
# installing chrome headless deps (puppeteer)
RUN apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget

ADD ./application/ ./

RUN if [ "$BUILD_ENV" = "travis" ] ; then npm prune --production ; else rm -R node_modules ; npm install --production ; fi

# ---------------------- #
#   Configuration Cron   #
# ---------------------- #

RUN mkdir -p /var/log/supervisor && touch /var/log/cron.log

ADD supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Add crontab file in the cron directory
ADD crontab /etc/cron.d/simple-cron
ADD application/cleanup.sh /cleanup.sh

RUN chmod +x /cleanup.sh && chmod 0644 /etc/cron.d/simple-cron

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

Entrypoint []
CMD supervisord
