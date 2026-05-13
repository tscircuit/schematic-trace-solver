import { expect, test } from "bun:test"
import inputData from "../../assets/CombineCloseTraceSegmentsSolver.test.input.json"
import { CombineCloseTraceSegmentsSolver } from "lib/solvers/CombineCloseTraceSegmentsSolver/CombineCloseTraceSegmentsSolver"

test("CombineCloseTraceSegmentsSolver snapshot", () => {
  const solver = new CombineCloseTraceSegmentsSolver(inputData as any)
  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})

test("CombineCloseTraceSegmentsSolver merges close vertical segments", () => {
  const solver = new CombineCloseTraceSegmentsSolver(inputData as any)
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces).toHaveLength(2)

  // After merging, the two vertical segments (at x=2.5 and x=2.6) should
  // be at the same x coordinate (averaged to x=2.55)
  const trace1 = output.traces[0]!
  const trace2 = output.traces[1]!

  // Find vertical segments in each trace
  const getVerticalX = (path: { x: number; y: number }[]) => {
    for (let i = 0; i < path.length - 1; i++) {
      if (Math.abs(path[i]!.x - path[i + 1]!.x) < 1e-6 && path[i]!.x > 1.5) {
        return path[i]!.x
      }
    }
    return null
  }

  const x1 = getVerticalX(trace1.tracePath)
  const x2 = getVerticalX(trace2.tracePath)

  // Both vertical segments should now be at the same x coordinate
  expect(x1).not.toBeNull()
  expect(x2).not.toBeNull()
  if (x1 !== null && x2 !== null) {
    expect(Math.abs(x1 - x2)).toBeLessThan(1e-6)
  }
})

test("CombineCloseTraceSegmentsSolver does not merge distant segments", () => {
  const input = {
    ...inputData,
    allTraces: inputData.allTraces.map((t: any, i: number) => ({
      ...t,
      // Put the vertical segments far apart (x=2.0 and x=3.5)
      tracePath: t.tracePath.map((p: any) => ({
        ...p,
        x: p.x === 2.5 ? 2.0 : p.x === 2.6 ? 3.5 : p.x,
      })),
    })),
  }

  const solver = new CombineCloseTraceSegmentsSolver(input as any)
  solver.solve()

  const output = solver.getOutput()
  const trace1 = output.traces[0]!
  const trace2 = output.traces[1]!

  // Vertical segments should remain at different x coordinates
  const getVerticalX = (path: { x: number; y: number }[]) => {
    for (let i = 0; i < path.length - 1; i++) {
      if (Math.abs(path[i]!.x - path[i + 1]!.x) < 1e-6 && path[i]!.x > 1.5) {
        return path[i]!.x
      }
    }
    return null
  }

  const x1 = getVerticalX(trace1.tracePath)
  const x2 = getVerticalX(trace2.tracePath)
  expect(x1).not.toBeNull()
  expect(x2).not.toBeNull()
  if (x1 !== null && x2 !== null) {
    expect(Math.abs(x1 - x2)).toBeGreaterThan(1.0)
  }
})

test("CombineCloseTraceSegmentsSolver skips different nets", () => {
  const input = {
    ...inputData,
    allTraces: inputData.allTraces.map((t: any, i: number) => ({
      ...t,
      // Give each trace a different globalConnNetId
      globalConnNetId: `net_${i}`,
    })),
  }

  const solver = new CombineCloseTraceSegmentsSolver(input as any)
  solver.solve()

  const output = solver.getOutput()
  const trace1 = output.traces[0]!
  const trace2 = output.traces[1]!

  // Vertical segments should NOT be merged (different nets)
  const getVerticalX = (path: { x: number; y: number }[]) => {
    for (let i = 0; i < path.length - 1; i++) {
      if (Math.abs(path[i]!.x - path[i + 1]!.x) < 1e-6 && path[i]!.x > 1.5) {
        return path[i]!.x
      }
    }
    return null
  }

  const x1 = getVerticalX(trace1.tracePath)
  const x2 = getVerticalX(trace2.tracePath)
  expect(x1).not.toBeNull()
  expect(x2).not.toBeNull()
  if (x1 !== null && x2 !== null) {
    expect(Math.abs(x1 - x2)).toBeGreaterThan(0.05)
  }
})
