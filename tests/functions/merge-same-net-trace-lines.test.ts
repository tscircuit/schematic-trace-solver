import { expect, test } from "bun:test"
import { SameNetTraceLineMergeSolver } from "lib/solvers/SameNetTraceLineMergeSolver/SameNetTraceLineMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const emptyInput: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

function makeTrace(
  mspPairId: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath {
  return {
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [
      { pinId: `${mspPairId}.a`, x: 0, y: 0, chipId: "c0" },
      { pinId: `${mspPairId}.b`, x: 1, y: 0, chipId: "c0" },
    ],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}.a`, `${mspPairId}.b`],
  }
}

function mergeMap(
  map: Record<string, SolvedTracePath>,
  tolerance = 0.01,
): Record<string, SolvedTracePath> {
  const solver = new SameNetTraceLineMergeSolver({
    inputProblem: emptyInput,
    correctedTraceMap: map,
    tolerance,
  })
  solver.solve()
  return solver.mergedTraceMap
}

test("T1 two horizontal same net same Y=1 merge to one segment 0–5", () => {
  const map = {
    a: makeTrace("a", "net1", [
      { x: 0, y: 1 },
      { x: 3, y: 1 },
    ]),
    b: makeTrace("b", "net1", [
      { x: 2, y: 1 },
      { x: 5, y: 1 },
    ]),
  }
  const out = mergeMap(map)
  expect(out.a!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 5, y: 1 },
  ])
  expect(out.b!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 5, y: 1 },
  ])
})

test("T2 two horizontal Y differs by 0.005 merge at Y=1.0025 x=0–5", () => {
  const map = {
    a: makeTrace("a", "net1", [
      { x: 0, y: 1.0 },
      { x: 3, y: 1.0 },
    ]),
    b: makeTrace("b", "net1", [
      { x: 2, y: 1.005 },
      { x: 5, y: 1.005 },
    ]),
  }
  const out = mergeMap(map)
  expect(out.a!.tracePath).toEqual([
    { x: 0, y: 1.0025 },
    { x: 5, y: 1.0025 },
  ])
  expect(out.b!.tracePath).toEqual([
    { x: 0, y: 1.0025 },
    { x: 5, y: 1.0025 },
  ])
})

test("T3 two horizontal Y differs by 0.02 stay separate", () => {
  const map = {
    a: makeTrace("a", "net1", [
      { x: 0, y: 1.0 },
      { x: 3, y: 1.0 },
    ]),
    b: makeTrace("b", "net1", [
      { x: 2, y: 1.02 },
      { x: 5, y: 1.02 },
    ]),
  }
  const out = mergeMap(map)
  expect(out.a!.tracePath).toEqual([
    { x: 0, y: 1.0 },
    { x: 3, y: 1.0 },
  ])
  expect(out.b!.tracePath).toEqual([
    { x: 2, y: 1.02 },
    { x: 5, y: 1.02 },
  ])
})

test("T4 two vertical same net same X=2 merge to y=0–7", () => {
  const map = {
    a: makeTrace("a", "net1", [
      { x: 2, y: 0 },
      { x: 2, y: 4 },
    ]),
    b: makeTrace("b", "net1", [
      { x: 2, y: 3 },
      { x: 2, y: 7 },
    ]),
  }
  const out = mergeMap(map)
  expect(out.a!.tracePath).toEqual([
    { x: 2, y: 0 },
    { x: 2, y: 7 },
  ])
  expect(out.b!.tracePath).toEqual([
    { x: 2, y: 0 },
    { x: 2, y: 7 },
  ])
})

test("T5 different nets VCC vs GND same Y not merged", () => {
  const map = {
    v: makeTrace("v", "VCC", [
      { x: 0, y: 1 },
      { x: 3, y: 1 },
    ]),
    g: makeTrace("g", "GND", [
      { x: 2, y: 1 },
      { x: 5, y: 1 },
    ]),
  }
  const out = mergeMap(map)
  expect(out.v!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 3, y: 1 },
  ])
  expect(out.g!.tracePath).toEqual([
    { x: 2, y: 1 },
    { x: 5, y: 1 },
  ])
})

test("T6 three overlapping horizontal same net merge to 0–9", () => {
  const map = {
    a: makeTrace("a", "net1", [
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 6, y: 1 },
      { x: 9, y: 1 },
    ]),
  }
  const out = mergeMap(map)
  expect(out.a!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 9, y: 1 },
  ])
})

test("T7 diagonal trace unchanged horizontal trace merged on same net", () => {
  const map = {
    d: makeTrace("d", "net1", [
      { x: 0, y: 0 },
      { x: 3, y: 3 },
    ]),
    h: makeTrace("h", "net1", [
      { x: 0, y: 1 },
      { x: 5, y: 1 },
    ]),
  }
  const out = mergeMap(map)
  expect(out.d!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 3, y: 3 },
  ])
  expect(out.h!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 5, y: 1 },
  ])
})
