# Runtime Toggle Design

## Problem

AgentDeps needs two different control paths:

1. **Pre-launch control** — scripts resolve modules and generate a project-local runtime before Codex/OMX starts.
2. **In-session control** — while already inside a repository and running Codex/OMX, the user can consult the agent and ask it to turn project capabilities on/off where safe.

These are not the same capability. Some things can change during a session; others require a generated runtime refresh or a Codex/OMX restart.

## Decision

Do **not** treat this as README-only guidance.

Use three layers:

```text
README.md
  human-facing concept and quickstart

agentdeps.toml + .agentdeps/session.toml
  machine-readable desired state and current session toggles

docs/AGENT_SETUP_CONTRACT.md + AGENTS.md fragment
  agent-facing operating contract
```

README explains. The manifest and session state control. The agent contract tells agents how to safely modify them.

## Two supported modes

### Mode A: Sealed runtime mode

This is the deterministic path.

```bash
mad install --profile ios
mad run --profile ios -- omx
```

Characteristics:

- creates `.agentdeps/runtime/<profile>`;
- selected skills/agents/prompts/MCP config are materialized before launch;
- reproducible and lockfile-backed;
- best for CI, onboarding, and stable project work;
- required for hard capabilities such as MCP server availability.

### Mode B: Live advisory toggle mode

This is the already-running-session path.

Example user request:

> 지금 이 루트 폴더에서 OMX 켜져 있는데, iOS 릴리즈 관련 능력은 끄고 Tuist 설계 상담만 켜줘.

Agent behavior:

```bash
mad agent status
mad agent suggest --enable tuist --disable app-release
mad agent apply --session
mad doctor --session
```

Characteristics:

- updates `.agentdeps/session.toml` or selected profile intent;
- can immediately change agent behavior for soft capabilities;
- can regenerate runtime files for future sessions;
- reports which changes require restart;
- must not pretend to live-load unavailable MCP tools.

## Capability classes

AgentDeps must classify module contributions by runtime behavior.

| Class | Examples | Live toggle? | Restart needed? |
| --- | --- | --- | --- |
| Soft instruction | AGENTS fragments, task policy, recommended workflow | Yes | No |
| Soft routing | which agent role/skill the current assistant should prefer | Yes, as session policy | No, if already known to agent |
| Generated files | runtime config, generated AGENTS, templates | Regenerate yes | Current session may not reread automatically |
| Skills/agents | `.codex/skills`, `.codex/agents` | Maybe for future discovery | Usually restart/new session safest |
| MCP/tooling | MCP server config and enabled state | No reliable hot-load | Yes |
| Secrets/credentials | env vars, tokens, auth | No auto-setup | User approval/input required |

## Session state file

MVP should introduce:

```text
.agentdeps/session.toml
```

Example:

```toml
[session]
active_profile = "ios"
mode = "advisory"
updated_by = "agent"
updated_at = "2026-06-06T00:00:00Z"

[session.toggles]
enabled = ["tuist", "ios-swift"]
disabled = ["app-release", "figma"]

[session.restart_required]
required = true
reasons = [
  "MCP server changes require Codex/OMX restart",
  "New skill directories may not be discovered by the current session"
]
```

This file is not a replacement for the lockfile. It is a current-session intent/override file.

## Agent consultation flow

When a user asks to turn capabilities on/off during an active session, the agent should:

1. inspect `agentdeps.toml`, lockfile, and current session state;
2. classify requested changes as soft or hard;
3. apply soft changes to `.agentdeps/session.toml`;
4. update `agentdeps.toml` only if the user wants durable project defaults;
5. run `mad doctor --session`;
6. clearly report:
   - active now;
   - generated for next run;
   - restart required;
   - blocked by credentials or missing tools.

## Commands to support

### Read state

```bash
mad agent status
mad agent capabilities
mad agent explain tuist
```

### Consultation/planning

```bash
mad agent suggest --goal "Tuist modularization only, no release ops"
mad agent diff --enable tuist --disable app-release
```

### Apply session-only changes

```bash
mad agent apply --session --enable tuist --disable app-release
```

### Apply durable manifest changes

```bash
mad profile enable ios tuist
mad profile disable ios app-release
mad install --profile ios
```

### Restart guidance

```bash
mad doctor --session
mad agent restart-command
```

## UX rule

Every toggle response should separate four states:

```text
Active now: soft instructions/routing applied in this conversation
Generated: runtime files updated for next launch
Restart required: MCP/skill/agent discovery changes
Blocked: credentials or unsupported live reload
```

## Why README is insufficient

README is useful for humans, but agents need structured state.

If this is only in README:

- agents cannot reliably know current toggles;
- doctor cannot validate drift;
- lockfile/runtime mismatch is invisible;
- session-only vs durable changes become confused;
- users may believe MCP was live-loaded when it was not.

Therefore the toggle model needs machine-readable state plus an agent contract.

## MVP implementation boundary

For v0, implement the honest minimum:

1. `mad agent status` reads manifest/lock/session.
2. `mad agent apply --session` writes `.agentdeps/session.toml`.
3. `mad doctor --session` reports soft/hard/restart-required states.
4. `mad install` still owns generated runtime.
5. No claim of live MCP hot reload.

That gives users the in-session consultation UX without lying about runtime limitations.
