FROM node:22 AS builder

RUN npm version

ARG APP_DIR=/srv/uplink
WORKDIR ${APP_DIR}

COPY package*json ${APP_DIR}/

RUN npm ci

COPY . ${APP_DIR}
RUN npm run build

# Doing a multi-stage build to reset some stuff for a smaller image
FROM node:22

ARG APP_DIR=/srv/uplink
WORKDIR ${APP_DIR}

# Dependencies
COPY --from=builder ${APP_DIR}/node_modules ${APP_DIR}/node_modules
# Generated NodeJS app
COPY --from=builder ${APP_DIR}/build ${APP_DIR}/build

# Webapp static files
COPY ./public ${APP_DIR}/public
COPY ./views ${APP_DIR}/views

# Sequelize setup: used for DB migrations when schema changes
COPY ./.sequelizerc ${APP_DIR}/.sequelizerc
COPY ./migrations ${APP_DIR}/migrations

# Configurations
COPY ./config/database.js ${APP_DIR}/config/database.js
COPY ./config/default.json ${APP_DIR}/config/default.json

COPY ./docker/entrypoint.sh /

EXPOSE 3030

ENTRYPOINT [ "/entrypoint.sh" ]
