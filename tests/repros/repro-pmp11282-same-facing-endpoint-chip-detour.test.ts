import { expect, test } from "bun:test"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { SchematicTraceSingleLineSolver2 } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import type { InputChip, InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const upperCapacitor: InputChip = {
  chipId: "C510",
  center: { x: 3.7825, y: 4.097125 },
  width: 1.165,
  height: 0.76,
  pins: [
    {
      pinId: "C510.pin1",
      x: 3.65,
      y: 4.477125,
      _facingDirection: "y+",
    },
    {
      pinId: "C510.pin2",
      x: 3.65,
      y: 3.717125,
      _facingDirection: "y-",
    },
  ],
}

const lowerCapacitor: InputChip = {
  chipId: "C517",
  center: { x: 3.6, y: 1.925375 },
  width: 1.165,
  height: 0.76,
  pins: [
    {
      pinId: "C517.pin1",
      x: 3.4675,
      y: 2.305375,
      _facingDirection: "y+",
    },
    {
      pinId: "C517.pin2",
      x: 3.4675,
      y: 1.545375,
      _facingDirection: "y-",
    },
  ],
}

const pins: MspConnectionPair["pins"] = [
  { ...upperCapacitor.pins[0]!, chipId: upperCapacitor.chipId },
  { ...lowerCapacitor.pins[0]!, chipId: lowerCapacitor.chipId },
]

const connectionPair: MspConnectionPair = {
  mspPairId: "C510.pin1-C517.pin1",
  dcConnNetId: "C517.pin1 to C510.pin1",
  globalConnNetId: "C517.pin1 to C510.pin1",
  userNetId: "C517.pin1 to C510.pin1",
  pins,
}

const inputProblem: InputProblem = {
  chips: [upperCapacitor, lowerCapacitor],
  directConnections: [
    {
      netId: "C517.pin1 to C510.pin1",
      pinIds: [pins[0].pinId, pins[1].pinId],
    },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
}

test("PMP11282 same-facing pins fail to detour around the endpoint chip", () => {
  const solver = new SchematicTraceSingleLineSolver2({
    pins,
    connectionPair,
    inputProblem,
    chipMap: {
      [upperCapacitor.chipId]: upperCapacitor,
      [lowerCapacitor.chipId]: lowerCapacitor,
    },
    preferExteriorDetours: true,
  })

  solver.solve()

  expect(solver.solved).toBe(false)
  expect(solver.failed).toBe(true)
  expect(solver.error).toBe("No collision-free path found")
  expect(solver.solvedTracePath).toBeNull()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
