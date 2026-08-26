import { expect, test } from "bun:test"
import { LongDistancePairSolver } from "lib/solvers/LongDistancePairSolver/LongDistancePairSolver"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { getGroundConnectionPolicy } from "lib/solvers/MspConnectionPairSolver/getGroundConnectionPolicy"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

// The explicit A-B and C-D wires are farther apart than their neighbors on
// the same named net. E is label-only, with no requested physical connection.
const createInput = (): InputProblem => ({
  chips: [0, 4, 1, 5, 2].map((x, index) => {
    const chipId = "ABCDE"[index]!
    return {
      chipId,
      center: { x, y: 0 },
      width: 0.2,
      height: 0.2,
      pins: [{ pinId: chipId, x, y: 0.1, _facingDirection: "y+" }],
    }
  }),
  directConnections: [
    { pinIds: ["A", "B"], netId: "AGND" },
    { pinIds: ["C", "D"], netId: "AGND" },
  ],
  netConnections: [
    { netId: "AGND", pinIds: ["A", "B", "C", "D", "E"], isGround: true },
  ],
  availableNetLabelOrientations: { AGND: ["y+"] },
  maxMspPairDistance: 100,
})

const pairKeys = (solver: MspConnectionPairSolver) =>
  solver.mspConnectionPairs
    .map((pair) =>
      pair.pins
        .map((pin) => pin.pinId)
        .sort()
        .join("-"),
    )
    .sort()

test("marked ground nets retain explicit islands even with identical netIds", () => {
  const inputProblem = createInput()
  const canRoute = getGroundConnectionPolicy(inputProblem)
  expect(canRoute("A", "B")).toBe(true)
  expect(canRoute("C", "D")).toBe(true)
  expect(canRoute("A", "C")).toBe(false)
  expect(canRoute("A", "E")).toBe(false)

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()
  expect(pairKeys(solver)).toEqual(["A-B", "C-D"])
  // Physical partitioning must not split the electrical net.
  expect(solver.globalConnMap.getNetConnectedToId("A")).toBe(
    solver.globalConnMap.getNetConnectedToId("E"),
  )
})

test.each([false, undefined])(
  "isGround=%s preserves automatic net routing",
  (isGround) => {
    const inputProblem = createInput()
    inputProblem.netConnections[0]!.isGround = isGround
    const solver = new MspConnectionPairSolver({ inputProblem })
    solver.solve()
    expect(getGroundConnectionPolicy(inputProblem)("A", "C")).toBe(true)
    expect(solver.mspConnectionPairs).toHaveLength(4)
  },
)

test("ground nets without explicit wires retain automatic shared buses", () => {
  const inputProblem = createInput()
  inputProblem.directConnections = []
  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()
  expect(getGroundConnectionPolicy(inputProblem)("A", "C")).toBe(true)
  expect(solver.mspConnectionPairs).toHaveLength(4)
})

test("long-distance recovery cannot reconnect separate ground islands", () => {
  const inputProblem = createInput()
  const solver = new LongDistancePairSolver({
    inputProblem,
    alreadySolvedTraces: [],
    primaryMspConnectionPairs: [],
    failedConnectionPairs: [],
  })
  solver.solve()
  expect(solver.solvedLongDistanceTraces.length).toBeGreaterThan(0)
  for (const trace of solver.solvedLongDistanceTraces) {
    expect(["A-B", "C-D"]).toContain([...trace.pinIds].sort().join("-"))
  }
})

test("explicit ground connections still respect distance and section limits", () => {
  const inputProblem = createInput()
  inputProblem.maxMspPairDistance = 0.5
  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()
  expect(solver.mspConnectionPairs).toHaveLength(0)

  inputProblem.maxMspPairDistance = 100
  inputProblem.chips[0]!.sectionId = "left"
  inputProblem.chips[1]!.sectionId = "right"
  const sectionSolver = new MspConnectionPairSolver({ inputProblem })
  sectionSolver.solve()
  expect(pairKeys(sectionSolver)).toEqual(["C-D"])
})

test("label-only ground pins remain connected in the pipeline output", () => {
  const solver = new SchematicTracePipelineSolver(createInput())
  solver.solve()
  const output = solver.netLabelToTraceSolver!.getOutput()
  expect(solver.solved).toBe(true)
  expect(
    output.netLabelPlacements.some(
      (label) => label.netId === "AGND" && label.pinIds.includes("E"),
    ),
  ).toBe(true)
})
