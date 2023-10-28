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

# Cute hack thanks to:
# https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
help: ## Display this help text
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'


all: build check container

container: Dockerfile depends ## Build the Docker container
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .
	docker tag $(IMAGE_NAME):$(IMAGE_TAG) $(IMAGE_NAME):latest

publish: ## Publish the Docker container to docker hub
	docker push ${IMAGE_NAME}:$(IMAGE_TAG)
	docker push $(IMAGE_NAME):latest

version:
	npm version

depends: package.json package-lock.json ## Install node dependencies
	if [ ! -d node_modules ]; then npm ci; fi;

build: depends ## Compile TypeScript
	$(TSC)

check: build depends migrate ## Run all tests
	# Running with docker-compose since our tests require a database to be
	# present
	$(COMPOSE) run --rm \
		-e NODE_ENV=test \
		node \
		/usr/local/bin/node $(JEST) $(JEST_ARGS)

clean: ## Remove node_modules and clean up
	$(COMPOSE) down || true
	rm -rf node_modules

debug-jest: ## Launch jest with debugger on port 9229
	node --inspect-brk=0.0.0.0:9229 $(JEST)

debug-db:
	$(COMPOSE) run --rm db psql -h db -U postgres uplink_development

generate-event: ## Send a sample event to a service running on localhost:3030
	curl -d '{"type":"stapler", "correlator" : "86e3f00d-b12a-4391-bbf2-6f01c1606e17", "payload" : {"timestamp" : "$(shell date)", "hi" : "there"}}' \
	    -H "Content-Type: application/json" \
	    http://localhost:3030/events

migrate: depends ## Run migrations against the local development database
	$(COMPOSE) up -d db
	@echo ">> waiting a moment to make sure the database comes online.."
	@sleep 3
	$(COMPOSE) run --rm node \
		/usr/local/bin/node $(SEQUELIZE) db:migrate && \
	$(COMPOSE) run --rm node \
		/usr/local/bin/node $(SEQUELIZE) db:seed:all

watch: migrate ## Run the tests in "watch" mode
	# Running with docker-compose since our tests require a database to be
	# present
	$(COMPOSE) run --rm \
		-e NODE_ENV=test \
		node \
		/usr/local/bin/node $(JEST) $(JEST_ARGS) --watch --coverage=false

watch-compile: ## Run the TypeScript compiler in "watch' mode
	$(TSC) -w

run: build ## Run the uplink service first
	@echo ">> Make sure you run migrations first!"
	@sleep 1
	$(COMPOSE) up

.PHONY: all depends build clean check help run watch

# vim: set et
