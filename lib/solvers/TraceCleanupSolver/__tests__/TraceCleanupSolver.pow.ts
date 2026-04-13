import { TraceCleanupSolver } from "../TraceCleanupSolver"

const input = {
  chips: [],
  labels: [],
  allTraces: [
    {
      id: "pow-demo",
      mspPairId: "pow-test",
      tracePath: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
      ],
    },
  ],
}

const solver = new TraceCleanupSolver(input)
const result = solver.solve()

console.log("===== POW: BEFORE =====")
console.log(JSON.stringify(input.allTraces, null, 2))

console.log("\n===== POW: AFTER =====")
console.log(JSON.stringify(result.cleanedTraces, null, 2))
