# AM3352 sheet 3: connector power and ground rails

This is a reduced, runnable solver repro for the J_SD, J_SPI, J_I2C and J_USB0
section of **03-Interfaces — Storage, USB and cable interfaces** (sheet 3).
It records the baseline for future V3V3/GND label and trace improvements.
The fixture is unchanged; its regression assertions and snapshot now cover
the direction-aware recovery behavior described below.

## Source and reduction

- Deployment: https://am3352-dev-board.vercel.app/#file=index.circuit.tsx
- Circuit JSON: https://am3352-dev-board.vercel.app/index/circuit.json
- User-supplied source link: https://github.com/tscircuit/am3352-dev-board
  (returned 404 when this repro was made).
- Retrieved 2026-09-15. Circuit JSON SHA-256:
  `a9216069870f58ab841446871ed9101d09aabe2eb7457d130e1285cc204006c3`.
- Solver baseline: `77c271b` (`@tscircuit/schematic-trace-solver` 0.0.197).

The fixture preserves the deployed component centers, sizes, all 36 port
positions and directions, eight component text obstacles, and 19 named nets.
Component/port IDs become readable `J_SD` / `J_SD.4` identifiers. Net membership
comes from source-port connectivity keys, not intersections in the screenshot.
V3V3 connects J_SD.4, J_SPI.2 and J_I2C.2; GND has 16 terminals, including shield
and mounting pins. USB0_VBUS remains a separate power net.

Other sheet components are omitted. Signals leaving this crop become named
one-pin nets. The fixture contains no pre-routed output or manually imposed
trace paths. All selected source connections are port-to-net connections, so
`directConnections` is empty.

This is reconstructed solver input, not a captured original solver invocation.
Label dimensions and text obstacles follow the current core conventions:
0.42 rail height; net text width `0.12 * (length + 1)` at 0.18 font size;
0.12 inline font size with proportionately smaller width; refdes clearance
0.06 with 0.01 overlap into the component. `maxMspPairDistance: 2.4` uses the
current core default; the deployment does not expose its original setting.

## What it reproduces

The original baseline routed V3V3 from J_SD.4 down and across to J_I2C.2, and routed GND
from J_SPI.1 down to J_I2C.1. J_SPI.2 has its own V3V3 label. Ground pin banks
on the connectors form short buses. The fixture generates these connections rather than hard-coding trace paths. The screenshot's external MMC0_DAT2/I2C0_SCL runs are intentionally
reduced to labeled stubs.

The standard snapshot includes both the solver debug view and the semantic
schematic renderer. Its diagnostic text boxes and generic label rendering are
not a pixel-for-pixel copy of the deployed site's rail symbols. Use the
pipeline debugger and stage artifacts to inspect actual placement geometry.

## Direction-aware rail recovery

Automatic recovery permits up to 1 schematic unit of downward travel toward
power labels or upward travel toward ground labels. The check follows each
candidate terminal's routed path to a shared label; it stops at that label,
rather than treating the other terminal's height as the rail height. The label
preview includes collision relocation so a crowded attachment point is not
mistaken for a usable rail. Existing retained labels are used directly during
late recovery. Total vertical travel to a shared rail is also capped at 4
schematic units, including travel in the preferred direction. Lateral travel
does not consume this vertical budget.

J_SD.4 keeps its own upward V3V3 label instead of descending to J_I2C.2.
Correct-direction joins remain eligible, including terminals with large
height differences. Primary routing, explicit source-wire groups, and buses
within one component retain their existing behavior. This is a recovery
preference, not a general prohibition on vertical wires in a power net.

## Run

```sh
bun install
bun test tests/repros/repro-am3352-sheet3-power-rails.test.ts
bun run debug:pipeline tests/repros/assets/repro-am3352-sheet3-power-rails.input.json --svg
bunx tsc --noEmit
```

For interactive investigation, run `bun start` and open
`SchematicTracePipelineSolver/repro-am3352-sheet3-power-rails` in Cosmos.

To intentionally update the baseline after an improvement:

```sh
BUN_UPDATE_SNAPSHOTS=1 bun test tests/repros/repro-am3352-sheet3-power-rails.test.ts
```
