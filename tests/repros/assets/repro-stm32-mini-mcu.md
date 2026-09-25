# STM32 mini dev board MCU sheet

Source: `stm32-mini-dev-board-v1-a-2.json`, sheet `mcu`
(`schematic_sheet_1`, display name `STM32 and reset`).
Source SHA-256: `ef8a7c2fa184f2c3ee0ea9a35aa870b7ce96a02da467a6f68af35777a32684c1`.

The fixture contains U1, C3, C4, R2, C5, and SW_RST: 42 pins and
25 net-connection entries, including connections to the other sheets.

## Reconstruction

The exported Circuit JSON was loaded into Core's Circuit JSON database.
`createSchematicTraceSolverInputProblem` was called for `schematic_group_0`
in `subcircuit_source_group_0`, with `schematicSheetId: "schematic_sheet_1"`.
The full source connectivity was retained while selecting only MCU-sheet
schematic components. Existing routed traces and net-label placements were
not used as routing input.

Core version: `0.0.1986`, commit
`61738f8c3501f390a66db98edc44145931efd399`.
Solver base: `0.0.210`, commit
`0113d5f31bd3959a5320630d232410b10359e90a`.

After conversion, chip IDs and their text-box references were bijectively
renamed to the unique source component names. Symbol names were copied from
the schematic components. Named source nets supply `netLabelText` where Core
emitted only the net name as `netId`, so the snapshot shows readable labels.
Pin IDs, coordinates, connection entries, text bounds, label dimensions, and
orientation constraints were preserved from the converter output.

This is a reconstruction from completed Circuit JSON, not a captured original
pre-routing solver input. The export does not contain the original component
instances or props. Conversion used an empty Core group backed by the exported
database, no explicit NetLabel instances, and Core's default maximum trace
distance of 2.4. Exact equivalence with the original render is not claimed.

Run `bun test tests/repros/repro-stm32-mini-mcu.test.ts` to reproduce the
current routing and combined debug/schematic snapshot. This PR records the
current behavior without changing the routing algorithm.
