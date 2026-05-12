import { expect, test } from "bun:test"
import { SingleOverlapSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/SingleOverlapSolver/SingleOverlapSolver"

const traceToReroute = {
  mspPairId: "vertical-main",
  dcConnNetId: "net-a",
  globalConnNetId: "net-a",
  userNetId: "A",
  pins: [
    { pinId: "A.1", x: 0, y: 0, chipId: "chip-a" },
    { pinId: "A.2", x: 0, y: 10, chipId: "chip-b" },
  ],
  tracePath: [
    { x: 0, y: 0 },
    { x: 0, y: 10 },
  ],
  mspConnectionPairIds: ["vertical-main"],
  pinIds: ["A.1", "A.2"],
}

const crossingTrace = {
  mspPairId: "right-side-crossing",
  dcConnNetId: "net-b",
  globalConnNetId: "net-b",
  userNetId: "B",
  pins: [
    { pinId: "B.1", x: 0.2, y: 5, chipId: "chip-c" },
    { pinId: "B.2", x: 2, y: 5, chipId: "chip-d" },
  ],
  tracePath: [
    { x: 0.2, y: 5 },
    { x: 2, y: 5 },
  ],
  mspConnectionPairIds: ["right-side-crossing"],
  pinIds: ["B.1", "B.2"],
}

test("SingleOverlapSolver prefers detours with fewer crossings", () => {
  const solver = new SingleOverlapSolver({
    trace: traceToReroute,
    label: {
      globalConnNetId: "blocking-label",
      netId: "LABEL",
      mspConnectionPairIds: [],
      pinIds: [],
      orientation: "x+",
      anchorPoint: { x: 0, y: 5 },
      width: 1,
      height: 1,
      center: { x: 0, y: 5 },
    },
    problem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
      maxMspPairDistance: 20,
    },
    paddingBuffer: 0.1,
    detourCount: 0,
    otherTraces: [crossingTrace],
  } as any)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.solvedTracePath?.some((point) => point.x < 0)).toBe(true)
  expect(solver.solvedTracePath?.some((point) => point.x > 0.5)).toBe(false)
})
