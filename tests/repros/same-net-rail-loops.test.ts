import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

// Controls sheet captured from https://tscircuit.com/gokul/macro-six-usbc v0.1.16,
// using Core 0.0.2326 / schematic-trace-solver 0.0.238. Keep the real chip,
// pin, label and net geometry: label detours and rail alignment create the loops.
const inputProblem: InputProblem = JSON.parse(
  readFileSync(
    new URL("./assets/same-net-rail-loops.input.json", import.meta.url),
    "utf8",
  ),
)
const EPSILON = 1e-6

function isSegmentCovered({
  traces,
  start,
  end,
}: {
  traces: SolvedTracePath[]
  start: Point
  end: Point
}): boolean {
  const axis = Math.abs(start.x - end.x) < EPSILON ? "y" : "x"
  const fixedAxis = axis === "x" ? "y" : "x"
  const intervals: [number, number][] = []
  for (const trace of traces) {
    for (let index = 1; index < trace.tracePath.length; index++) {
      const from = trace.tracePath[index - 1]!
      const to = trace.tracePath[index]!
      if (
        Math.abs(from[fixedAxis] - start[fixedAxis]) > EPSILON ||
        Math.abs(to[fixedAxis] - start[fixedAxis]) > EPSILON
      ) {
        continue
      }
      intervals.push([
        Math.min(from[axis], to[axis]),
        Math.max(from[axis], to[axis]),
      ])
    }
  }
  intervals.sort((a, b) => a[0] - b[0])
  let coveredUntil = Math.min(start[axis], end[axis])
  const target = Math.max(start[axis], end[axis])
  for (const [low, high] of intervals) {
    if (high < coveredUntil - EPSILON) continue
    if (low > coveredUntil + EPSILON) return false
    coveredUntil = Math.max(coveredUntil, high)
    if (coveredUntil >= target - EPSILON) return true
  }
  return false
}

function hasClosedPerimeter(traces: SolvedTracePath[], corners: Point[]) {
  return corners.every((start, index) =>
    isSegmentCovered({
      traces,
      start,
      end: corners[(index + 1) % corners.length]!,
    }),
  )
}

test("same-net rails remove redundant terminal and interior loops", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem, {
    hideRatsNet: true,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  // Check both the stage consumed by Core and the final solver output.
  for (const output of [
    solver.inlineNetLabelSolver!.getOutput(),
    solver.netLabelToTraceSolver!.getOutput(),
  ]) {
    const rails = output.traces.filter((trace) => trace.userNetId === "LED_5V")
    expect(rails.length).toBeGreaterThan(0)
    // Both the interior loop and the previously fixed terminal loop stay removed.
    expect(
      hasClosedPerimeter(rails, [
        { x: -0.6531666666666679, y: -7.660000000000003 },
        { x: -0.5760833333333354, y: -7.660000000000003 },
        { x: -0.5760833333333354, y: -7.380000000000002 },
        { x: -0.6531666666666679, y: -7.380000000000002 },
      ]),
    ).toBe(false)
    expect(
      hasClosedPerimeter(rails, [
        { x: -0.7541666666666675, y: -9.340000000000005 },
        { x: -0.6531666666666679, y: -9.340000000000005 },
        { x: -0.6531666666666679, y: -8.060000000000002 },
        { x: -0.7541666666666675, y: -8.060000000000002 },
      ]),
    ).toBe(false)
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
