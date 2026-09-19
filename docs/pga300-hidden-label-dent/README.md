# PGA300 hidden-label detour

The before and after SVGs render the unmodified `PressureTransmitter_PGA300`
TSX from [ti at 54d747b](https://github.com/tscircuit/ti/blob/54d747b7618713abe17c1c41551124a8c765b350/lib/subcircuits/PressureTransmitter_PGA300.circuit.tsx)
through core at `90b47bc`. The PNGs crop the same schematic area at the same scale.

Before uses schematic-trace-solver at `8bd702b`. After uses this solver change
and the core producer change that passes the canonical label resolver's
`wasAssignedDisplayLabel` as `labelFullyRoutedConnection`.

The ground connector previously detoured around an automatically placed AVDD
label that core did not render. Its path changes from six points to two points.
The existing connectivity graph still requires labels for disconnected islands
and unrouted endpoints; explicit net labels and default callers are preserved.

Release the solver change first, then update core's solver dependency and merge
the producer change. The core companion includes a small inline TSX regression
for the producer decision; the solver regression reuses the existing PGA300 input.
