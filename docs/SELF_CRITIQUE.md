# Self-Critique

## Top-line verdict

The concept is viable, but the dangerous version is too ambitious: trying to dynamically hot-load every Codex capability inside an already-running session would make the project brittle. The strong MVP is a deterministic pre-launch runtime generator.

## What is strong

1. **Real pain point** — global agent setups become heavy, stale, and hard to reproduce.
2. **Good analogy base** — Tuist/Melos/dynamic framework concepts map well to generated runtime, bootstrap, and opt-in modules.
3. **Agent-friendly wedge** — most tools are human-first; this can be agent-first by producing a setup contract and doctor output.
4. **Safe default** — project-local runtime avoids corrupting `~/.codex`.
5. **Open-source shape** — a CLI + local registry + example modules is easy to understand and demo.

## Main risks

### Risk 1: Codex surface compatibility

Not every Codex surface may honor project-local runtime paths the same way. CLI, app, plugins, and tmux/OMX may differ.

Mitigation:

- make CLI runtime launch the primary supported path;
- document app/native limitations;
- keep generated files inspectable;
- avoid promising universal hot reload.

### Risk 2: MCP cannot be truly dynamic mid-session

MCP servers are usually discovered on startup. Runtime profile changes may require relaunch.

Mitigation:

- call this out clearly;
- make `mad run` the blessed entrypoint;
- make `mad doctor` detect profile/runtime mismatch.

### Risk 3: Supply-chain/security risk

Remote modules could hide malicious scripts or MCP endpoints.

Mitigation:

- MVP local-only or curated-only;
- scripts disabled by default;
- lockfile hashes;
- explicit permissions in `module.toml`;
- no secrets in modules.

### Risk 4: Over-modularization

If every tiny behavior becomes a module, users will get dependency soup.

Mitigation:

- start with 5-7 high-value modules;
- support profiles as UX layer;
- provide `mad explain` so users know why a capability exists.

### Risk 5: Conflict resolution complexity

Skill/agent names can collide. Config merging can become surprising.

Mitigation:

- fail on conflicts by default;
- require explicit `replace = true`;
- show a merge report in `mad doctor`;
- prefer namespacing for community modules.

### Risk 6: Building a registry too early

A public registry is attractive but not needed to prove value.

Mitigation:

- Phase 0: local modules only;
- Phase 1: npm CLI;
- Phase 2: Git-based module sources;
- Phase 3: registry/signing only if adoption justifies it.

## Things to cut from MVP

Cut these until the local prototype works:

- remote registry;
- module signing;
- GUI;
- cloud sync;
- live reload;
- auto-running setup scripts;
- complex semver resolution;
- team marketplace features.

## Minimal useful MVP

Build only this first:

```text
agentdeps.toml
local builtin modules
mad init
mad install --profile light
mad install --profile ios
mad doctor
mad run --profile ios -- <command>
```

If that works, the concept is proven.

## Product positioning critique

The initial framing as "dependency manager for agents" is accurate but abstract. A better pitch:

> `mad` gives every repository its own reproducible Codex capability runtime.

That is concrete and useful.

## Architecture critique

The design currently assumes generated Codex homes are enough. This should be verified early with a smoke test:

1. create two runtimes with different skills;
2. launch Codex/OMX with each runtime;
3. confirm visible skill/agent/MCP differences;
4. confirm global `~/.codex` remains unchanged.

If this fails, pivot to a weaker but still useful product:

- generate project-local `.codex` scaffolds;
- generate AGENTS.md fragments;
- provide doctor/explain/install;
- do not claim full runtime isolation.

## Open-source critique

Open-source users will distrust a tool that touches agent config and MCP. The README must lead with safety:

- local-first;
- generated output is inspectable;
- no global mutation by default;
- scripts disabled by default;
- `mad diff` before applying any global change.

## Better first demo

The best demo is not a generic module system. The best demo is two profiles in one repo:

```bash
mad run --profile light
# starts small: repo/basic only

mad run --profile ios
# adds iOS/Tuist/release capabilities
```

Then show:

```bash
mad explain --profile ios
```

and prove exactly why each capability exists.

## Final recommendation

Proceed, but keep the first implementation brutally small:

1. schema;
2. local modules;
3. copy materializer;
4. doctor output;
5. launch wrapper;
6. smoke test.

Do not build a registry until the local runtime generator proves real value.
