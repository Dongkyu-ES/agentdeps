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
mad agent apply --session --profile ios --enable tuist --disable app-release
mad run --profile ios -- codex
```

## Safety defaults

- no global `~/.codex` mutation by default;
- generated runtime lives under `.agentdeps/runtime/<profile>`;
- setup scripts are disabled by default;
- remote registry support is deferred until the local prototype is proven;
- `mad doctor` should explain active modules, warnings, and generated paths.


## Two control modes

AgentDeps should support both:

1. **Sealed runtime mode**: resolve modules before launch with `mad install` / `mad run`. This is deterministic and required for hard capabilities like MCP configuration.
2. **Live advisory toggle mode**: while already inside a running Codex/OMX session, an agent can record session intent, enable/disable soft capability routing as advisory state, regenerate future runtime files, and report what requires restart.

See [`docs/RUNTIME_TOGGLE_DESIGN.md`](docs/RUNTIME_TOGGLE_DESIGN.md).

## Current status

Prototype stage. The repository now includes a dependency-free Node.js MVP CLI that can initialize a manifest, generate profile-specific runtimes, run doctor checks, write live advisory session toggles, and launch a command with the generated runtime.

## Design docs

- [`docs/DESIGN_PROPOSAL.md`](docs/DESIGN_PROPOSAL.md)
- [`docs/AGENT_SETUP_CONTRACT.md`](docs/AGENT_SETUP_CONTRACT.md)
- [`docs/RUNTIME_TOGGLE_DESIGN.md`](docs/RUNTIME_TOGGLE_DESIGN.md)
- [`docs/SELF_CRITIQUE.md`](docs/SELF_CRITIQUE.md)
- [`docs/NEXT_IMPLEMENTATION_PLAN.md`](docs/NEXT_IMPLEMENTATION_PLAN.md)
- [`docs/OSS_RELEASE_STRATEGY.md`](docs/OSS_RELEASE_STRATEGY.md)
- [`examples/agentdeps.toml`](examples/agentdeps.toml)
