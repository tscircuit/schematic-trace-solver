# PGA300 pressure-transmitter board: missing supply junction dots

This reproduction uses the complete captured PGA300 pressure-transmitter
schematic: 17 components and 55 pins. No components, pin positions, connections,
or routing settings were synthesized, rotated, or simplified.

## Actual board and provenance

- Original board: [tscircuit/ti#117](https://github.com/tscircuit/ti/pull/117).
- Immutable circuit source: [PressureTransmitter_PGA300.circuit.tsx at 067b6a2](https://github.com/tscircuit/ti/blob/067b6a211b04bea3840fdd6b59cac6e5e9b0ed61/lib/subcircuits/PressureTransmitter_PGA300.circuit.tsx).
- Original schematic: [source snapshot at the same commit](https://github.com/tscircuit/ti/blob/067b6a211b04bea3840fdd6b59cac6e5e9b0ed61/lib/subcircuits/__snapshots__/PressureTransmitter_PGA300.circuit-schematic.snap.svg).
  An unchanged copy is included as `repro-pga300-missing-interior-junction-dot.source.svg`.
- Solver capture: [schematic-trace-solver#930](https://github.com/tscircuit/schematic-trace-solver/pull/930),
  [original input at e51b323](https://github.com/tscircuit/schematic-trace-solver/blob/e51b3238f4fb800bad6263738c91db1cf7f0ea87/tests/repros/assets/repro-pga300-redundant-ground-traces.input.json).
  The input was captured with `tsci build ... --schematic-only --disable-pcb --solver-debug`;
  that original capture removed only the debug serializer's
  `{ value_type: "undefined" }` markers. This repro copies that input unchanged,
  before subsequent fixture normalizations.
- Input SHA-256: `d7077f43364c00395e245c736f0bab9613c92c428c197c97b9a44de8ccb56081`.

The initial investigation used a synthetic T. This real-board reproduction
subsequently confirms the same defect; the synthetic fixture is removed.

## Where to look

The new snapshots show the current solver output for the entire captured board.
In the semantic schematic, inspect the supply wiring above and to the right of
U1:

1. At `(5.49, 3.05)`, the Q1 supply branch meets the interior of the horizontal
   U1.VDD–R_L1.pin1 rail.
2. At `(5.49, 1.29945535)`, the C4 branch meets the interior of the vertical Q1
   supply branch.

Both are exact same-net T connections, and both lack a junction dot. The test
checks the actual final trace paths and connectivity, then preserves the missing
dots in a full solver snapshot and a larger semantic-only schematic snapshot.
The original source SVG is a reference for the board, not a snapshot of this
reproduction. Captured solver inputs omit original symbol metadata, so the
solver's semantic snapshot uses generic component bodies.

`getJunctionsByTraceIndex` in `tests/fixtures/convertSolverOutputToCircuitJson.ts`
only matches stored trace vertices. After taking snapshots, the diagnostic
control inserts the two contact points as redundant collinear host vertices.
The converter then emits exactly one dot at each point without changing wire
geometry. This isolates the snapshot-conversion defect from routing or SVG
rendering; it does not establish a defect in tscircuit/core's own renderer.

```sh
bun test tests/repros/repro-pga300-missing-interior-junction-dot.test.ts
```

This PR preserves current behavior without changing the solver or converter.
A follow-up fix should recognize same-net endpoint-to-segment contacts, expect
one dot at each recorded location, and update the two reproduction snapshots.
