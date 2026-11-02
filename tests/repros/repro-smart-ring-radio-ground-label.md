# Smart-ring Radio ground label overlap

Source: https://tscircuit.com/abse/smart-ring-flex#schematic, Radio sheet,
published version 0.0.24 (release `301161d8-2aa3-4535-9455-68bafc0ef595`).

The fixture reconstructs the complete Radio sheet's solver input from the
published Circuit JSON using `createSchematicTraceSolverInputProblem` from
the project's pinned `@tscircuit/core` 0.0.2192. It preserves all nine components,
67 ports, source connections, label dimensions, text obstacles, and port order.
Section names come from `src/schematic-layout.json`; `schMaxTraceDistance={0.8}`
comes from `src/ring-board.tsx`. Component `symbolName` and net `netLabelText` metadata were added for
readable snapshots. This is reconstructed input, not a live `solver:started`
capture; the reproduction adds no dependency on core.

U1 pin 49 is `schematic_port_169`. Its generated downward GND label has anchor
(-5.6865, 1.599), matching the published schematic. Pin 45
(`schematic_port_165`) connects to pin 31 (`schematic_port_151`) along a ground
trace whose upper horizontal segment is at y=1.5. Late trace rerouting brings
that segment through pin 49's rendered label. There is room to shorten the
dedicated connector and keep the entire label above the trace.

The regression test asserts that the whole label clears pin 45's trace from
above and that its connector terminates at the new anchor without leaving a
wire tail. The full-sheet snapshot is regenerated from solver output.
