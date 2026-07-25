import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "../bug-reports/bug-report-20260708T055430Z/bug-report-20260708T055430Z.json"

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

// Reproduction for https://github.com/tscircuit/schematic-trace-solver/issues/641
//
// U_MCU's left edge interleaves GND and VCC_3V3 pins (3=GND, 4=VCC, 5=GND,
// 6=VCC). MspConnectionPairSolver pairs same-net neighbors, producing two
// bracket traces that each *enclose* a pin of the other net:
//
//   U_MCU.5-U_MCU.3  (GND)      spans y 14.7..15.1, enclosing pin 4 (y 14.9)
//   U_MCU.6-U_MCU.4  (VCC_3V3)  spans y 14.5..14.9, enclosing pin 5 (y 14.7)
//
// Two interleaved brackets on the same edge always cross — the GND/VCC rails
// short visually. (Same family as the atmega328p interleaved-pin repro, where
// the label for the boxed-in bracket is silently dropped.) There is also a
// false junction where U_MCU.18-R_FAULT_PULLUP.1 crosses the FAULT net-label
// connector (tracked separately in #674).
//
// This test pins the CURRENT (buggy) behavior so the bug is tracked by CI.
// A fix should remove the bracket-bracket crossing, e.g. by rendering
// interleaved same-edge rail pins with per-pin net labels instead of
// bracket traces.
test("repro #641: interleaved GND/VCC brackets cross on the same chip edge", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const traces = solver.netLabelTraceCollisionSolver!.getOutput().traces
  const crossings = findDifferentNetCrossings(traces)

  // BUG: the interleaved GND/VCC brackets cross (plus the #674-family
  // connector crossing)
  expect(crossings).toEqual([
    "U_MCU.18-R_FAULT_PULLUP.1 x available-net-orientation-4-FAULT",
    "U_MCU.5-U_MCU.3 x U_MCU.6-U_MCU.4",
  ])
})
