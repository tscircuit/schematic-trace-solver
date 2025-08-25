# Schematic Trace Solver

Solve for the correct positions and routing for schematic traces and net labels. For use inside [@tscircuit/core](https://github.com/tscircuit/core)

[Online Playground](https://schematic-trace-solver.vercel.app) ・ [tscircuit](https://github.com/tscircuit/tscircuit) ・ [@tscircuit/core](https://github.com/tscircuit/core)

## Overview

The Schematic Trace Solver is a pipeline that figures out how to route schematic traces
and place net labels for a given schematic layout.

Chips are defined by their center point, width, and height and pins.

You then pass in direct connections and net connections. Direct connections are
explicit pin-to-pin connections. When there's a direct connection between two
pins, there is guaranteed to be a routed trace between them.

Net connections will not be routed, net labels are placed instead.

The solver first constructs minimum spanning tree to determine what pin-pairs
to draw via the `MspConnectionPairSolver`. If there are two pins A and B that both connect to C, this phase will
determine how to route traces to minimize overlap or crossings. e.g. we may
decide to route a trace from A to B, then B to C OR we may decide to route a
trace from A to C, then C to B. The pairs of traces are the mspConnectionPairs,
these are used in future phases.

After the minimum spanning tree is constructed, we draw the schematic traces
for each mspConnectionPair via the `SchematicTraceLinesSolver`. The `TraceOverlapShiftSolver`
then shifts the schematic traces to make sure there are no parallel overlapping traces by
shifting parallel traces orthogonally by a small amount.

Finally, the `NetLabelPlacementSolver` places net labels for each net connection. Often
this requires drawing small traces to adapt to the `availableFacingDirections` of the net connection.
If there is crowding at the pin, we look for an available spot along the trace connected to the pin.

## Usage

```tsx
import { SchematicTracePipelineSolver } from "@tscircuit/schematic-trace-solver"

type ChipId = string
type PinId = string

const solver = new SchematicTracePipelineSolver({
  chips: {
    chipId: "U1",
    center: { x: 0, y: 0 },
    width: 1.6,
    height: 0.6,
    pins: [
      {
        pinId: "U1.1",
        x: -0.8,
        y: 0.2,
      },
      // ...
    ],
  },
  directConnections: [
    {
      pinIds: ["U1.1", "C1.1"],
      netId: "VCC",
    },
    // ...
  ],
  netConnections: [
    {
      availableFacingDirections: ["y-"],
      netId: "GND",
      pinIds: ["U1.3", "C1.2", "C2.2"],
    },
    // ...
  ],
  availableNetLabelOrientations: {
    VCC: ["y+", "y-"],
    GND: ["y+", "y-"],
  },
})

solver.solve()
```
