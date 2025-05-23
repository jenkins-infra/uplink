FROM node:22-alpine AS builder

RUN npm version

ARG APP_DIR=/srv/uplink
WORKDIR ${APP_DIR}

COPY package*json ${APP_DIR}/

RUN npm ci

# Doing a multi-stage build to reset some stuff for a smaller image
FROM node:22-alpine

ARG APP_DIR=/srv/uplink
WORKDIR ${APP_DIR}

COPY --from=builder ${APP_DIR} .

COPY build ${APP_DIR}/build
COPY migrations ${APP_DIR}/migrations
COPY config ${APP_DIR}/config
COPY public ${APP_DIR}/public
COPY views ${APP_DIR}/views
COPY .sequelizerc ${APP_DIR}/

EXPOSE 3030

# hadolint ignore=DL3025
CMD node ./node_modules/.bin/sequelize db:migrate || node ./build/
