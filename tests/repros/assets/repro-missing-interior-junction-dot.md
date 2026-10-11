# Missing junction dot at a host-segment interior

This is a synthetic minimal reproduction, not a captured production board.
Three single-pin chips share one net through two explicit connections. The
5 mm MSP distance limit keeps this small example physically routed.

The final solver output contains a horizontal U1–U2 wire from `(0, 0)` to
`(4, 0)` and a U3 branch from `(2, 2)` to `(2, 0)`. Both traces have the same
connectivity net. The wires meet exactly, but the semantic Circuit JSON
converter emits no junction marker at `(2, 0)`. The second snapshot rotates
the entire input 90 degrees and reproduces the same defect on a vertical host.

In each combined snapshot, inspect the T intersection in the lower, semantic
schematic panel. It should contain one junction dot. These snapshots preserve
the current missing-dot output. This report concerns the repository's snapshot
converter; it does not establish the same behavior in tscircuit/core.

`getJunctionsByTraceIndex` in `tests/fixtures/convertSolverOutputToCircuitJson.ts`
only matches stored trace vertices. The tests also add a redundant collinear
vertex to the host after taking the snapshot: without moving either wire,
this makes the converter emit exactly one dot. That control isolates the
conversion defect from the router and SVG renderer.

Run the reproduction:

```sh
bun test tests/repros/repro-missing-interior-junction-dot.test.ts
```

This is reproduction-only: no solver or converter changes. A follow-up fix
should recognize same-net endpoint-to-segment contacts, change the empty-marker
assertion to expect the junction, and update both snapshots.
