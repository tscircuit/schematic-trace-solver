import { describe, expect, test } from "bun:test"
import { getSvgFromGraphicsObject, type GraphicsObject } from "graphics-debug"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { alignNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/alignNearbySameNetSegments"
import type { InputProblem } from "lib/types/InputProblem"

const trace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [] as any,
  }) as SolvedTracePath

describe("alignNearbySameNetSegments", () => {
  test("aligns close overlapping horizontal segments on the same net", () => {
    const [anchor, moved] = alignNearbySameNetSegments([
      trace("a", "net1", [
        { x: 0, y: -2 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 2 },
      ]),
      trace("b", "net1", [
        { x: 2, y: -2 },
        { x: 2, y: 0.08 },
        { x: 8, y: 0.08 },
        { x: 8, y: 2 },
      ]),
    ])

    expect(anchor.tracePath[1].y).toBe(0)
    expect(anchor.tracePath[2].y).toBe(0)
    expect(moved.tracePath[1].y).toBe(0)
    expect(moved.tracePath[2].y).toBe(0)
  })

  test("aligns close overlapping vertical segments on the same net", () => {
    const [, moved] = alignNearbySameNetSegments([
      trace("a", "net1", [
        { x: -2, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: 2, y: 10 },
      ]),
      trace("b", "net1", [
        { x: -2, y: 2 },
        { x: 0.08, y: 2 },
        { x: 0.08, y: 8 },
        { x: 2, y: 8 },
      ]),
    ])

    expect(moved.tracePath[1].x).toBe(0)
    expect(moved.tracePath[2].x).toBe(0)
  })

  test("does not move endpoint-only segments", () => {
    const [, endpointTrace] = alignNearbySameNetSegments([
      trace("a", "net1", [
        { x: 0, y: -2 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 2 },
      ]),
      trace("b", "net1", [
        { x: 2, y: 0.08 },
        { x: 8, y: 0.08 },
        { x: 8, y: 2 },
      ]),
    ])

    expect(endpointTrace.tracePath[0].y).toBe(0.08)
    expect(endpointTrace.tracePath[1].y).toBe(0.08)
  })

  test("does not align different nets", () => {
    const [, otherNet] = alignNearbySameNetSegments([
      trace("a", "net1", [
        { x: 0, y: -2 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 2 },
      ]),
      trace("b", "net2", [
        { x: 2, y: -2 },
        { x: 2, y: 0.08 },
        { x: 8, y: 0.08 },
        { x: 8, y: 2 },
      ]),
    ])

    expect(otherNet.tracePath[1].y).toBe(0.08)
    expect(otherNet.tracePath[2].y).toBe(0.08)
  })

  test("rejects alignments that would collide with a different net", () => {
    const [, blockedTrace] = alignNearbySameNetSegments([
      trace("a", "net1", [
        { x: 0, y: -2 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 2 },
      ]),
      trace("b", "net1", [
        { x: 2, y: -2 },
        { x: 2, y: 0.08 },
        { x: 8, y: 0.08 },
        { x: 8, y: 2 },
      ]),
      trace("c", "net2", [
        { x: 5, y: -0.02 },
        { x: 5, y: 0.02 },
      ]),
    ])

    expect(blockedTrace.tracePath[1].y).toBe(0.08)
    expect(blockedTrace.tracePath[2].y).toBe(0.08)
  })

  test("allows alignments that keep an existing different-net collision", () => {
    const [, movedTrace] = alignNearbySameNetSegments([
      trace("a", "net1", [
        { x: 0, y: -2 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 2 },
      ]),
      trace("b", "net1", [
        { x: 2, y: -2 },
        { x: 2, y: 0.08 },
        { x: 8, y: 0.08 },
        { x: 8, y: 2 },
      ]),
      trace("c", "net2", [
        { x: 1, y: -1 },
        { x: 3, y: -1 },
      ]),
    ])

    expect(movedTrace.tracePath[1].y).toBe(0)
    expect(movedTrace.tracePath[2].y).toBe(0)
  })

  test("rejects alignments that add a collision with an already-colliding trace", () => {
    const [, blockedTrace] = alignNearbySameNetSegments([
      trace("a", "net1", [
        { x: 0, y: -2 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 2 },
      ]),
      trace("b", "net1", [
        { x: 2, y: -2 },
        { x: 2, y: 0.08 },
        { x: 8, y: 0.08 },
        { x: 8, y: 2 },
      ]),
      trace("c", "net2", [
        { x: 1, y: -1 },
        { x: 3, y: -1 },
        { x: 6, y: -1 },
        { x: 6, y: 0.02 },
      ]),
    ])

    expect(blockedTrace.tracePath[1].y).toBe(0.08)
    expect(blockedTrace.tracePath[2].y).toBe(0.08)
  })

  test("rejects alignments that introduce a self-intersection", () => {
    const [, blockedTrace] = alignNearbySameNetSegments([
      trace("a", "net1", [
        { x: 0, y: -2 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 2 },
      ]),
      trace("b", "net1", [
        { x: 2, y: -2 },
        { x: 2, y: 0.08 },
        { x: 8, y: 0.08 },
        { x: 8, y: -2 },
        { x: 5, y: -2 },
        { x: 5, y: 0.02 },
        { x: 9, y: 0.02 },
      ]),
    ])

    expect(blockedTrace.tracePath[1].y).toBe(0.08)
    expect(blockedTrace.tracePath[2].y).toBe(0.08)
  })

  test("rejects alignments that would collide with a chip obstacle", () => {
    const [, blockedTrace] = alignNearbySameNetSegments(
      [
        trace("a", "net1", [
          { x: 0, y: -2 },
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 2 },
        ]),
        trace("b", "net1", [
          { x: 3, y: -2 },
          { x: 3, y: 0.08 },
          { x: 8, y: 0.08 },
          { x: 8, y: 2 },
        ]),
      ],
      {
        inputProblem: problemWithChipObstacle({
          center: { x: 6, y: 0 },
          width: 1,
          height: 0.1,
        }),
      },
    )

    expect(blockedTrace.tracePath[1].y).toBe(0.08)
    expect(blockedTrace.tracePath[2].y).toBe(0.08)
  })

  test("rejects alignments that would collide with a different-net label", () => {
    const [, blockedTrace] = alignNearbySameNetSegments(
      [
        trace("a", "net1", [
          { x: 0, y: -2 },
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 2 },
        ]),
        trace("b", "net1", [
          { x: 2, y: -2 },
          { x: 2, y: 0.08 },
          { x: 8, y: 0.08 },
          { x: 8, y: 2 },
        ]),
      ],
      {
        allLabelPlacements: [
          labelPlacement("net2", {
            center: { x: 5, y: 0 },
            width: 1,
            height: 0.1,
          }),
        ],
      },
    )

    expect(blockedTrace.tracePath[1].y).toBe(0.08)
    expect(blockedTrace.tracePath[2].y).toBe(0.08)
  })

  test("allows alignments that keep an existing chip obstacle collision", () => {
    const [, movedTrace] = alignNearbySameNetSegments(
      [
        trace("a", "net1", [
          { x: 0, y: -2 },
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 2 },
        ]),
        trace("b", "net1", [
          { x: 3, y: -2 },
          { x: 3, y: 0.08 },
          { x: 8, y: 0.08 },
          { x: 8, y: 2 },
        ]),
      ],
      {
        inputProblem: problemWithChipObstacle({
          center: { x: 3, y: -1 },
          width: 0.2,
          height: 0.2,
        }),
      },
    )

    expect(movedTrace.tracePath[1].y).toBe(0)
    expect(movedTrace.tracePath[2].y).toBe(0)
  })

  test("aligns more than five independent same-net segment pairs", () => {
    const traces = alignNearbySameNetSegments([
      trace("anchor", "net1", [
        { x: 0, y: -2 },
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 2 },
      ]),
      ...Array.from({ length: 6 }, (_, index) =>
        trace(`moved-${index}`, "net1", [
          { x: index * 2 + 1, y: -2 },
          { x: index * 2 + 1, y: 0.03 + index * 0.01 },
          { x: index * 2 + 2, y: 0.03 + index * 0.01 },
          { x: index * 2 + 2, y: 2 },
        ]),
      ),
    ])

    for (const alignedTrace of traces.slice(1)) {
      expect(alignedTrace.tracePath[1].y).toBe(0)
      expect(alignedTrace.tracePath[2].y).toBe(0)
    }
  })

  test("renders before and after proof for the nearby same-net alignment", () => {
    const inputTraces = [
      trace("a", "net1", [
        { x: 0, y: -2 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 2 },
      ]),
      trace("b", "net1", [
        { x: 2, y: -2 },
        { x: 2, y: 0.08 },
        { x: 8, y: 0.08 },
        { x: 8, y: 2 },
      ]),
    ]
    const outputTraces = alignNearbySameNetSegments(inputTraces)
    const svg = getSvgFromGraphicsObject(
      renderBeforeAfterProof(inputTraces, outputTraces),
      {
        backgroundColor: "white",
      },
    )

    expect(svg).toMatchSvgSnapshot(import.meta.path, "before-after")
  })
})

const renderBeforeAfterProof = (
  before: SolvedTracePath[],
  after: SolvedTracePath[],
): GraphicsObject => {
  const graphics: GraphicsObject = {
    lines: [],
    texts: [
      {
        text: "Before",
        x: 5,
        y: -3,
        fontSize: 0.5,
      },
      {
        text: "After",
        x: 20,
        y: -3,
        fontSize: 0.5,
      },
    ],
  }

  addTraceLines(graphics, before, 0)
  addTraceLines(graphics, after, 15)

  return graphics
}

const addTraceLines = (
  graphics: GraphicsObject,
  traces: SolvedTracePath[],
  xOffset: number,
) => {
  const colors = ["#1d4ed8", "#dc2626"]

  for (const [index, trace] of traces.entries()) {
    graphics.lines!.push({
      points: trace.tracePath.map((point) => ({
        x: point.x + xOffset,
        y: point.y,
      })),
      strokeColor: colors[index] ?? "#374151",
    })
  }
}

const problemWithChipObstacle = ({
  center,
  width,
  height,
}: {
  center: { x: number; y: number }
  width: number
  height: number
}): InputProblem => ({
  chips: [
    {
      chipId: "obstacle",
      center,
      width,
      height,
      pins: [],
    },
  ],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
})

const labelPlacement = (
  globalConnNetId: string,
  bounds: {
    center: { x: number; y: number }
    width: number
    height: number
  },
): NetLabelPlacement => ({
  globalConnNetId,
  mspConnectionPairIds: [],
  pinIds: [],
  orientation: "x+",
  anchorPoint: bounds.center,
  center: bounds.center,
  width: bounds.width,
  height: bounds.height,
})
