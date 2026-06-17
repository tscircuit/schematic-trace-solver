import { expect, test } from "bun:test"
import { alignNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/alignNearbySameNetSegments"

test("alignNearbySameNetSegments aligns nearby same-net traces", () => {
  const traces = [
    {
      mspPairId: "net-a-1",
      globalConnNetId: "net-a",
      dcConnNetId: "net-a",
      userNetId: "A",
      pins: [
        { pinId: "a1", x: 0, y: 0, chipId: "c1", _facingDirection: "x+" },
        { pinId: "a2", x: 2, y: 1, chipId: "c2", _facingDirection: "x-" },
      ],
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
      mspConnectionPairIds: ["net-a-1"],
      pinIds: ["a1", "a2"],
    },
    {
      mspPairId: "net-a-2",
      globalConnNetId: "net-a",
      dcConnNetId: "net-a",
      userNetId: "A",
      pins: [
        { pinId: "a3", x: 0, y: 0.2, chipId: "c3", _facingDirection: "x+" },
        { pinId: "a4", x: 2.08, y: 1.2, chipId: "c4", _facingDirection: "x-" },
      ],
      tracePath: [
        { x: 0, y: 0.2 },
        { x: 1.08, y: 0.2 },
        { x: 1.08, y: 1.2 },
        { x: 2.08, y: 1.2 },
      ],
      mspConnectionPairIds: ["net-a-2"],
      pinIds: ["a3", "a4"],
    },
    {
      mspPairId: "net-b-1",
      globalConnNetId: "net-b",
      dcConnNetId: "net-b",
      userNetId: "B",
      pins: [
        { pinId: "b1", x: 0, y: 3, chipId: "c5", _facingDirection: "x+" },
        { pinId: "b2", x: 2, y: 4, chipId: "c6", _facingDirection: "x-" },
      ],
      tracePath: [
        { x: 0, y: 3 },
        { x: 1.5, y: 3 },
        { x: 1.5, y: 4 },
        { x: 2, y: 4 },
      ],
      mspConnectionPairIds: ["net-b-1"],
      pinIds: ["b1", "b2"],
    },
  ] as any

  const output = alignNearbySameNetSegments({
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    traces,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.01,
  })

  expect(output[0]!.tracePath[1]!.x).toBeCloseTo(1.04, 6)
  expect(output[1]!.tracePath[1]!.x).toBeCloseTo(1.04, 6)
  expect(output[2]!.tracePath[1]!.x).toBeCloseTo(1.5, 6)
})
