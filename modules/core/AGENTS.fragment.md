AgentDeps core rules:

- Prefer project-local `.agentdeps` state over global assumptions.
- Do not mutate `~/.codex` unless explicitly requested.
- Separate active-now soft changes from restart-required hard capabilities.
