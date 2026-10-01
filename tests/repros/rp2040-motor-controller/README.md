# RP2040 motor controller section reproductions

These 24 independent tests capture routing baselines for all 115 schematic
components in [imrishabh18/rp2040-motor-controller v1.0.40](https://tscircuit.com/imrishabh18/rp2040-motor-controller/releases/cb88c834-87f2-42f1-8839-a2893dd7b77e).
There are 23 named routing sections across nine sheets and one additional fixture
for the seven unsectioned mounting holes and power test points.

Each test has its own input JSON and SVG snapshot. These are **current-behavior
reproductions**, not assertions that the schematic looks correct. They deliberately
preserve current placement and routing problems for later, section-specific fixes.
No production solver code or circuit source is changed.

```sh
bun test tests/repros/rp2040-motor-controller
bun test tests/repros/rp2040-motor-controller/controller-clock.test.ts
BUN_UPDATE_SNAPSHOTS=1 bun test tests/repros/rp2040-motor-controller
```

## Capture and isolation

Inputs were captured from the `solver:started` event during a schematic-only
render of the published source, using its lockfile and `@tscircuit/core@0.0.2032`.
All 115 captured component centers, sizes, rotations and symbol names were checked
against the published `dist/index/circuit.json`. The release ID, source checksum,
component ID/refdes mapping and per-section connection counts are in
[`assets/manifest.json`](assets/manifest.json).

The nine sheet inputs are split by `chip.sectionId`. The generator keeps the
original pin IDs, coordinates, obstacle dimensions, facing directions, direct
connections, label widths, orientation constraints and maximum pair distance.
Every direct connection has both endpoints in the same section; generation fails
if one crosses a boundary. Shared net connections retain only local endpoints,
so cross-section connectivity is represented by the original named nets. Text
obstacles follow their owning components. No components are omitted or duplicated.

For readable snapshots, chip IDs are replaced with their source reference
designators (also updating text-box ownership), `symbolName` is restored from
Circuit JSON, and human-readable net IDs receive matching `netLabelText` when
missing. These fields were omitted by the pinned core's older adapter. Restoring
symbol metadata also lets the current solver recognize passive component types.
The ratsnest visibility hint is set to hidden. Coordinates and electrical
connectivity are unchanged. The fixture is an isolated current-solver reproduction,
not a pixel-identical copy of the published full-sheet rendering.

The repository matcher stacks a solver debug view above its semantic schematic
view. Generic/custom chip symbols and text rendering can differ from the original
website; the committed routing geometry is the baseline under test.

## Sections

| Sheet | Test / snapshot | Source section | Components |
| --- | --- | --- | --- |
| `controller_programming` | [controller-programming-supply](controller-programming-supply.test.ts) | `MCU__programming_supply` | 4 |
| `controller_programming` | [controller-programming-bypass](controller-programming-bypass.test.ts) | `MCU__programming_bypass` | 4 |
| `controller_programming` | [controller-usb](controller-usb.test.ts) | `MCU__usb` | 5 |
| `controller_programming` | [controller-programming-flash](controller-programming-flash.test.ts) | `MCU__programming_flash` | 1 |
| `controller` | [controller-rp2040](controller-rp2040.test.ts) | `MCU__rp2040` | 10 |
| `controller` | [controller-controls](controller-controls.test.ts) | `MCU__controls` | 4 |
| `controller` | [controller-power](controller-power.test.ts) | `MCU__power` | 2 |
| `controller` | [controller-clock](controller-clock.test.ts) | `MCU__clock` | 4 |
| `controller` | [controller-status](controller-status.test.ts) | `MCU__status` | 2 |
| `controller` | [controller-debug](controller-debug.test.ts) | `MCU__debug` | 4 |
| `motor_driver` | [motor-driver-core](motor-driver-core.test.ts) | `motor_driver_core` | 18 |
| `motor_driver` | [motor-driver-outputs](motor-driver-outputs.test.ts) | `motor_driver_outputs` | 1 |
| `motor_power` | [motor-power-pd-negotiation](motor-power-pd-negotiation.test.ts) | `motor_power_pd_negotiation` | 5 |
| `motor_power` | [motor-power-filtering](motor-power-filtering.test.ts) | `motor_power_filtering` | 5 |
| `motor_power` | [motor-power-mounting-and-test-points](motor-power-mounting-and-test-points.test.ts) | `(unsectioned)` | 7 |
| `thermal_protection` | [thermal-protection](thermal-protection.test.ts) | `thermal_protection` | 5 |
| `position_alarm` | [alarm](alarm.test.ts) | `alarm` | 5 |
| `position_alarm` | [feedback-supply](feedback-supply.test.ts) | `feedback_supply` | 3 |
| `position_alarm` | [encoder](encoder.test.ts) | `encoder` | 3 |
| `current_telemetry` | [phase-a](phase-a.test.ts) | `phase_A` | 4 |
| `current_telemetry` | [current-supply](current-supply.test.ts) | `current_supply` | 2 |
| `current_telemetry` | [phase-b](phase-b.test.ts) | `phase_B` | 4 |
| `status_led` | [rgb](rgb.test.ts) | `rgb` | 7 |
| `pd_voltage_control` | [pd-gpio-buffers](pd-gpio-buffers.test.ts) | `pd_gpio_buffers` | 6 |

## Recapture

Use the source files from the release linked above, with `bun install
--frozen-lockfile`. Save this script as `capture.tsx` in that circuit checkout and
run `bun capture.tsx`. PCB generation is disabled; no routing or layout props are
edited.

```tsx
import { Circuit } from "@tscircuit/core"
import Board from "./index.circuit"
import { mkdirSync, writeFileSync } from "node:fs"

mkdirSync("capture", { recursive: true })
const circuit = new Circuit({ platform: { pcbDisabled: true } })
let index = 0
circuit.on("solver:started", (event) => {
  if (event.solverName !== "SchematicTracePipelineSolver") return
  writeFileSync(
    `capture/input-${index++}.json`,
    JSON.stringify(event.solverParams, null, 2),
  )
})
circuit.add(<Board routingDisabled />)
await circuit.renderUntilSettled()
writeFileSync(
  "capture/circuit.json",
  JSON.stringify(circuit.getCircuitJson(), null, 2),
)
```

From this repository, pass the capture directory and the downloaded published
Circuit JSON to the generator. It verifies component geometry before writing the
fixtures, individual test files and manifest. Review SVG changes before committing.

```sh
python3 tests/repros/rp2040-motor-controller/generate-fixtures.py \
  /path/to/circuit/capture /path/to/published/circuit.json
bunx biome format --write tests/repros/rp2040-motor-controller
BUN_UPDATE_SNAPSHOTS=1 bun test tests/repros/rp2040-motor-controller
bun test tests/repros/rp2040-motor-controller
```
