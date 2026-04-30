import { test, expect } from "bun:test"
import { doesTraceStartOrEndInLabel } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/OverlapAvoidanceStepSolver/doesTraceStartOrEndInLabel"

test("doesTraceStartOrEndInLabel returns false for short trace", () => {
  const trace = {
    mspPairId: "trace1",
    mspConnectionPairIds: [],
    pinIds: [],
    tracePath: [{ x: 5, y: 5 }], // only 1 point
  } as any

  const label = {
    netId: "net1",
    globalConnNetId: "global-1",
    center: { x: 5, y: 5 },
    width: 1,
    height: 1,
  } as any

  const result = doesTraceStartOrEndInLabel({ trace, label })
  expect(result).toBe(false)
})

test("doesTraceStartOrEndInLabel returns boolean", () => {
  const trace = {
    mspPairId: "trace1",
    mspConnectionPairIds: [],
    pinIds: [],
    tracePath: [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
  } as any

  const label = {
    netId: "net1",
    globalConnNetId: "global-1",
    center: { x: 5, y: 5 },
    width: 0.5,
    height: 0.5,
  } as any

  const result = doesTraceStartOrEndInLabel({ trace, label })
  expect(typeof result).toBe("boolean")
})
