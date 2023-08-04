#!make
#----------------------------------------
# Settings
#----------------------------------------
.DEFAULT_GOAL := help
#--------------------------------------------------
# Targets
#--------------------------------------------------
setup-hooks: ## Configures path to git hooks
	@git config core.hooksPath .githooks
help: ## Shows available targets
	@fgrep -h "## " $(MAKEFILE_LIST) | fgrep -v fgrep | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-13s\033[0m %s\n", $$1, $$2}'
