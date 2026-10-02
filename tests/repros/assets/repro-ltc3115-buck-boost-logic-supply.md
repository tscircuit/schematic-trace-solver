# LTC3115 buck-boost logic supply

This fixture reconstructs the attached "02 - Buck-boost logic supply" image
(`repro-ltc3115-buck-boost-logic-supply.source.png`). It is manually transcribed
solver input, rather than a captured Core input or an electrical simulation.

The 18 components retain their approximate source positions and orientations,
the LTC3115's 21 numbered pins and display names, and all 15 named nets.
Coordinates use 72 image pixels per schematic unit, with the chip centered at
the origin and image y inverted. Component values and the MPN are text obstacles.
Direct connections describe the visible wired islands; named net connections
describe their shared electrical connectivity. Ground islands are marked with
`isGround`. Ambiguous crossings around the chip are transcribed according to
the numbered pin functions and the named nets; the source image is retained
for review. This is a routing reproduction, not a pixel-identical drawing.

The unmodified production pipeline uses its default routing distance. Bootstrap,
feedback, timing, feed-forward and compensation signals opt into inline labels.
The snapshot includes both solver debug graphics and schematic symbols.

Run the reproduction:

```sh
bun test tests/repros/repro-ltc3115-buck-boost-logic-supply.test.ts
bun run debug:pipeline tests/repros/assets/repro-ltc3115-buck-boost-logic-supply.input.json --svg
```

The Cosmos page is
`site/SchematicTracePipelineSolver/repro-ltc3115-buck-boost-logic-supply.page.tsx`.

## Recovered feed-forward wire

The source explicitly wires `R_FF.2` to `C_FF.1` on `FF_C`. The baseline replaced
this with two outward inline-label stubs: inline conversion removed the fallback
anchored labels before final trace recovery could see them. The pre-inline
recovery stage now restores the explicit wire using the existing routing and
collision checks. Inline conversion then places one label on that real trace.

## Recovered feedback elbow

The source also explicitly wires `C_FF.2` to `R_FB_BOT.1` on `LOGIC_FB`.
Those terminals already belong to two routed islands, with fallback labels
far apart. Pre-inline recovery now accepts their single outward elbow when it
passes the existing obstacle, label, crossing, and section checks. All four
feedback passives share one physical trace component and one inline label;
the chip's separate `LOGIC_FB` stub is retained. This exception applies only
before inline conversion, preserving final recovery's rail-label behavior.
