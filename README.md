# AgentDeps

Project-scoped modular dependency management for Codex/OMX agent environments.

AgentDeps lets a repository declare the skills, agents, prompts, MCP servers, and setup rules it needs, then generates an isolated project-local runtime. The goal is to keep new projects light while allowing larger projects to opt into richer agent capabilities when needed.

- Product name: **AgentDeps**
- CLI alias: **`mad`** = Modular Agent Dependencies
- License: MIT

## Example

```bash
mad init
mad add ios-swift tuist
mad install --profile ios
mad doctor --profile ios
mad run --profile ios -- codex
```

## Safety defaults

- no global `~/.codex` mutation by default;
- generated runtime lives under `.agentdeps/runtime/<profile>`;
- setup scripts are disabled by default;
- remote registry support is deferred until the local prototype is proven;
- `mad doctor` should explain active modules, warnings, and generated paths.

## Current status

Design/prototype stage. The next milestone is a minimal local CLI that can initialize a manifest, generate profile-specific runtimes, run doctor checks, and launch a command with the generated runtime.

## Design docs

- [`docs/DESIGN_PROPOSAL.md`](docs/DESIGN_PROPOSAL.md)
- [`docs/AGENT_SETUP_CONTRACT.md`](docs/AGENT_SETUP_CONTRACT.md)
- [`docs/SELF_CRITIQUE.md`](docs/SELF_CRITIQUE.md)
- [`docs/NEXT_IMPLEMENTATION_PLAN.md`](docs/NEXT_IMPLEMENTATION_PLAN.md)
- [`docs/OSS_RELEASE_STRATEGY.md`](docs/OSS_RELEASE_STRATEGY.md)
- [`examples/agentdeps.toml`](examples/agentdeps.toml)
