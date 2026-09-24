import { expect, test } from "bun:test"
import { LongDistancePairSolver } from "lib/solvers/LongDistancePairSolver/LongDistancePairSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "first",
      center: { x: 1, y: 0 },
      width: 2,
      height: 1,
      pins: [
        { pinId: "a", x: 0, y: 0, _facingDirection: "x-" },
        { pinId: "first-signal", x: 2, y: 0.2 },
        { pinId: "first-power", x: 2, y: -0.2 },
      ],
    },
    {
      chipId: "second",
      center: { x: 1, y: 4 },
      width: 2,
      height: 1,
      pins: [
        { pinId: "b", x: 0, y: 4, _facingDirection: "x-" },
        { pinId: "second-signal", x: 2, y: 4.2 },
        { pinId: "second-power", x: 2, y: 3.8 },
      ],
    },
    {
      chipId: "third",
      center: { x: 1, y: 8 },
      width: 2,
      height: 1,
      pins: [
        { pinId: "c", x: 0, y: 8, _facingDirection: "x-" },
        { pinId: "third-signal", x: 2, y: 8.2 },
        { pinId: "third-power", x: 2, y: 7.8 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    { netId: "return", isGround: true, pinIds: ["a", "b", "c"] },
  ],
  availableNetLabelOrientations: { return: ["y-"] },
  maxMspPairDistance: 2.4,
}

test("leaves distant ground pins for net labels regardless of net name", () => {
  const solver = new LongDistancePairSolver({
    inputProblem: structuredClone(inputProblem),
    primaryMspConnectionPairs: [],
    alreadySolvedTraces: [],
    failedConnectionPairs: [],
  })
  solver.solve()
  expect(solver.getOutput().newTraces).toHaveLength(0)
})

test("routes ground pins within the configured distance", () => {
  const problem = structuredClone(inputProblem)
  problem.maxMspPairDistance = 4
  const solver = new LongDistancePairSolver({
    inputProblem: problem,
    primaryMspConnectionPairs: [],
    alreadySolvedTraces: [],
    failedConnectionPairs: [],
  })
  solver.solve()
  expect(solver.getOutput().newTraces).toHaveLength(1)
})

test("keeps long-distance recovery for multi-pin signal nets", () => {
  const problem = structuredClone(inputProblem)
  problem.netConnections[0]!.isGround = false
  const solver = new LongDistancePairSolver({
    inputProblem: problem,
    primaryMspConnectionPairs: [],
    alreadySolvedTraces: [],
    failedConnectionPairs: [],
  })
  solver.solve()
  expect(solver.getOutput().newTraces).toHaveLength(1)
})

test("preserves explicit ground wires beyond the local distance", () => {
  const problem = structuredClone(inputProblem)
  problem.directConnections = [{ pinIds: ["a", "b"] }]
  const solver = new LongDistancePairSolver({
    inputProblem: problem,
    primaryMspConnectionPairs: [],
    alreadySolvedTraces: [],
    failedConnectionPairs: [],
  })
  solver.solve()
  expect(solver.getOutput().newTraces).toHaveLength(1)
})

test("preserves a ground return between side-by-side connectors with staggered pins", () => {
  const problem = structuredClone(inputProblem)
  problem.chips[0]!.pins = [
    { pinId: "a", x: 2, y: 0, _facingDirection: "x+" },
    { pinId: "first-signal", x: 0, y: 0.2 },
    { pinId: "first-power", x: 0, y: -0.2 },
  ]
  problem.chips[1] = {
    chipId: "second",
    center: { x: 6, y: 0 },
    width: 2,
    height: 1,
    pins: [
      { pinId: "b", x: 5, y: 0.2, _facingDirection: "x-" },
      { pinId: "second-signal", x: 7, y: 0.2 },
      { pinId: "second-power", x: 7, y: -0.2 },
    ],
  }
  const solver = new LongDistancePairSolver({
    inputProblem: problem,
    primaryMspConnectionPairs: [],
    alreadySolvedTraces: [],
    failedConnectionPairs: [],
  })
  solver.solve()
  expect(solver.getOutput().newTraces.map((trace) => trace.pinIds)).toEqual([
    ["a", "b"],
  ])
})
