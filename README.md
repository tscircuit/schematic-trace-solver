# Schematic Trace Solver

Solve for the correct positions and routing for schematic traces and net labels. For use inside [@tscircuit/core](https://github.com/tscircuit/core)

## Usage

```tsx
import { SchematicTraceSolver } from "@tscircuit/schematic-trace-solver"

type ChipId = string
type PinId = string

new SchematicTraceSolver({
  chips: Array<{
    chipId: ChipId,
    center: { x: number, y: number },
    width: number,
    height: number,
    pins: Array<{
       pinId: PinId,
       x: number,
       y: number
    }>
  }>,
  connections: Array<{
    pinIds: [PinId, PinId],
    netName?: string
  }>
})
```
