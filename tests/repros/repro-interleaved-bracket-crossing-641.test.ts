import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-interleaved-bracket-crossing-641.input.json"
import "tests/fixtures/matcher"

const findDifferentNetCrossings = (
  traces: Array<{
    mspPairId: string
    globalConnNetId: string
    tracePath: Array<{ x: number; y: number }>
  }>,
) => {
  const crossings = new Set<string>()
  for (let i = 0; i < traces.length; i++) {
    for (let j = i + 1; j < traces.length; j++) {
      const a = traces[i]!
      const b = traces[j]!
      if (a.globalConnNetId === b.globalConnNetId) continue
      for (let x = 0; x < a.tracePath.length - 1; x++) {
        for (let y = 0; y < b.tracePath.length - 1; y++) {
          const p1 = a.tracePath[x]!
          const p2 = a.tracePath[x + 1]!
          const q1 = b.tracePath[y]!
          const q2 = b.tracePath[y + 1]!
          const aIsHorizontal = Math.abs(p1.y - p2.y) < 1e-9
          const bIsHorizontal = Math.abs(q1.y - q2.y) < 1e-9
          if (aIsHorizontal === bIsHorizontal) continue
          const [h1, h2, v1, v2] = aIsHorizontal
            ? [p1, p2, q1, q2]
            : [q1, q2, p1, p2]
          if (
            v1.x > Math.min(h1.x, h2.x) + 1e-9 &&
            v1.x < Math.max(h1.x, h2.x) - 1e-9 &&
            h1.y > Math.min(v1.y, v2.y) + 1e-9 &&
            h1.y < Math.max(v1.y, v2.y) - 1e-9
          ) {
            crossings.add([a.mspPairId, b.mspPairId].sort().join(" x "))
          }
        }
      }
    }
  }
  return [...crossings].sort()
}

// Reproduction for #641, minimized from bug-report-20260708T055430Z.
//
// U_MCU's left edge interleaves the two rails: pin 3 = GND, 4 = VCC_3V3,
// 5 = GND, 6 = VCC_3V3, evenly spaced 0.2 apart. MspConnectionPairSolver
// pairs same-net neighbours, so it wires 3->5 and 4->6. Each of those
// brackets steps out from the chip edge and spans the pin of the *other*
// net that sits between them, so the two brackets always overlap and cross.
//
// The minimized scene keeps only those four pins and drops the net-label
// orientations, so the crossing below is the interleaved-bracket defect on
// its own rather than any label-driven routing.
//
// A fix should render interleaved same-edge rail pins in a way that cannot
// cross — for example a net label per pin instead of a bracket trace.
test("repro #641: interleaved GND/VCC brackets cross on the same chip edge", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const traces = solver.netLabelTraceCollisionSolver!.getOutput().traces

  // BUG: the two brackets cross. A fix should make this an empty array.
  expect(findDifferentNetCrossings(traces)).toEqual([
    "U_MCU.3-U_MCU.5 x U_MCU.4-U_MCU.6",
  ])

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
