import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-overlap-shift-cycle-abandons-independent-overlaps.input.json"

// Reduced from board-1273. Two cross-net overlaps survive the shift solver:
// GND/VBUS near R5 and RTS/DTR between U6 and the header. Only the first one
// oscillates, but the shared 2-cycle guard used to abort the whole solver on
// it, so the independent RTS/DTR overlap was never corrected.
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

test("a single oscillating net pair does not abandon independent overlaps", () => {
  const solver = new SchematicTracePipelineSolver(
    JSON.parse(JSON.stringify(inputProblemJson)) as InputProblem,
  )

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const overlapShiftSolver = solver.traceOverlapShiftSolver!

  // Only the genuinely oscillating GND/VBUS pair may still overlap. Before the
  // fix the RTS/DTR pair overlapped too, because the 2-cycle guard aborted the
  // whole solver on the first oscillation instead of skipping only that pair.
  const remainingNetPairKeys = findCrossNetCollinearOverlaps(
    Object.values(overlapShiftSolver.correctedTraceMap),
  ).map(({ netIds }) => [...netIds].sort().join("::"))

  expect([...new Set(remainingNetPairKeys)].sort()).toEqual([
    "connectivity_net0::connectivity_net1",
  ])

  // The skipped pair is exactly the oscillating one, not an arbitrary bail-out.
  expect([...overlapShiftSolver.oscillatingNetPairKeys]).toEqual([
    "connectivity_net0::connectivity_net1",
  ])

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
