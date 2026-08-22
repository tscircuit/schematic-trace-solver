import { expect, test } from "bun:test"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"

test("closes a sub-minimum gap between a chip and its attached text", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 2.6,
        height: 1,
        pins: [],
      },
    ],
    directConnections: [],
    netConnections: [],
    textBoxes: [
      {
        chipId: "U1",
        center: { x: 0.06, y: -0.63 },
        width: 1.92,
        height: 0.18,
        text: "TYPE_C_16PIN_2MD",
      },
      {
        chipId: "U1",
        center: { x: 0, y: -0.9 },
        width: 1,
        height: 0.2,
        text: "clear gap",
      },
    ],
    availableNetLabelOrientations: {},
  }

  const textObstacles = getObstacleRects(inputProblem).filter(
    (obstacle) => obstacle.kind === "text_box",
  )

  expect(textObstacles[0]!.maxY).toBe(-0.5)
  expect(textObstacles[1]!.maxY).toBe(-0.8)
})
