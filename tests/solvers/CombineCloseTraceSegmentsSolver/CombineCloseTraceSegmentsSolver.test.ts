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
  const input = JSON.parse(JSON.stringify(inputData))
  // Put the vertical segments far apart (x=2.0 and x=3.5)
  for (const trace of input.allTraces) {
    for (const p of trace.tracePath) {
      if (p.x === 2.5) p.x = 2.0
      if (p.x === 2.6) p.x = 3.5
    }
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

test("CombineCloseTraceSegmentsSolver does not merge onto a different-net segment", () => {
  // Regression test for the case raised in review:
  //   net1: vertical segment at x=2.5
  //   net1: vertical segment at x=2.6
  //   net2: vertical segment at x=2.55  (right where the average would be)
  // The naive merge would average the two net1 segments to x=2.55, placing
  // them exactly on top of the net2 segment — a cross-net short. The solver
  // must reject this merge.
  const input = JSON.parse(JSON.stringify(inputData))

  // Build a third trace on a different net, with a vertical segment at the
  // midpoint of the two existing net1 vertical segments (x=2.55), spanning
  // the same y range so it overlaps in parallel.
  const decoyTrace = {
    mspPairId: "decoy",
    dcConnNetId: "net2_dc",
    globalConnNetId: "net2_global",
    userNetId: "NET2",
    pins: [],
    tracePath: [
      { x: 1.0, y: -0.2 },
      { x: 2.55, y: -0.2 },
      { x: 2.55, y: 0.8 },
      { x: 4.0, y: 0.8 },
    ],
    mspConnectionPairIds: ["decoy"],
    pinIds: [],
  }
  input.allTraces.push(decoyTrace)

  const solver = new CombineCloseTraceSegmentsSolver(input as any)
  solver.solve()

  const output = solver.getOutput()

  // The two net1 traces should NOT both have ended up at x=2.55, which would
  // overlap the net2 segment.
  const net1Vertical: number[] = []
  let net2Vertical: number | null = null
  for (const trace of output.traces) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const p1 = trace.tracePath[i]!
      const p2 = trace.tracePath[i + 1]!
      if (Math.abs(p1.x - p2.x) < 1e-6 && p1.x > 1.5 && p1.x < 3.5) {
        if (trace.globalConnNetId === "net2_global") {
          net2Vertical = p1.x
        } else {
          net1Vertical.push(p1.x)
        }
        break
      }
    }
  }

  expect(net2Vertical).not.toBeNull()
  // Neither net1 segment should sit on top of the net2 segment.
  for (const x of net1Vertical) {
    expect(Math.abs(x - (net2Vertical ?? -999))).toBeGreaterThan(1e-6)
  }
})

test("CombineCloseTraceSegmentsSolver skips different nets", () => {
  const input = JSON.parse(JSON.stringify(inputData))
  // Give each trace a different globalConnNetId
  input.allTraces.forEach((t: any, i: number) => {
    t.globalConnNetId = `net_${i}`
  })

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
