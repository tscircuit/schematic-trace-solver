import { expect, test } from "bun:test"
import { TraceOverlapShiftSolver } from "lib/solvers/TraceOverlapShiftSolver/TraceOverlapShiftSolver"

const makeTrace = ({
  mspPairId,
  globalConnNetId,
  tracePath,
}: {
  mspPairId: string
  globalConnNetId: string
  tracePath: Array<{ x: number; y: number }>
}) =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [
      {
        pinId: `${mspPairId}-a`,
        chipId: "U1",
        x: tracePath[0]!.x,
        y: tracePath[0]!.y,
      },
      {
        pinId: `${mspPairId}-b`,
        chipId: "U1",
        x: tracePath[tracePath.length - 1]!.x,
        y: tracePath[tracePath.length - 1]!.y,
      },
    ],
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}-a`, `${mspPairId}-b`],
    tracePath,
  }) as any

test("aligns close same-net internal trace segments", () => {
  const solver = new TraceOverlapShiftSolver({
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    globalConnMap: {} as any,
    inputTracePaths: [
      makeTrace({
        mspPairId: "trace-a",
        globalConnNetId: "net-1",
        tracePath: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 2, y: 1 },
          { x: 2, y: 0 },
        ],
      }),
      makeTrace({
        mspPairId: "trace-b",
        globalConnNetId: "net-1",
        tracePath: [
          { x: 0, y: 0.08 },
          { x: 0, y: 1.06 },
          { x: 2, y: 1.06 },
          { x: 2, y: 0.08 },
        ],
      }),
    ],
  })

  solver.solve()

  expect(solver.correctedTraceMap["trace-b"]!.tracePath[1]!.y).toBeCloseTo(1)
  expect(solver.correctedTraceMap["trace-b"]!.tracePath[2]!.y).toBeCloseTo(1)
})
