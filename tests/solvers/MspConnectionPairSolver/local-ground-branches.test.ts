import { expect, test } from "bun:test"
import { LongDistancePairSolver } from "lib/solvers/LongDistancePairSolver/LongDistancePairSolver"
import { getGroundConnectionPolicy } from "lib/solvers/MspConnectionPairSolver/getGroundConnectionPolicy"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { createParallelGroundRailProblem } from "tests/fixtures/parallel-ground-rail"

test("keeps a wired parallel ground rail but labels independent staggered branches", () => {
  const inputProblem = createParallelGroundRailProblem()
  const before = structuredClone(inputProblem)
  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()
  expect(solver.mspConnectionPairs).toHaveLength(2)
  const routed = new Set(
    solver.mspConnectionPairs.flatMap((pair) =>
      pair.pins.map((pin) => pin.pinId),
    ),
  )
  expect([...routed].sort()).toEqual(["A.2", "B.2", "U.GND"])
  expect(inputProblem).toEqual(before)
})

test("long-distance recovery does not reconnect the separated ground branches", () => {
  const inputProblem = createParallelGroundRailProblem()
  const primary = new MspConnectionPairSolver({ inputProblem })
  primary.solve()
  const solver = new LongDistancePairSolver({
    inputProblem,
    primaryMspConnectionPairs: primary.mspConnectionPairs,
    alreadySolvedTraces: [],
    failedConnectionPairs: [],
  })
  solver.solve()
  expect(solver.getOutput().newTraces).toEqual([])
})

test("the branch policy is symmetric in its endpoints", () => {
  const canRoute = getGroundConnectionPolicy(createParallelGroundRailProblem())
  expect(canRoute("B.2", "C.2")).toBe(false)
  expect(canRoute("C.2", "B.2")).toBe(false)
  expect(canRoute("C.2", "D.2")).toBe(false)
  expect(canRoute("D.2", "C.2")).toBe(false)
})

test("explicit direct wiring overrides the local-ground preference", () => {
  const inputProblem = createParallelGroundRailProblem()
  inputProblem.directConnections.push({ pinIds: ["B.2", "C.2"] })
  const canRoute = getGroundConnectionPolicy(inputProblem)
  expect(canRoute("B.2", "C.2")).toBe(true)
  expect(canRoute("A.2", "C.2")).toBe(true)
  expect(canRoute("C.2", "D.2")).toBe(false)
})

for (const y of [1, 0.5, 0]) {
  test(`keeps level or nearby ground pins at y=${y} on the rail`, () => {
    const inputProblem = createParallelGroundRailProblem()
    inputProblem.chips[2]!.pins[1]!.y = y
    const canRoute = getGroundConnectionPolicy(inputProblem)
    expect(canRoute("B.2", "C.2")).toBe(true)
  })
}

test("preserves existing behavior without an explicitly wired parallel rail", () => {
  const inputProblem = createParallelGroundRailProblem()
  inputProblem.directConnections = []
  expect(getGroundConnectionPolicy(inputProblem)("B.2", "C.2")).toBe(true)
})

test("a repeated direct-connection net ID does not invent a physical rail", () => {
  const inputProblem = createParallelGroundRailProblem()
  inputProblem.directConnections = [
    { netId: "GND", pinIds: ["A.2", "U.GND"] },
    { netId: "GND", pinIds: ["B.2", "D.2"] },
  ]
  expect(getGroundConnectionPolicy(inputProblem)("B.2", "C.2")).toBe(true)
})

test("resolves a ground alias through global connectivity", () => {
  const inputProblem = createParallelGroundRailProblem()
  inputProblem.netConnections[0]!.netId = "RETURN"
  inputProblem.netConnections.push({ netId: "GND", pinIds: ["U.GND"] })
  expect(getGroundConnectionPolicy(inputProblem)("B.2", "C.2")).toBe(false)
})

test("does not apply the ground rule to power or signal nets", () => {
  const inputProblem = createParallelGroundRailProblem()
  inputProblem.netConnections[0]!.netId = "VDD"
  expect(getGroundConnectionPolicy(inputProblem)("B.2", "C.2")).toBe(true)
})

test("infers ground-facing pins when explicit directions are absent", () => {
  const inputProblem = createParallelGroundRailProblem()
  for (const chip of inputProblem.chips) {
    for (const pin of chip.pins) delete pin._facingDirection
  }
  expect(getGroundConnectionPolicy(inputProblem)("B.2", "C.2")).toBe(false)
})

test("does not isolate side-facing or multi-pin components", () => {
  const inputProblem = createParallelGroundRailProblem()
  inputProblem.chips[2]!.pins[1]!._facingDirection = "x-"
  expect(getGroundConnectionPolicy(inputProblem)("B.2", "C.2")).toBe(true)
  inputProblem.chips[2]!.pins[1]!._facingDirection = "y-"
  inputProblem.chips[2]!.pins.push({ pinId: "C.3", x: 2, y: -1.6 })
  expect(getGroundConnectionPolicy(inputProblem)("B.2", "C.2")).toBe(true)
})
