# AgentDeps Design Proposal

## 1. Problem

Codex/OMX environments are powerful but tend to become globally heavy:

- global skills accumulate;
- global agents accumulate;
- MCP servers become machine-wide even when only one project needs them;
- project onboarding becomes a tribal-memory task;
- agents can read `AGENTS.md`, but they are not given a deterministic capability setup contract.

This project proposes a modular dependency manager for agent capabilities, inspired by:

- **Tuist**: declare project structure and generate the working environment;
- **iOS dynamic frameworks**: attach only the capability bundles needed by the current target;
- **Melos**: bootstrap and coordinate multi-package/project workspaces;
- **Codex/AGENTS precedence**: project-local guidance can override broader/global guidance.

## 2. Product thesis

A repository should be able to declare its agent runtime the same way it declares package dependencies.

```text
agentdeps.toml + module registry + selected profile
  -> deterministic resolved runtime
  -> Codex/OMX runs with only the capabilities that project/profile needs
```

The first project can be light. A larger iOS architecture project can opt into Tuist, release, localization, QA, and design capabilities later.

## 3. Non-goals for MVP

MVP should **not** attempt to replace Codex internals.

Out of scope for v0:

- live hot-swapping MCP servers inside an already-running session;
- a remote public registry with trust guarantees;
- universal compatibility with every Codex surface;
- automatic execution of arbitrary setup scripts from remote modules;
- a complex plugin marketplace.

MVP should prove one thing:

> A project can declare capability modules and get a deterministic, isolated, agent-readable runtime.

## 4. Core concepts

### 4.1 Module

A module is a versioned bundle of agent capabilities.

```text
module/
  module.toml
  skills/
  agents/
  prompts/
  mcp.toml
  AGENTS.fragment.md
  templates/
  scripts/
  tests/
```

A module may contribute:

| Capability | Example |
| --- | --- |
| Skills | `ios-development`, `tuist-workflow`, `app-release` |
| Agents | `ios-agent`, `dependency-expert`, `test-engineer` |
| Prompts | role or workflow prompts |
| MCP config | `context7`, `filesystem`, `figma`, `linear` |
| AGENTS fragments | project-specific operating guidance |
| Templates | starter `Tuist/Project.swift`, PRD, release checklist |
| Scripts | optional setup/doctor commands |

### 4.2 Profile

A profile is a named capability set for a use case.

Examples:

- `light` — repo reading, basic coding, no heavy MCP;
- `ios` — Swift/iOS/Tuist architecture;
- `release` — Fastlane/App Store/localization;
- `design` — Figma/browser/visual QA;
- `infra` — Cloudflare/AWS/observability.

Profiles can extend other profiles.

### 4.3 Runtime

A runtime is the generated project-local Codex home.

```text
.agentdeps/runtime/ios/
  config.toml
  skills/
  agents/
  prompts/
  AGENTS.generated.md
  metadata.json
```

The CLI launches Codex/OMX with this runtime rather than mutating global state.

### 4.4 Lockfile

The lockfile records the exact resolved module graph.

```text
.agentdeps/agentdeps.lock.toml
```

It should include:

- module name/version/source;
- content hash;
- resolved profile;
- generated file hashes;
- MCP declarations;
- warnings and conflict resolutions.

## 5. Precedence model

The resolver must be deterministic and boring.

Recommended order, lowest to highest priority:

1. built-in defaults;
2. global user modules;
3. registry modules;
4. project `agentdeps.toml`;
5. selected profile overrides;
6. project-local `.agentdeps/overrides/*`;
7. manually written repository `AGENTS.md` instructions at runtime.

Rules:

- exact skill/agent name conflicts fail by default;
- a project may explicitly override a conflict with `replace = true`;
- MCP credentials are never stored in modules;
- modules may declare required environment variable names, not secret values;
- generated files include a header and should be reproducible.

## 5.5 Two control modes

AgentDeps supports two different surfaces:

1. **Sealed runtime mode**: `mad install` and `mad run` resolve capabilities before Codex/OMX starts. This is deterministic and required for hard capabilities such as MCP server configuration.
2. **Live advisory toggle mode**: when already inside a running session, the agent may update `.agentdeps/session.toml`, apply soft instruction/routing changes, regenerate future runtime files, and report which changes require restart.

This is specified in [`RUNTIME_TOGGLE_DESIGN.md`](RUNTIME_TOGGLE_DESIGN.md). README alone is not enough because agents need machine-readable current state.

## 6. CLI design

### 6.1 Basic commands

```bash
mad init                         # create agentdeps.toml and .agentdeps/
mad add ios-swift tuist          # add modules to a profile
mad remove tuist                 # remove module from profile
mad install                      # resolve modules and write lock/runtime
mad doctor                       # validate runtime, tools, env vars, conflicts
mad run --profile ios            # launch Codex/OMX with generated runtime
mad explain --profile ios        # show why each capability is present
mad graph                        # print module dependency graph
mad clean                        # remove generated runtime only
```

### 6.2 Agent-friendly commands

Agents need commands that are safe, obvious, and non-destructive.

```bash
mad agent status                 # concise current profile/runtime state
mad agent bootstrap              # install if missing, then doctor
mad agent handoff                # emit a compact summary for AGENTS.md or chat
mad agent repair --safe          # regenerate runtime without touching global config
```

These commands should avoid changing `~/.codex` unless explicitly requested.

## 7. Agent setup contract

Every project using AgentDeps should include a short `AGENTS.md` block:

```md
## AgentDeps

This project uses AgentDeps. Do not manually edit global `~/.codex` to satisfy project-local capability needs.

Before work:

1. Run `mad agent status`.
2. If runtime is missing or stale, run `mad agent bootstrap`.
3. Use the selected profile from `agentdeps.toml` unless the user asks otherwise.
4. If a module is missing, update `agentdeps.toml`, run `mad install`, then report the diff.
```

The point: an agent can enter the repository and know how to set up the correct capability surface without asking the user to restate local conventions.

## 8. Suggested implementation stack

### Recommended MVP stack: TypeScript/Node CLI

Reasons:

- easy npm distribution;
- TOML/YAML/file operations are straightforward;
- Codex/OMX users are likely to have Node available;
- later Homebrew packaging is still possible;
- can run cross-platform enough for macOS/Linux dev workflows.

Potential package layout:

```text
packages/cli/
  src/commands/init.ts
  src/commands/install.ts
  src/commands/run.ts
  src/commands/doctor.ts
  src/resolver/
  src/materializer/
  src/registry/
  src/schema/
modules/
  core/
  repo-basic/
  ios-swift/
  tuist/
  app-release/
docs/
examples/
```

## 9. Resolver pipeline

```text
load manifest
  -> validate schema
  -> expand selected profile
  -> load module metadata
  -> resolve dependencies
  -> detect conflicts
  -> evaluate permissions/env requirements
  -> write lockfile
  -> materialize runtime
  -> run doctor checks
```

## 10. Materialization strategy

Two modes:

### Copy mode

Default for stability and reproducibility.

Pros:

- lockfile hashes match actual runtime;
- CI-friendly;
- safe for open-source users.

Cons:

- slower during module development.

### Symlink mode

Useful for local module authors.

Pros:

- fast iteration;
- edits immediately visible after regeneration.

Cons:

- less reproducible;
- fragile across machines.

MVP default: `copy`.

## 11. MCP handling

MCP is the hardest part because tool availability is usually established at session startup.

MVP rule:

- AgentDeps configures MCP servers in the generated runtime before Codex launches.
- No promise of live MCP hot reload inside an existing session.
- MCP entries are disabled unless the selected profile requires them or the user explicitly enables them.
- Secret material must come from environment variables, local keychain, or user-managed config, never from module source.

Example module `mcp.toml`:

```toml
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
enabled = true
startup_timeout_sec = 5

[mcp_servers.figma]
url = "https://mcp.figma.com/mcp"
enabled = false
requires_env = ["FIGMA_ACCESS_TOKEN"]
```

## 12. Open-source distribution path

### Phase 0: repo-local prototype

- manifest schema;
- local modules;
- `install`, `doctor`, `run`;
- generated runtime;
- no remote registry.

### Phase 1: npm package

```bash
npm install -g agentdeps
mad init
```

### Phase 2: module authoring API

```bash
mad module init ios-swift
mad module test ./modules/ios-swift
mad module pack ./modules/ios-swift
```

### Phase 3: remote registry

- Git source support;
- semver ranges;
- content hashes;
- signed module metadata if adoption grows.

### Phase 4: ecosystem

- curated modules;
- project templates;
- examples for iOS/Tuist, Flutter/Melos, web/Next.js, design/Figma.

## 13. MVP acceptance criteria

A successful MVP should demonstrate:

1. `mad init` creates a manifest and local module folder.
2. `mad install --profile light` creates a minimal runtime.
3. `mad install --profile ios` creates a larger runtime with iOS/Tuist capabilities.
4. `mad doctor` reports active modules, conflicts, required env vars, and generated paths.
5. `mad run --profile ios` launches a shell/Codex command using the generated runtime.
6. Another agent can read `docs/AGENT_SETUP_CONTRACT.md` and perform setup without touching global `~/.codex`.

## 14. Recommended first modules

Start with a tiny curated set:

| Module | Purpose |
| --- | --- |
| `core` | baseline AGENTS fragment, safe execution rules |
| `repo-basic` | repo exploration, git hygiene, test discovery |
| `ios-swift` | Swift/iOS architecture and testing skills |
| `tuist` | Tuist project graph guidance and templates |
| `xcode-debugging` | simulator/build-log triage |
| `app-release` | Fastlane/TestFlight/App Store checklist |
| `localization` | string catalog and l10n workflow |

Do not start with 30 modules. The tool must feel light.

## 15. Design principle

AgentDeps should be boring infrastructure:

- deterministic over clever;
- local-first over cloud-first;
- explicit over magic;
- safe by default;
- agent-readable by default;
- global-state mutation only by explicit opt-in.
