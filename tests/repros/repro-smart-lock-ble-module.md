# Smart-lock BLE module sheet

Standalone routing repro for the complete `ble_module` sheet in
[imrishabh18/smart-lock](https://tscircuit.com/imrishabh18/smart-lock#schematic),
release `0.0.1` (`e2dd7857-ec5e-4eca-9a52-d53e0e996fef`). It includes the
CC2745R10 controller, supply decoupling, both crystal circuits, reset circuit,
RF matching network, test connector, and antenna.

## Source and reconstruction

- [Deployed Circuit JSON](https://imrishabh18--smart-lock-v0-0-1.tscircuit.app/index/circuit.json),
  retrieved September 22, 2026.
- Circuit JSON SHA-256:
  `8cd62ecd39431ae01a07338b0860f5e2032f0ffad9ae8df04ce7ef9b2058d2fa`.
- Sheet: `schematic_sheet_2`; group: `schematic_group_2`;
  subcircuit: `subcircuit_source_group_2`.
- Input builder: `@tscircuit/core` 0.0.1958,
  commit `8171decf2b3152240d33943263fbe6a93c9d1049`.
- Solver baseline: `@tscircuit/schematic-trace-solver` 0.0.203,
  commit `62de2c4`.

The fixture preserves all **39 components and 123 schematic pins**, including
pin coordinates, labels, and facing directions. It has **16 direct connections**,
**37 named nets**, and the controller's two text obstacles. Connectivity comes
from source traces and source-port connectivity keys, not the rendered wires.
The other seven sheets are excluded.

This is reconstructed solver input from the saved Circuit JSON, rather than a
captured solver invocation from the original build. The database was passed to
core's `createSchematicTraceSolverInputProblem`, scoped to the sheet/group above,
with an empty child-group/port tree and default group props. No live JSX tree or
explicit netlabel overrides are reconstructed. Core's database fallback resolves
the net names. The current default `maxMspPairDistance: 2.4`, text-inclusive
obstacles, label dimensions, rail orientations, and inline-label eligibility are
used; the original build's solver parameters are not available in Circuit JSON.

Opaque component IDs were replaced with the unique source names (`U1`, `C99`,
etc.), including their text-box references. Schematic pin IDs are unchanged.
Directional `symbolName` values were copied from the deployed components, and
`netLabelText` was populated using core's canonical net-name resolver (named
nets use their source name). These display fields let the standalone snapshot
show recognizable components and labels without depending on core at test time.
Custom chip symbols such as J7 and ANT1 render as boxes with their original pins.

The fixture contains no pre-routed traces. The snapshot records current solver
behavior for future routing comparisons; this repro does not change the solver
or assert that the sheet is free of routing/label defects.

## Run

```sh
bun test tests/repros/repro-smart-lock-ble-module.test.ts
bun run debug:pipeline tests/repros/assets/repro-smart-lock-ble-module.input.json --svg
```

For interactive inspection, run `bun start` and select
`SchematicTracePipelineSolver/repro-smart-lock-ble-module` in Cosmos. The page
and snapshot test share the same JSON fixture.

To update the baseline intentionally:

```sh
BUN_UPDATE_SNAPSHOTS=1 bun test tests/repros/repro-smart-lock-ble-module.test.ts
```
