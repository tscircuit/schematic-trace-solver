import { expect, test } from "bun:test"
import { SchematicTraceSingleLineSolver2 } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import type { InputChip, InputProblem } from "lib/types/InputProblem"

test("routes an ambiguous corner pin through any collision-free outward edge", () => {
  const firstChip: InputChip = {
    chipId: "U1",
    center: { x: 0, y: 0 },
    width: 2,
    height: 2,
    pins: [
      { pinId: "U1.1", x: -1, y: 1 },
      { pinId: "U1.2", x: 1, y: 0 },
      { pinId: "U1.3", x: 0, y: -1 },
    ],
  }
  const secondChip: InputChip = {
    chipId: "U2",
    center: { x: -4, y: 0.1 },
    width: 2,
    height: 2,
    pins: [
      { pinId: "U2.1", x: -3, y: 1.1 },
      { pinId: "U2.2", x: -5, y: 0 },
      { pinId: "U2.3", x: -4, y: -0.9 },
    ],
  }
  const obstacle: InputChip = {
    chipId: "OBS",
    center: { x: -2, y: 1.05 },
    width: 0.5,
    height: 0.3,
    pins: [],
  }
  const pins: ConstructorParameters<
    typeof SchematicTraceSingleLineSolver2
  >[0]["pins"] = [
    { ...firstChip.pins[0]!, chipId: firstChip.chipId },
    { ...secondChip.pins[0]!, chipId: secondChip.chipId },
  ]
  const inputProblem: InputProblem = {
    chips: [firstChip, secondChip, obstacle],
    directConnections: [{ pinIds: [pins[0].pinId, pins[1].pinId] }],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  const solver = new SchematicTraceSingleLineSolver2({
    pins,
    chipMap: {
      [firstChip.chipId]: firstChip,
      [secondChip.chipId]: secondChip,
      [obstacle.chipId]: obstacle,
    },
    inputProblem,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(pins[0]._facingDirection).toBe("y+")
  expect(["x+", "y+"]).toContain(pins[1]._facingDirection!)
})
