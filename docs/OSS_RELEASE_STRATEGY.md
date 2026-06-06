# Open-Source Release Strategy

## Positioning

AgentDeps should be introduced as:

> A local-first CLI that gives each repository its own reproducible Codex capability runtime.

Avoid pitching it first as a marketplace, registry, or magic agent framework. Those sound risky and vague. The first public promise should be reproducibility and safety.

## Safety promises for v0

The README and CLI must make these guarantees easy to verify:

1. no global `~/.codex` mutation by default;
2. generated runtime is written under `.agentdeps/runtime/<profile>`;
3. setup scripts are disabled by default;
4. remote modules are not required for MVP;
5. secrets are never stored in module manifests;
6. `mad doctor` shows exactly what will be active;
7. `mad clean` removes generated runtime without touching source manifests.

## Suggested public milestones

### v0.0.1 — Local prototype

Audience: internal/dogfood only.

Features:

- `mad init`;
- `mad install`;
- `mad doctor`;
- `mad run -- <command>`;
- builtin local modules;
- copy-only materialization.

No remote registry.

### v0.1.0 — First open-source alpha

Audience: advanced Codex/OMX users.

Features:

- npm package;
- README quickstart;
- sample `agentdeps.toml`;
- `light` and `ios` demo profiles;
- lockfile;
- conflict detection;
- `mad explain`.

### v0.2.0 — Module authoring

Audience: users who want private/team modules.

Features:

- `mad module init`;
- `mad module test`;
- local module validation;
- documented module schema.

### v0.3.0 — Git source modules

Audience: teams sharing modules across repos.

Features:

- Git module sources;
- pinned revisions;
- content hash verification;
- no arbitrary script execution by default.

### v1.0.0 — Stable local-first runtime manager

Audience: broader agent-tool users.

Required before v1:

- stable manifest schema;
- stable lockfile schema;
- reliable doctor output;
- upgrade/migration command;
- cross-platform smoke tests;
- security policy;
- contribution guide.

## Repository hygiene before public release

Add:

```text
LICENSE
CONTRIBUTING.md
SECURITY.md
CODE_OF_CONDUCT.md
CHANGELOG.md
examples/
modules/
packages/cli/
```

## First demo script

The demo should be short:

```bash
mad init
mad install --profile light
mad doctor --profile light
mad install --profile ios
mad explain --profile ios
mad run --profile ios -- env | grep CODEX
```

Then show that global `~/.codex` did not change.

## Name risk

`mad` is memorable but generic and may collide with other tools. Keep `mad` as a CLI alias, but publish/package under a clearer name such as:

- `agentdeps`
- `codex-agentdeps`
- `modular-agent-deps`

Recommendation: package name `agentdeps`, binary aliases `agentdeps` and `mad`.
