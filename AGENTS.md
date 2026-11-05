# Agent Notes

- Use `bunx tsc --noEmit` to type check.
- Use `bun test path/to/test.ts` to run a test.
- Use `bun add <package>` to add a package.

## Solver Visualization

For schematic trace solver visualization work, use the repo-local skill:

- `.agents/skills/schematic-trace-visualization/SKILL.md`

This repo supports headless stage artifact generation without starting Cosmos:

```bash
bun run debug:pipeline tests/assets/example01.json
```

The command writes per-stage PNG and graphics JSON artifacts under `tmp/schematic-trace-debug/...`.
Pass `--svg` when SVG companion files are needed.

Interactive debugging still exists through `site/**/*.page.tsx`, but agents should prefer the headless debug runner when they need to inspect solver state programmatically.
