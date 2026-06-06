# Agent Setup Contract

This document is the contract for any agent entering a repository that uses AgentDeps.

## Objective

Set up the project-specific Codex/OMX capability runtime without polluting global user configuration.

## Agent rules

1. Prefer project-local AgentDeps state over global assumptions.
2. Do not manually edit `~/.codex` for project-specific needs.
3. Do not enable remote MCP servers or credential-dependent tools unless the manifest/profile requires them.
4. Do not run module setup scripts unless the policy explicitly allows it.
5. If runtime is stale, regenerate it from the manifest instead of hand-editing generated files.
6. Report generated paths and validation evidence before claiming setup is complete.

## Standard setup flow

```bash
mad agent status
mad agent bootstrap
mad doctor
```

If `mad` is not installed yet in the repository, use the repo-local fallback once implemented:

```bash
node ./packages/cli/dist/index.js agent bootstrap
```

## Expected project files

```text
agentdeps.toml
.agentdeps/agentdeps.lock.toml
.agentdeps/runtime/<profile>/
docs/AGENT_SETUP_CONTRACT.md
```

## Safe repair flow

```bash
mad install --profile <profile>
mad doctor --profile <profile>
```

This may regenerate `.agentdeps/runtime/<profile>`, but must not mutate global `~/.codex`.

## Handoff format

When reporting setup, use this shape:

```text
Profile: ios
Runtime: .agentdeps/runtime/ios
Modules: core, repo-basic, ios-swift, tuist
Doctor: pass
Global config changed: no
Warnings: <none or list>
```

## When to ask the user

Ask only if:

- credentials are required;
- a remote module source is untrusted;
- global config mutation is requested or unavoidable;
- the selected profile materially changes project behavior.

Do not ask before safe local regeneration.
