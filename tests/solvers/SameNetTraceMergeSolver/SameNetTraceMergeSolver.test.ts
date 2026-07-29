import { describe, expect, test } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const trace = (
  id: string,
  netId: string,
  path: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    pins: [
      { pinId: `${id}.1`, chipId: "U1", x: path[0]!.x, y: path[0]!.y },
      {
        pinId: `${id}.2`,
        chipId: "U2",
        x: path[path.length - 1]!.x,
        y: path[path.length - 1]!.y,
      },
    ],
    tracePath: path,
    mspConnectionPairIds: [id],
    pinIds: [`${id}.1`, `${id}.2`],
  }) as SolvedTracePath

describe("SameNetTraceMergeSolver", () => {
  test("merges overlapping straight traces on the same net", () => {
    const solver = new SameNetTraceMergeSolver({
      traces: [
        trace("a", "VCC", [
          { x: 0, y: 0 },
          { x: 3, y: 0 },
        ]),
        trace("b", "VCC", [
          { x: 2, y: 0 },
          { x: 5, y: 0 },
        ]),
      ],
    })

    solver.solve()

    const { traces } = solver.getOutput()
    expect(traces).toHaveLength(1)
    expect(traces[0]!.tracePath).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ])
    expect(traces[0]!.mspConnectionPairIds).toEqual(["a", "b"])
    expect(traces[0]!.pins[0]).toMatchObject({ pinId: "a.1", x: 0, y: 0 })
    expect(traces[0]!.pins[1]).toMatchObject({ pinId: "b.2", x: 5, y: 0 })
  })

  test("does not merge straight traces on different nets", () => {
    const solver = new SameNetTraceMergeSolver({
      traces: [
        trace("a", "VCC", [
          { x: 0, y: 0 },
          { x: 3, y: 0 },
        ]),
        trace("b", "GND", [
          { x: 2, y: 0 },
          { x: 5, y: 0 },
        ]),
      ],
    })

    solver.solve()

    expect(solver.getOutput().traces).toHaveLength(2)
  })
})
