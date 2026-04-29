import { alignSameNetTraces } from "./lib/solvers/TraceCleanupSolver/alignSameNetTraces"

const mockTraces = [
  {
    mspPairId: "trace1",
    globalConnNetId: "GND",
    tracePath: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ],
  },
  {
    mspPairId: "trace2",
    globalConnNetId: "GND",
    tracePath: [
      { x: 0.1, y: 0.5 },
      { x: 0.1, y: 1.5 },
    ],
  },
]

console.log("Before:", JSON.stringify(mockTraces, null, 2))
const aligned = alignSameNetTraces(mockTraces as any)
console.log("After:", JSON.stringify(aligned, null, 2))

const success = aligned[0].tracePath[0].x === aligned[1].tracePath[0].x
console.log("Success:", success)
if (!success) process.exit(1)
