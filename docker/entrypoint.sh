#!/bin/sh

set -eux

node ./node_modules/.bin/sequelize db:migrate

node ./build/
