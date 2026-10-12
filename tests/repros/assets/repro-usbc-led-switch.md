# USB-C LED switch schematic

Source: [pixalynx/usbc-led-switch](https://tscircuit.com/pixalynx/usbc-led-switch#files),
version `0.0.1`, release `16479d74-f356-4246-9984-2722eb516d85`.

The fixture contains the complete six-component schematic: J1 (USB-C), R1/R2
(5.1 kΩ CC pull-downs), SW1 (LG-15F SPST), R3 (100 Ω), and LED1 (white).
It preserves all 20 pins, the five named direct connections (`CC1`, `CC2`,
`VBUS`, `SW_OUT`, `LED_A`), and the nine-pin GND net. J1.VBUS2 remains
unconnected, as in the source.

## Capture

Captured on 2026-10-12 using `@tscircuit/core` `0.0.2132` from the release's
[compiled source](https://pixalynx--usbc-led-switch-v0-0-1.tscircuit.app/index.js).
The four OBJ imports were replaced with unused URL strings, and PCB/CAD
rendering was disabled on the `Circuit`. Schematic props, placements, pin
arrangements, connections, and trace names were left unchanged.

With `DEBUG=Group_doInitialSchematicTraceRender`, the
`debug:logOutput` event named `group-trace-render-input-problem` was saved
before solver construction/normalization. Component centers, sizes, symbols,
and pin positions were checked against the
[published Circuit JSON](https://pixalynx--usbc-led-switch-v0-0-1.tscircuit.app/index/circuit.json)
and match it. The capture uses Core's default `maxMspPairDistance: 2.4`.

Only display annotations were added to the saved input:

- Component IDs and their text-box references were renamed to source names.
- Oriented `symbolName` values were copied from the rendered components.
- `netLabelText` was set to the existing named net/trace IDs.

Pin IDs, geometry (including expanded obstacle bounds), connection membership,
label dimensions, and routing options are unchanged from the raw capture.

SHA-256 checksums:

| Artifact | SHA-256 |
| --- | --- |
| Published `index.js` | `bf3602ba14fa7e27044049b8a59cb1dc9804bdca8cb4103016c2c9a73ac1fcdc` |
| Published `index/circuit.json` | `5842ca96173cc2ef149a3b479764d4e806004ca4188f2ab45bfa0989081a93b6` |
| Raw captured input, before annotations | `4dcc92533b150bd08de02e1e90c1622381a63ee75d8824313febb662a8804eb8` |

## Reproduce

```sh
bun test tests/repros/repro-usbc-led-switch.test.ts
bun run debug:pipeline tests/repros/assets/repro-usbc-led-switch.input.json
```

For interactive inspection, run `bun start` and open
`SchematicTracePipelineSolver/repro-usbc-led-switch`.

This is a snapshot of current solver behavior, with no routing algorithm
changes. The published schematic splits CC1 into two inline-labeled stubs;
the solver at base commit `337c60c0de49b800c42e50400b71fc219b762c87`
routes CC1 continuously. The fixture reproduces the source circuit and its
placement, rather than asserting that the older published routing persists.
