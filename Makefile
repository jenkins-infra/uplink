# Root Makefile to make the building and testing of this project easier
# regardless of *nix based platform
PATH:=$(PWD)/tools:$(PATH)
TSC=$(PWD)/node_modules/typescript/bin/tsc
JEST=$(PWD)/node_modules/jest/bin/jest.js
SEQUELIZE=$(PWD)/node_modules/sequelize-cli/lib/sequelize
COMPOSE:=./tools/docker-compose
IMAGE_NAME=jenkinsciinfra/uplink
IMAGE_TAG:=$(shell git rev-parse HEAD)

JEST_ARGS=--runInBand --bail --forceExit --detectOpenHandles


all: build check container

container: Dockerfile depends
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .
	docker tag $(IMAGE_NAME):$(IMAGE_TAG) $(IMAGE_NAME):latest

publish:
	docker push ${IMAGE_NAME}:$(IMAGE_TAG)
	docker push $(IMAGE_NAME):latest

depends: package.json package-lock.json
	if [ ! -d node_modules ]; then npm install; fi;

build: depends
	$(TSC)

check: build depends migrate
	# Running with docker-compose since our tests require a database to be
	# present
	$(COMPOSE) run --rm \
		-e NODE_ENV=test \
		node \
		/usr/local/bin/node $(JEST) $(JEST_ARGS)

clean:
	$(COMPOSE) down || true
	rm -rf node_modules

debug-jest:
	node --inspect-brk=0.0.0.0:9229 $(JEST)

debug-db:
	$(COMPOSE) run --rm db psql -h db -U postgres uplink_development

generate-event:
	curl -d '{"type":"stapler", "correlator" : "86e3f00d-b12a-4391-bbf2-6f01c1606e17", "payload" : {"timestamp" : "$(shell date)", "hi" : "there"}}' \
	    -H "Content-Type: application/json" \
	    http://localhost:3030/events

migrate: depends
	$(COMPOSE) up -d db
	@echo ">> waiting a moment to make sure the database comes online.."
	@sleep 3
	$(COMPOSE) run --rm node \
		/usr/local/bin/node $(SEQUELIZE) db:migrate && \
	$(COMPOSE) run --rm node \
		/usr/local/bin/node $(SEQUELIZE) db:seed:all

watch: migrate
	# Running with docker-compose since our tests require a database to be
	# present
	$(COMPOSE) run --rm \
		-e NODE_ENV=test \
		node \
		/usr/local/bin/node $(JEST) $(JEST_ARGS) --watch --coverage=false

watch-compile:
	$(TSC) -w

run: build
	@echo ">> Make sure you run migrations first!"
	@sleep 1
	$(COMPOSE) up

.PHONY: all depends build clean check watch run

# vim: set et
