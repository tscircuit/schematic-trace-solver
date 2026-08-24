---
name: schematic-trace-visualization
description: Work with schematic trace solver visualization in this repo. Use when changing solver `visualize()` or `preview()` output, adding debug graphics, creating SVG snapshots, inspecting pipeline stages, or generating graphics-debug artifacts for AI/headless review.
---

# Schematic Trace Visualization

Use `GraphicsObject` from `graphics-debug` for solver debug views, SVG snapshots, and headless artifacts.

## Graphics Object Types

Import visualization types from `graphics-debug`:

```ts
import type {
  GraphicsObject,
  Point,
  Line,
  Rect,
  Circle,
  Text,
} from "graphics-debug"
```

Do not redefine these shapes in repo docs, tests, or utilities.

## Image Functions

This repo uses `graphics-debug` for SVG and PNG rendering:

```ts
import {
  getPngBufferFromGraphicsObject,
  getSvgFromGraphicsObject,
} from "graphics-debug"
```

Call them with a white background for stable artifacts:

```ts
const svg = getSvgFromGraphicsObject(graphics, { backgroundColor: "white" })
const png = await getPngBufferFromGraphicsObject(graphics, {
  backgroundColor: "white",
  pngWidth: 1536,
  pngHeight: 1536,
})
```

## Existing Repo Helpers

- `tests/fixtures/matcher.ts`: `expect(solver).toMatchSolverSnapshot(import.meta.path)` converts the solver's semantic output to Circuit JSON and renders it with `circuit-to-svg`. These snapshots hide the input rats nest by default.
- `tests/fixtures/convertSolverOutputToCircuitJson.ts`: builds snapshot Circuit JSON with schematic components/symbols, ports, routed traces, net labels, text, and boxes.
- `tests/fixtures/getLastStepGraphicsObject.ts`: filters a `GraphicsObject` to its highest numbered `step`.
- `tests/fixtures/getLastStepSvg.ts`: converts only the last step to SVG.
- `lib/testing/PipelineStageDebugRunner.ts`: runs `SchematicTracePipelineSolver` and writes per-stage PNG/SVG/graphics JSON artifacts.
- `scripts/debug-pipeline-stages.ts`: CLI wrapper around the stage debug runner.

## Minimal SVG Tests

Prefer focused solver SVG snapshots over broad dumps. Solver snapshots use the
semantic Circuit JSON renderer by default:

```ts
const solver = new SchematicTracePipelineSolver(inputProblem as any)
solver.solve()
expect(solver).toMatchSolverSnapshot(import.meta.path)
```

Use `solver.visualize()` with `getSvgFromGraphicsObject` directly when a test is
specifically about internal candidates, failed geometry, or staged debug state.

For multi-step graphics where only the final stage matters:

```ts
expect(getLastStepSvg(solver.visualize())).toMatchSvgSnapshot(import.meta.path)
```

Update snapshots with:

```bash
BUN_UPDATE_SNAPSHOTS=1 bun test
```

## Headless Stage Debugging

To inspect a pipeline run without Cosmos:

```bash
bun run debug:pipeline tests/assets/example01.json
```

Useful options:

```bash
bun run debug:pipeline tests/assets/example17.json --out tmp/schematic-trace-debug/example17
bun run debug:pipeline tests/assets/example17.json --stop-after schematicTraceLinesSolver
bun run debug:pipeline tests/assets/example17.json --no-json
bun run debug:pipeline tests/assets/example17.json --svg --step-pngs
```

The runner writes:

- `logs.txt`
- `stageNN-stageName.png`
- `stageNN-stageName.graphics.json` unless `--no-json` is passed

Pass `--svg` when SVG companion artifacts are useful.
Pass `--step-pngs` to split graphics with `step` values into per-step PNGs.

Stage numbers are important because this pipeline can reuse the same solver name more than once, for example `netLabelPlacementSolver`.

## Choosing The View

Use solver-native `visualize()` for internal state, candidates, failed geometry, staged progress, net labels, and trace cleanup state.

Use `SchematicTracePipelineSolver.visualize()` for final combined output after `solve()`.

Use `visualizeInputProblem(inputProblem)` when the question is about the raw input geometry, schematic components, pins, direct connections, or net connection labels before routing.

Keep SVG backgrounds white. Treat colors, labels, line widths, opacity, and `step` values as snapshot-sensitive.
