import { test, expect } from "bun:test"
import { filterLabelsAtTraceEdges } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/LabelMergingSolver/filterLabelsAtTraceEdges"

test("filterLabelsAtTraceEdges returns empty array for no labels", () => {
  const traces = [
    {
      mspPairId: "trace1",
      mspConnectionPairIds: [],
      pinIds: [],
      tracePath: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      globalConnNetId: "net1",
    },
  ]

  const result = filterLabelsAtTraceEdges({
    labels: [],
    traces,
    distanceThreshold: 0.5,
  })
  expect(result).toHaveLength(0)
})

test("filterLabelsAtTraceEdges filters labels far from traces", () => {
  const traces = [
    {
      mspPairId: "trace1",
      mspConnectionPairIds: [],
      pinIds: [],
      tracePath: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      globalConnNetId: "net1",
    },
  ]

  const labels = [
    {
      netId: "net1",
      globalConnNetId: "global-1",
      chipId: "chip1",
      pinId: "pin1",
      pinIds: ["chip1.pin1"],
      mspConnectionPairIds: ["pair1"],
      anchor: { x: 100, y: 100 },
      center: { x: 100, y: 100 },
      width: 0.5,
      height: 0.2,
      facingDirection: "x+",
    },
  ]

  const result = filterLabelsAtTraceEdges({
    labels,
    traces,
    distanceThreshold: 0.5,
  })
  // Label far from trace should be filtered out
  expect(result).toHaveLength(0)
})
