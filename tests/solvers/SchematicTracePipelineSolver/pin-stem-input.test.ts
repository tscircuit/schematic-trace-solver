import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver, type InputProblem } from "lib/index"

test.each([-1.5, -0.5])(
  "preserves stem geometry and chip bounds for terminal y=%p",
  (terminalY) => {
    // A caller-supplied obstacle can contain the original terminal. Projecting
    // that terminal must not translate the already-drawn symbol geometry.
    const input: InputProblem = {
      chips: [
        {
          chipId: "Q1",
          center: { x: 0, y: 0 },
          width: 2,
          height: 2,
          pins: [
            {
              pinId: "Q1.S",
              x: 0.5,
              y: terminalY,
              _facingDirection: "y-",
              stem: {
                from: { x: 0.5, y: terminalY },
                to: { x: 0.5, y: terminalY + 0.635 },
              },
            },
            { pinId: "Q1.D", x: 0.5, y: 1.5 },
          ],
        },
      ],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    }
    const original = structuredClone(input)
    const solver = new SchematicTracePipelineSolver(input)
    const [normalized] = solver.getConstructorParams()
    const chip = normalized.chips[0]!
    const pin = chip.pins[0]!

    expect(pin.y).toBe(terminalY < -1 ? terminalY : -1)
    expect(pin.stem).toEqual(original.chips[0]!.pins[0]!.stem)
    expect({ ...chip, pins: original.chips[0]!.pins }).toEqual(
      original.chips[0]!,
    )
    expect(chip.pins[1]).toEqual(original.chips[0]!.pins[1])

    // Exporting/replaying constructor input retains the segment, while the
    // pipeline's nested geometry remains isolated from the caller's objects.
    const replay = new SchematicTracePipelineSolver(
      JSON.parse(JSON.stringify(normalized)),
    )
    expect(replay.inputProblem.chips[0]!.pins[0]!.stem).toEqual(pin.stem)
    pin.stem!.to.y = 10
    expect(input).toEqual(original)
    expect(replay.inputProblem.chips[0]!.pins[0]!.stem).toEqual(
      original.chips[0]!.pins[0]!.stem,
    )
  },
)
