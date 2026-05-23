import { expect, test } from "bun:test"
import { mergeSameNetCollinearTraces } from "lib/solvers/TraceCleanupSolver/mergeSameNetCollinearTraces"

const pin = (pinId: string, x: number, y: number) => ({
  pinId,
  x,
  y,
  chipId: pinId.split(".")[0]!,
})

const makeTrace = ({ id, net, points }: any) => ({
  mspPairId: id,
  dcConnNetId: net,
  globalConnNetId: net,
  userNetId: net,
  pins: [
    pin(`${id}.a`, points[0].x, points[0].y),
    pin(`${id}.b`, points.at(-1).x, points.at(-1).y),
  ],
  tracePath: points,
  mspConnectionPairIds: [id],
  pinIds: [`${id}.a`, `${id}.b`],
})

test("merges adjacent same-net horizontal traces on the same y", () => {
  const output = mergeSameNetCollinearTraces([
    makeTrace({
      id: "a-b",
      net: "connectivity_net0",
      points: [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
    }),
    makeTrace({
      id: "b-c",
      net: "connectivity_net0",
      points: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
    }),
  ] as any)

  expect(output).toHaveLength(1)
  expect(output[0]!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 2, y: 1 },
  ])
  expect(output[0]!.mspConnectionPairIds).toEqual(["a-b", "b-c"])
})

test("does not merge different nets or non-collinear traces", () => {
  const output = mergeSameNetCollinearTraces([
    makeTrace({
      id: "a-b",
      net: "connectivity_net0",
      points: [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
    }),
    makeTrace({
      id: "b-c",
      net: "connectivity_net1",
      points: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
    }),
    makeTrace({
      id: "c-d",
      net: "connectivity_net0",
      points: [
        { x: 1, y: 2 },
        { x: 2, y: 2 },
      ],
    }),
  ] as any)

  expect(output).toHaveLength(3)
})
