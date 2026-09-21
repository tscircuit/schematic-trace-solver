# AM3352 full 03-Interfaces sheet

Reproduces the complete **03-Interfaces — Storage, USB and cable interfaces**
sheet from the supplied `am3352-dev-board-4layer-dogbone.json`.
Unlike `repro-am3352-sheet3-power-rails`, this includes all 17 components and
95 ports: the processor interface block, all connectors, pull-ups, and capacitor.

Original file SHA-256:
`12b99443f0134c6f8fabdfd7a53fb7022af8d375a1d5039a9552426368de21c9`.

The Circuit JSON fixture retains the sheet records verbatim, plus their source
components, ports, nets, and touching source traces. The source SVG records the
uploaded routing, symbols, values, and placement. Other sheets and PCB elements
are excluded. Source connectivity references outside the sheet remain unchanged.

The input fixture reconstructs the solver problem from those records. All
schematic component/port IDs, pin coordinates, facing directions, and the 21
named nets are preserved. Net membership follows source-port connectivity keys.
All 90 touching source traces are port-to-net connections, so direct connections
are empty. Unconnected ports are retained. Existing routed traces and labels
are reference output only; they are not fed back into the solver.

Component obstacles and 14 component-owned text obstacles use core's
`getSchematicComponentWithTextBounds` and `schematicTextToTextBox` helpers
from core 0.0.1944. Symbol names are preserved in the input fixture.
The export does not contain the original solver invocation or TSX: routing
options are reconstructed using current core conventions, including
`maxMspPairDistance: 2.4`, rail height 0.42, signal inline-label height 0.12,
and source-net power/ground flags for label orientations. This is an exact
sheet extraction, not a claim that the original solver invocation was captured.

The second snapshot shows the current solver's rerouting of the full sheet.
It is a baseline reproduction, not a routing fix or a before/after comparison.

```sh
bun test tests/repros/repro-am3352-03-interfaces.test.ts
bun run debug:pipeline tests/repros/assets/repro-am3352-03-interfaces.input.json --svg
```

For interactive inspection, run `bun start` and open
`SchematicTracePipelineSolver/repro-am3352-03-interfaces`.
