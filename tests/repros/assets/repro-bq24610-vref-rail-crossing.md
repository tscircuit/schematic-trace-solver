# BQ24610 automatic VREF rail crossing

## Provenance

The circuit comes from [mukesh-dev-git/usbc-pd-3s-charger, version 1.0.0](https://tscircuit.com/mukesh-dev-git/usbc-pd-3s-charger?version=1.0.0#schematic), release `7f071791-0b82-4477-936e-47423aed688b`.

The input was captured from `solver:started` / `SchematicTracePipelineSolver` in `@tscircuit/core@0.0.2132`, rendering `createChargerChipDiodeCapacitor(true)` from [this four-component charger extract](https://github.com/tscircuit/circuit-json-schematic-placement-analysis/blob/8eb075dd174de705bddb06bfe2c08f047b6e3c41/tests/assets/charger-chip-diode-capacitor/index.tsx). That extract adjusts the right-side bootstrap components; U2's coordinates, pin layout and left-side VREF/VCC_CHG connections are unchanged. Its traces connect U2.ACSET and U2.VREF to `net.VREF`; it contains no manual `<netlabel />`.

The captured input was reduced by removing D2, C7, C5, their direct connections, and the GND/PH nets and orientation entries. U2's complete pin geometry, text obstacles, the two remaining net connections, label dimensions, upward orientations and routing-distance setting are unchanged. No wire or label positions were supplied or edited. The reduced input and the four-component capture both produce the same VREF anchor and three crossings on solver main `c59ce42` (0.0.240).

## Reproduced behavior

VCC_CHG joins VCC (24), ACP (2) and ACN (1). VREF joins ACSET (16) and VREF (10), below those supply pins. The pipeline places VREF's upward rail at approximately `(2.65, 1.451)`. Its vertical connector crosses all three unrelated supply wires. This is a routing/readability defect; the two nets remain distinct.

A correction should keep the automatic upward VREF rail connected to ACSET/VREF, preserve the chip pin layout, and avoid these unnecessary crossings without creating label overlaps or a longer detour around the chip. The passing repro asserts the current three crossings, explicitly as known bad behavior; a fix should change that expectation to zero.

The snapshot uses the repository's semantic Circuit JSON converter. The test restores the original power-rail names/style and hides routing text-box outlines only for rendering. Routes and label anchors come directly from the pipeline.

## Run

```sh
bun test tests/repros/repro-bq24610-vref-rail-crossing.test.ts
bun run debug:pipeline tests/repros/assets/repro-bq24610-vref-rail-crossing.input.json --svg
```

An interactive fixture is available at `SchematicTracePipelineSolver/repro-bq24610-vref-rail-crossing` in Cosmos.
