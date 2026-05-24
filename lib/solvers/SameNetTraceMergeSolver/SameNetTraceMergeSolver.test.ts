import { describe, expect, test } from "bun:test";
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver";
import { SameNetTraceMergeSolver } from "./SameNetTraceMergeSolver";

interface Point {
  x: number;
  y: number;
}

function makeTrace(id: string, net: string, path: Point[]): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: net,
    globalConnNetId: net,
    pins: [
      { chipId: "a", pinId: `${id}_p1`, x: path[0].x, y: path[0].y },
      {
        chipId: "b",
        pinId: `${id}_p2`,
        x: path[path.length - 1]!.x,
        y: path[path.length - 1]!.y,
      },
    ],
    mspConnectionPairIds: [id],
    pinIds: [`${id}-p1`, `${id}-p2`],
    tracePath: path,
  } as SolvedTracePath;
}

describe("SameNetTraceMergeSolver", () => {
  test("merges two adjacent same-net traces", () => {
    const t1 = makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    const t2 = makeTrace("t2", "net1", [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    const solver = new SameNetTraceMergeSolver({ traces: [t1, t2] });
    while (!solver.solved && !solver.failed) solver.step()
    expect(solver.outputTraces.length).toBe(1);
    expect(solver.outputTraces[0]!.tracePath).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
  });

  test("does NOT merge traces from different nets", () => {
    const t1 = makeTrace("t1", "netA", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    const t2 = makeTrace("t2", "netB", [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    const solver = new SameNetTraceMergeSolver({ traces: [t1, t2] });
    while (!solver.solved && !solver.failed) solver.step()
    expect(solver.outputTraces.length).toBe(2);
    expect(solver.mergeCount).toBe(0);
  });

  test("does NOT merge when gap exceeds threshold", () => {
    const t1 = makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    const t2 = makeTrace("t2", "net1", [
      { x: 5, y: 0 },
      { x: 6, y: 0 },
    ]);
    const solver = new SameNetTraceMergeSolver({
      traces: [t1, t2],
      mergeThreshold: 0.1,
    });
    while (!solver.solved && !solver.failed) solver.step()
    expect(solver.outputTraces.length).toBe(2);
    expect(solver.mergeCount).toBe(0);
  });

  test("inserts L-bridge for non-axis-aligned gaps", () => {
    const t1 = makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    const t2 = makeTrace("t2", "net1", [
      { x: 1.05, y: 0.05 },
      { x: 2, y: 0.05 },
    ]);
    const solver = new SameNetTraceMergeSolver({
      traces: [t1, t2],
      mergeThreshold: 0.15,
    });
    while (!solver.solved && !solver.failed) solver.step()
    expect(solver.outputTraces.length).toBe(1);
    const path = solver.outputTraces[0]!.tracePath;
    expect(path.length).toBeGreaterThan(3);
  });

  test("merges three sequential same-net traces in one net", () => {
    const t1 = makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    const t2 = makeTrace("t2", "net1", [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    const t3 = makeTrace("t3", "net1", [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
    const solver = new SameNetTraceMergeSolver({ traces: [t1, t2, t3] });
    while (!solver.solved && !solver.failed) solver.step()
    expect(solver.outputTraces.length).toBe(1);
    expect(solver.mergeCount).toBe(2);
  });

  test("handles reversed endpoint matching (end-to-start)", () => {
    const t1 = makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    const t2 = makeTrace("t2", "net1", [
      { x: 2, y: 0 },
      { x: 1, y: 0 },
    ]);
    const solver = new SameNetTraceMergeSolver({ traces: [t1, t2] });
    while (!solver.solved && !solver.failed) solver.step()
    expect(solver.outputTraces.length).toBe(1);
  });

  test("leaves single-trace nets unchanged", () => {
    const t1 = makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    const solver = new SameNetTraceMergeSolver({ traces: [t1] });
    while (!solver.solved && !solver.failed) solver.step()
    expect(solver.outputTraces.length).toBe(1);
    expect(solver.mergeCount).toBe(0);
  });

  test("prefers userNetId over globalConnNetId", () => {
    const t1 = makeTrace("t1", "shared_net", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    t1.userNetId = "user_net";
    const t2 = makeTrace("t2", "shared_net", [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    t2.userNetId = "user_net";
    const solver = new SameNetTraceMergeSolver({ traces: [t1, t2] });
    while (!solver.solved && !solver.failed) solver.step()
    expect(solver.outputTraces.length).toBe(1);
  });
});
