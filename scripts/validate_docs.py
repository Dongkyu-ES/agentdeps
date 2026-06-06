from pathlib import Path
import re
import sys
try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    import tomli as tomllib

root = Path.cwd()
toml_files = list((root / 'examples').glob('*.toml'))
for optional in [root / 'agentdeps.toml', root / '.agentdeps' / 'agentdeps.lock.toml', root / '.agentdeps' / 'session.toml']:
    if optional.exists():
        toml_files.append(optional)
for p in toml_files:
    tomllib.loads(p.read_text())

required = [
    'README.md',
    'LICENSE',
    'docs/DESIGN_PROPOSAL.md',
    'docs/AGENT_SETUP_CONTRACT.md',
    'docs/RUNTIME_TOGGLE_DESIGN.md',
    'docs/SELF_CRITIQUE.md',
    'docs/NEXT_IMPLEMENTATION_PLAN.md',
    'docs/OSS_RELEASE_STRATEGY.md',
    'examples/agentdeps.toml',
]
for item in required:
    if not (root / item).is_file():
        raise SystemExit(f'missing {item}')

for p in [root / 'README.md', *(root / 'docs').glob('*.md')]:
    text = p.read_text()
    for match in re.finditer(r'\[[^\]]+\]\(([^)]+)\)', text):
        target = match.group(1)
        if '://' in target or target.startswith('#'):
            continue
        if not (p.parent / target).resolve().exists():
            raise SystemExit(f'bad link {p.relative_to(root)}: {target}')

print('docs validation OK')
