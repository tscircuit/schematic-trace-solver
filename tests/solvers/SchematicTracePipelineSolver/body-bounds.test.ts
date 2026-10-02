import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputChip, InputProblem } from "lib/types/InputProblem"
import inputJson from "../../repros/assets/repro-rp2040-temperature-alarm.input.json"

// Quarter turns of the same asymmetric symbols, in schematic world mm
// (+X right, +Y up). In particular, NC pins must not move connected pins.
test.each([0, 1, 2, 3])(
  "body bounds preserve external pins after %i quarter turns",
  (turns) => {
    const input = structuredClone(inputJson) as unknown as InputProblem
    for (let turn = 0; turn < turns; turn++) {
      const rotate = (point: { x: number; y: number }) => ({
        x: -point.y,
        y: point.x,
      })
      for (const chip of input.chips) {
        chip.center = rotate(chip.center)
        ;[chip.width, chip.height] = [chip.height, chip.width]
        for (const pin of chip.pins) {
          Object.assign(pin, rotate(pin))
          if (pin._facingDirection) {
            pin._facingDirection = (
              { "x+": "y+", "y+": "x-", "x-": "y-", "y-": "x+" } as const
            )[pin._facingDirection]
          }
        }
      }
    }
    const original = structuredClone(input)
    const solver = new SchematicTracePipelineSolver(input)
    for (const chip of original.chips.filter(
      (chip) => chip.boundsMode === "body",
    )) {
      expect(
        solver.inputProblem.chips.find(
          (normalized) => normalized.chipId === chip.chipId,
        ),
      ).toEqual(chip)
    }
    expect(input).toEqual(original)
  },
)

const problemWithChip = (chip: InputChip): InputProblem => ({
  chips: [chip],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
})

test("body bounds still project an interior terminal along its known direction", () => {
  const solver = new SchematicTracePipelineSolver(
    problemWithChip({
      chipId: "custom",
      boundsMode: "body",
      center: { x: 0, y: 0 },
      width: 2,
      height: 1,
      pins: [{ pinId: "inside", x: 0, y: 0.4, _facingDirection: "x-" }],
    }),
  )
  expect(solver.inputProblem.chips[0]!.pins[0]).toEqual({
    pinId: "inside",
    x: -1,
    y: 0.4,
    _facingDirection: "x-",
  })
})

test.each([undefined, "include_pins"] as const)(
  "legacy bounds mode %s continues to include pins",
  (boundsMode) => {
    const solver = new SchematicTracePipelineSolver(
      problemWithChip({
        chipId: "legacy",
        boundsMode,
        center: { x: 0, y: 0 },
        width: 2,
        height: 1,
        pins: [{ pinId: "external", x: 3, y: 0, _facingDirection: "x+" }],
      }),
    )
    expect(solver.inputProblem.chips[0]!.width).toBe(6)
    expect(solver.inputProblem.chips[0]!.height).toBe(1)
  },
)
