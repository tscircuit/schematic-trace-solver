import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./repro-overlap-shift-abandons-independent-overlaps.input.json"

// Reduced from board-1273. Two cross-net collinear overlaps reach the overlap
// shift solver: GND/VBUS near R5, and RTS/DTR between U6 and the header. Only
// the GND/VBUS pair oscillates between two shift states. The 2-cycle guard is
// shared across pairs, so the oscillation of one pair stops the whole solver
// and the independent RTS/DTR overlap is left uncorrected.
const COINCIDENT_EPS = 2e-3

const overlapLength1D = (
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
) =>
  Math.min(Math.max(firstStart, firstEnd), Math.max(secondStart, secondEnd)) -
  Math.max(Math.min(firstStart, firstEnd), Math.min(secondStart, secondEnd))

const findCrossNetCollinearOverlaps = (traces: SolvedTracePath[]) => {
  const overlaps: Array<{ netIds: [string, string]; length: number }> = []

  for (let i = 0; i < traces.length; i++) {
    for (let j = i + 1; j < traces.length; j++) {
      const firstTrace = traces[i]!
      const secondTrace = traces[j]!
      if (firstTrace.globalConnNetId === secondTrace.globalConnNetId) continue

      for (let s = 0; s < firstTrace.tracePath.length - 1; s++) {
        const firstStart = firstTrace.tracePath[s]!
        const firstEnd = firstTrace.tracePath[s + 1]!
        const firstIsVertical =
          Math.abs(firstStart.x - firstEnd.x) < COINCIDENT_EPS
        const firstIsHorizontal =
          Math.abs(firstStart.y - firstEnd.y) < COINCIDENT_EPS

        for (let t = 0; t < secondTrace.tracePath.length - 1; t++) {
          const secondStart = secondTrace.tracePath[t]!
          const secondEnd = secondTrace.tracePath[t + 1]!
          const secondIsVertical =
            Math.abs(secondStart.x - secondEnd.x) < COINCIDENT_EPS
          const secondIsHorizontal =
            Math.abs(secondStart.y - secondEnd.y) < COINCIDENT_EPS

          const bothVertical = firstIsVertical && secondIsVertical
          const bothHorizontal = firstIsHorizontal && secondIsHorizontal
          if (!bothVertical && !bothHorizontal) continue

          const crossAxis = bothVertical ? "x" : "y"
          const alongAxis = bothVertical ? "y" : "x"
          if (
            Math.abs(firstStart[crossAxis] - secondStart[crossAxis]) >=
            COINCIDENT_EPS
          ) {
            continue
          }

          const length = overlapLength1D(
            firstStart[alongAxis],
            firstEnd[alongAxis],
            secondStart[alongAxis],
            secondEnd[alongAxis],
          )
          if (length > COINCIDENT_EPS) {
            overlaps.push({
              netIds: [firstTrace.globalConnNetId, secondTrace.globalConnNetId],
              length,
            })
          }
        }
      }
    }
  }

  return overlaps
}

test("one oscillating net pair leaves independent overlaps uncorrected", async () => {
  const solver = new SchematicTracePipelineSolver(
    JSON.parse(JSON.stringify(inputJson)) as InputProblem,
  )

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const remainingNetPairKeys = [
    ...new Set(
      findCrossNetCollinearOverlaps(
        Object.values(solver.traceOverlapShiftSolver!.correctedTraceMap),
      ).map(({ netIds }) => [...netIds].sort().join("::")),
    ),
  ].sort()

  // Current behaviour: the RTS/DTR pair (net3/net4) is still overlapping even
  // though nothing about it oscillates. Only net0/net1 should remain here.
  expect(remainingNetPairKeys).toEqual([
    "connectivity_net0::connectivity_net1",
    "connectivity_net3::connectivity_net4",
  ])

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
