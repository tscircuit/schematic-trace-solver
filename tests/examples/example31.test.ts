/**
 * Tests for issue #34: same-net trace segments that run parallel and close
 * together on the same axis should be merged into a single line by the
 * SameNetTraceMergeSolver pipeline phase.
 */
import { test, expect } from "bun:test"
import type { InputProblem } from "lib/index"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import "tests/fixtures/matcher"

// ---------------------------------------------------------------------------
// Unit tests for SameNetTraceMergeSolver directly
// ---------------------------------------------------------------------------

test("SameNetTraceMergeSolver merges close horizontal segments on the same net", () => {
  const traceA = {
    mspPairId: "pair-a" as any,
    dcConnNetId: "net0",
    globalConnNetId: "net0",
    pins: [] as any,
    mspConnectionPairIds: [] as any,
    pinIds: [] as any,
    tracePath: [
      { x: 0, y: 0 },
      { x: 0, y: 1.0 },
      { x: 4, y: 1.0 },
      { x: 4, y: 0 },
    ],
  }

  const traceB = {
    mspPairId: "pair-b" as any,
    dcConnNetId: "net0",
    globalConnNetId: "net0",
    pins: [] as any,
    mspConnectionPairIds: [] as any,
    pinIds: [] as any,
    // Horizontal segment at y=1.1 — within GAP_THRESHOLD of traceA's y=1.0
    tracePath: [
      { x: 1, y: 0 },
      { x: 1, y: 1.1 },
      { x: 3, y: 1.1 },
      { x: 3, y: 0 },
    ],
  }

  const solver = new SameNetTraceMergeSolver({ allTraces: [traceA, traceB] })
  solver.solve()
  expect(solver.solved).toBe(true)

  const outTraces = solver.getOutput().traces
  const outB = outTraces.find((t) => t.mspPairId === "pair-b")!

  // Locate the horizontal segment in outB
  let mergedY: number | undefined
  for (let i = 0; i < outB.tracePath.length - 1; i++) {
    const p1 = outB.tracePath[i]!
    const p2 = outB.tracePath[i + 1]!
    if (Math.abs(p1.y - p2.y) < 1e-9 && Math.abs(p1.x - p2.x) > 0.1) {
      mergedY = p1.y
      break
    }
  }

  expect(mergedY).toBeDefined()
  // Should be snapped to traceA's y=1.0
  expect(Math.abs(mergedY! - 1.0)).toBeLessThan(1e-9)
})

test("SameNetTraceMergeSolver merges close vertical segments on the same net", () => {
  const traceA = {
    mspPairId: "pair-a" as any,
    dcConnNetId: "net1",
    globalConnNetId: "net1",
    pins: [] as any,
    mspConnectionPairIds: [] as any,
    pinIds: [] as any,
    tracePath: [
      { x: 0, y: 0 },
      { x: 2.0, y: 0 },
      { x: 2.0, y: 4 },
      { x: 0, y: 4 },
    ],
  }

  const traceB = {
    mspPairId: "pair-b" as any,
    dcConnNetId: "net1",
    globalConnNetId: "net1",
    pins: [] as any,
    mspConnectionPairIds: [] as any,
    pinIds: [] as any,
    // Vertical segment at x=2.1 — within GAP_THRESHOLD of traceA's x=2.0
    tracePath: [
      { x: 0, y: 1 },
      { x: 2.1, y: 1 },
      { x: 2.1, y: 3 },
      { x: 0, y: 3 },
    ],
  }

  const solver = new SameNetTraceMergeSolver({ allTraces: [traceA, traceB] })
  solver.solve()
  expect(solver.solved).toBe(true)

  const outTraces = solver.getOutput().traces
  const outB = outTraces.find((t) => t.mspPairId === "pair-b")!

  // Locate the vertical segment in outB
  let mergedX: number | undefined
  for (let i = 0; i < outB.tracePath.length - 1; i++) {
    const p1 = outB.tracePath[i]!
    const p2 = outB.tracePath[i + 1]!
    if (Math.abs(p1.x - p2.x) < 1e-9 && Math.abs(p1.y - p2.y) > 0.1) {
      mergedX = p1.x
      break
    }
  }

  expect(mergedX).toBeDefined()
  // Should be snapped to traceA's x=2.0
  expect(Math.abs(mergedX! - 2.0)).toBeLessThan(1e-9)
})

test("SameNetTraceMergeSolver does NOT merge traces on different nets", () => {
  const traceA = {
    mspPairId: "pair-a" as any,
    dcConnNetId: "net0",
    globalConnNetId: "net0",
    pins: [] as any,
    mspConnectionPairIds: [] as any,
    pinIds: [] as any,
    tracePath: [
      { x: 0, y: 0 },
      { x: 0, y: 1.0 },
      { x: 4, y: 1.0 },
      { x: 4, y: 0 },
    ],
  }

  const traceB = {
    mspPairId: "pair-b" as any,
    dcConnNetId: "net999",
    globalConnNetId: "net999", // different net!
    pins: [] as any,
    mspConnectionPairIds: [] as any,
    pinIds: [] as any,
    tracePath: [
      { x: 1, y: 0 },
      { x: 1, y: 1.05 },
      { x: 3, y: 1.05 },
      { x: 3, y: 0 },
    ],
  }

  const solver = new SameNetTraceMergeSolver({ allTraces: [traceA, traceB] })
  solver.solve()

  const outTraces = solver.getOutput().traces
  const outB = outTraces.find((t) => t.mspPairId === "pair-b")!

  // traceB should remain at y=1.05, not snapped to y=1.0
  const horizSeg = outB.tracePath.find(
    (_, i) =>
      i < outB.tracePath.length - 1 &&
      Math.abs(outB.tracePath[i]!.y - outB.tracePath[i + 1]!.y) < 1e-9 &&
      Math.abs(outB.tracePath[i]!.x - outB.tracePath[i + 1]!.x) > 0.1,
  )!
  expect(Math.abs(horizSeg.y - 1.05)).toBeLessThan(1e-9)
})

test("SameNetTraceMergeSolver does NOT merge segments farther than GAP_THRESHOLD", () => {
  const traceA = {
    mspPairId: "pair-a" as any,
    dcConnNetId: "net0",
    globalConnNetId: "net0",
    pins: [] as any,
    mspConnectionPairIds: [] as any,
    pinIds: [] as any,
    tracePath: [
      { x: 0, y: 1.0 },
      { x: 4, y: 1.0 },
    ],
  }

  const traceB = {
    mspPairId: "pair-b" as any,
    dcConnNetId: "net0",
    globalConnNetId: "net0",
    pins: [] as any,
    mspConnectionPairIds: [] as any,
    pinIds: [] as any,
    // y=1.5 is more than GAP_THRESHOLD=0.19 away — should NOT be merged
    tracePath: [
      { x: 1, y: 1.5 },
      { x: 3, y: 1.5 },
    ],
  }

  const solver = new SameNetTraceMergeSolver({ allTraces: [traceA, traceB] })
  solver.solve()

  const outB = solver.getOutput().traces.find((t) => t.mspPairId === "pair-b")!
  // y should remain 1.5
  expect(Math.abs(outB.tracePath[0]!.y - 1.5)).toBeLessThan(1e-9)
})

// ---------------------------------------------------------------------------
// Integration test: full pipeline includes the merge phase
// ---------------------------------------------------------------------------

test("example31 - pipeline snapshot includes SameNetTraceMergeSolver", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1.0,
        height: 1.2,
        pins: [
          { pinId: "U1.1", x: -0.8, y: 0.3 },
          { pinId: "U1.2", x: -0.8, y: -0.3 },
        ],
      },
      {
        chipId: "R1",
        center: { x: -3.5, y: 0.3 },
        width: 0.6,
        height: 0.4,
        pins: [{ pinId: "R1.1", x: -2.9, y: 0.3 }],
      },
      {
        chipId: "R2",
        center: { x: -3.5, y: -0.28 },
        width: 0.6,
        height: 0.4,
        pins: [{ pinId: "R2.1", x: -2.9, y: -0.28 }],
      },
    ],
    netConnections: [
      {
        netId: "VDD",
        pinIds: ["U1.1", "R1.1", "U1.2", "R2.1"],
        netLabelWidth: 0.3,
      },
    ],
    directConnections: [],
    availableNetLabelOrientations: {
      VDD: ["y+"],
    },
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  // The pipeline should have run the merge phase
  expect(solver.sameNetTraceMergeSolver).toBeDefined()
  expect(solver.sameNetTraceMergeSolver!.solved).toBe(true)

  // All output segments must remain orthogonal
  const mergedTraces = solver.sameNetTraceMergeSolver!.getOutput().traces
  for (const trace of mergedTraces) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const p1 = trace.tracePath[i]!
      const p2 = trace.tracePath[i + 1]!
      const isHoriz = Math.abs(p1.y - p2.y) < 1e-9
      const isVert = Math.abs(p1.x - p2.x) < 1e-9
      expect(isHoriz || isVert).toBe(true)
    }
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
