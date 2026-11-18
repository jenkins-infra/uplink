NODE:=docker-compose run --rm -e NODE_ENV=test --entrypoint=node dev-uplink

JEST=node_modules/jest/bin/jest.js
SEQUELIZE=node_modules/sequelize-cli/lib/sequelize
JEST_ARGS=--runInBand --bail --forceExit --detectOpenHandles

# Cute hack thanks to:
# https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
help: ## Display this help text
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

all: build check

build: ## Build all assets (Compile TypeScript, Docker image, etc.)
	docker-compose build

check: build migrate ## Run all tests
	$(NODE) $(JEST) $(JEST_ARGS)

clean: ## Clean up
	docker-compose down -v --remove-orphans

debug-jest: ## Launch jest with debugger on port 9229
	$(NODE) --inspect-brk=0.0.0.0:9229 $(JEST)

debug-db:
	docker-compose run --rm --entrypoint=bash db -c 'psql --host=db --username=$$POSTGRES_USER --dbname=$$POSTGRES_DB'

generate-event: ## Send a sample event to a service running on localhost:3030
	curl -d '{"type":"stapler", "correlator" : "86e3f00d-b12a-4391-bbf2-6f01c1606e17", "payload" : {"timestamp" : "$(shell date)", "hi" : "there"}}' \
		-H "Content-Type: application/json" \
		http://localhost:3030/events

migrate: ## Run migrations against the local development database
	$(NODE) $(SEQUELIZE) db:migrate
	$(NODE) $(SEQUELIZE) db:seed:all

# TODO: Reimplement with https://docs.docker.com/compose/how-tos/file-watch/
watch: migrate ## Run the tests in "watch" mode
	$(NODE) $(JEST) $(JEST_ARGS) --watch --coverage=false

# TODO: Reimplement with https://docs.docker.com/compose/how-tos/file-watch/
watch-compile: ## Run the TypeScript compiler in "watch' mode
	$(NODE) node_modules/typescript/bin/tsc -w

run: ## Run the uplink service first
	docker-compose up --force-recreate --build --detach --wait dev-uplink
	docker-compose logs -f dev-uplink

shell: ## Spawn an interactive shell in the development containerized environment
	docker-compose exec -ti dev-uplink bash

run-prod: migrate ## Executer with the production setup
	docker-compose up --force-recreate --build --detach --wait uplink
	make generate-event
	docker-compose logs -f uplink

.PHONY: all build clean check help run watch watch-compile run-prod shell

# vim: set et
