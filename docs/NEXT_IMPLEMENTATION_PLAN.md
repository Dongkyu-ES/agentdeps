# Next Implementation Plan

## Goal

Turn the design into a working local prototype without touching global `~/.codex`.

## Step 1: Repository skeleton

Create:

```text
package.json
tsconfig.json
packages/cli/src/index.ts
packages/cli/src/schema.ts
packages/cli/src/commands/init.ts
packages/cli/src/commands/install.ts
packages/cli/src/commands/doctor.ts
packages/cli/src/commands/run.ts
modules/core/module.toml
modules/repo-basic/module.toml
modules/ios-swift/module.toml
modules/tuist/module.toml
```

## Step 2: Manifest schema

Support only:

- project name;
- default profile;
- profiles with module arrays and optional `extends`;
- local/builtin module sources;
- runtime output dir;
- safety policy.

## Step 3: Builtin modules

Start with text-only modules:

- `AGENTS.fragment.md`;
- optional `skills/<name>/SKILL.md`;
- optional `agents/<name>.toml`;
- optional `mcp.toml`.

No setup scripts in MVP.

## Step 4: Materializer

Implement copy-only materialization:

```text
.agentdeps/runtime/<profile>/
```

Generated files should include content hashes.

## Step 5: Doctor

Report:

- profile;
- modules;
- generated runtime path;
- conflicts;
- missing env vars;
- whether global config was touched.

## Step 6: Run wrapper

Initial conservative behavior:

```bash
mad run --profile ios -- env
mad run --profile ios -- codex
```

The wrapper sets runtime env vars and prints the command it is launching.

## Step 7: Smoke test

Create two profiles and assert they produce different runtimes:

- `light` has `core`, `repo-basic`;
- `ios` has `core`, `repo-basic`, `ios-swift`, `tuist`.

## Stop condition

Prototype is done when:

- `mad init` writes `agentdeps.toml`;
- `mad install --profile light` succeeds;
- `mad install --profile ios` succeeds;
- `mad doctor --profile ios` returns pass/warnings;
- generated runtime files exist and differ by profile;
- no global `~/.codex` files are changed.
