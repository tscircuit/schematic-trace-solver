import { expect, test } from "bun:test"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"

test("detectTraceLabelOverlap reports cross-net trace-label intersections", () => {
  const overlaps = detectTraceLabelOverlap({
    traces: [
      {
        mspPairId: "trace-1",
        globalConnNetId: "net-1",
        tracePath: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
        ],
      } as any,
    ],
    netLabels: [
      {
        globalConnNetId: "net-2",
        center: { x: 2, y: 0 },
        width: 1,
        height: 1,
      } as any,
    ],
  })

  expect(overlaps).toHaveLength(1)
  expect(overlaps[0]!.trace.mspPairId).toBe("trace-1")
  expect(overlaps[0]!.label.globalConnNetId).toBe("net-2")
})
