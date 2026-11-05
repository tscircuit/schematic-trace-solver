import { expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  getPngBufferFromGraphicsObject,
  getSvgFromGraphicsObject,
  type GraphicsObject,
} from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver"
import { getVisibleTraceLength } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import { getTraceGeometryMetrics } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/scoreRailAlignment"
import type { RailOrientation } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/types"
import type { InputPin, InputProblem } from "lib/types/InputProblem"
import { doesPathOverlapTraceStrokes } from "lib/utils/doesPathCoincideWithTraces"
import { align, createTrace } from "./fixtures/alignSameNetRails"

const getPartialRailFixture = (orientation: RailOrientation) => {
  const pins: Array<InputPin & { chipId: string }> = [3, 1, -1, -3].map(
    (y, index) => ({
      pinId: `U1.${index + 1}`,
      chipId: "U1",
      x: -1,
      y,
      _facingDirection: "x-",
    }),
  )
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 2,
        height: 8,
        pins,
      },
      {
        chipId: "blocks-bottom-rail",
        center: { x: -2.5, y: -2 },
        width: 1.4,
        height: 1,
        pins: [],
      },
    ],
    directConnections: [],
    netConnections: [],
    textBoxes: [],
    availableNetLabelOrientations: {},
  }
  const traces = ["top", "middle", "bottom"].map((traceId, index) => {
    const start = pins[index]!
    const end = pins[index + 1]!
    const railX = -2 - index
    return createTrace(
      traceId,
      [
        { x: start.x, y: start.y },
        { x: railX, y: start.y },
        { x: railX, y: end.y },
        { x: end.x, y: end.y },
      ],
      [start, end],
    )
  })

  if (orientation === "vertical") return { inputProblem, traces }

  return {
    inputProblem: {
      ...inputProblem,
      chips: inputProblem.chips.map((chip) => ({
        ...chip,
        center: { x: chip.center.y, y: chip.center.x },
        width: chip.height,
        height: chip.width,
        pins: chip.pins.map((pin) => ({
          ...pin,
          x: pin.y,
          y: pin.x,
          _facingDirection: "y-" as const,
        })),
      })),
    },
    traces: traces.map((trace) => ({
      ...trace,
      tracePath: trace.tracePath.map(({ x, y }) => ({ x: y, y: x })),
      pins: trace.pins.map((pin) => ({
        ...pin,
        x: pin.y,
        y: pin.x,
        _facingDirection: "y-" as const,
      })) as SolvedTracePath["pins"],
    })),
  }
}

const getTraceGraphics = ({
  inputProblem,
  traces,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
}): GraphicsObject =>
  new TraceCleanupSolver({
    inputProblem,
    allTraces: traces,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
    operations: [],
  }).visualize()

// The same focused regression can produce sponsor-review artifacts without
// starting Cosmos or executing a second solver run.
const writeRailArtifacts = async ({
  orientation,
  inputProblem,
  before,
  after,
}: {
  orientation: RailOrientation
  inputProblem: InputProblem
  before: SolvedTracePath[]
  after: SolvedTracePath[]
}) => {
  const directory = process.env.SCHEMATIC_PARTIAL_RAIL_ARTIFACT_DIR
  if (!directory) return
  await mkdir(directory, { recursive: true })

  for (const [stage, traces] of [
    ["before", before],
    ["after", after],
  ] as const) {
    const graphics = getTraceGraphics({ inputProblem, traces })
    const prefix = join(directory, `${orientation}-${stage}`)
    await writeFile(
      `${prefix}.graphics.json`,
      JSON.stringify(graphics, null, 2),
    )
    await writeFile(
      `${prefix}.svg`,
      getSvgFromGraphicsObject(graphics, { backgroundColor: "white" }),
    )
    await writeFile(
      `${prefix}.png`,
      await getPngBufferFromGraphicsObject(graphics, {
        backgroundColor: "white",
        pngWidth: 1536,
        pngHeight: 1536,
      }),
    )
  }
}

const getFixedTrace = ({
  orientation,
  globalConnNetId,
}: {
  orientation: RailOrientation
  globalConnNetId: string
}) => {
  const tracePath = [
    { x: -2, y: -0.5 },
    { x: -2, y: 0.5 },
  ].map(({ x, y }) => (orientation === "vertical" ? { x, y } : { x: y, y: x }))
  return createTrace(
    "fixed-wire",
    tracePath,
    [
      { pinId: "fixed.1", chipId: "fixed", ...tracePath[0]! },
      { pinId: "fixed.2", chipId: "fixed", ...tracePath[1]! },
    ],
    globalConnNetId,
  )
}

for (const orientation of ["vertical", "horizontal"] as const) {
  test(`aligns a clear ${orientation} pair when its third rail is obstructed`, async () => {
    const { inputProblem, traces } = getPartialRailFixture(orientation)
    const originalTraces = structuredClone(traces)
    const result = align(traces, { inputProblem })
    const coordinateAxis = orientation === "vertical" ? "x" : "y"

    await writeRailArtifacts({
      orientation,
      inputProblem,
      before: traces,
      after: result.traces,
    })
    if (process.env.SCHEMATIC_PARTIAL_RAIL_ARTIFACT_DIR) {
      console.info(
        JSON.stringify({
          orientation,
          alignedRailGroupCount: result.alignedRailGroupCount,
          alignedTraceCount: result.alignedTraceCount,
          beforeVisibleLength: getVisibleTraceLength(traces),
          afterVisibleLength: getVisibleTraceLength(result.traces),
        }),
      )
    }

    expect(result.alignedRailGroupCount).toBe(1)
    expect(result.alignedTraceCount).toBe(1)
    expect(result.traces[0]).toEqual(originalTraces[0])
    expect(result.traces[2]).toEqual(originalTraces[2])
    expect(result.traces[1]!.tracePath).toEqual(
      originalTraces[1]!.tracePath.map((point, index) =>
        index === 1 || index === 2 ? { ...point, [coordinateAxis]: -2 } : point,
      ),
    )
    expect(getVisibleTraceLength(traces)).toBeCloseTo(15)
    expect(getVisibleTraceLength(result.traces)).toBeCloseTo(14)
    expect(traces).toEqual(originalTraces)
    for (const trace of result.traces) {
      expect(
        isPathCollidingWithObstacles(
          trace.tracePath,
          getObstacleRects(inputProblem),
        ),
      ).toBe(false)
    }
  })

  test(`does not include an ineligible ${orientation} rail in a partial group`, () => {
    const { inputProblem, traces } = getPartialRailFixture(orientation)
    const result = align(traces, {
      inputProblem,
      eligibleTraceIds: new Set(["top", "bottom"]),
    })

    expect(result.alignedRailGroupCount).toBe(0)
    expect(result.traces).toEqual(traces)
  })

  test(`does not move a ${orientation} partial rail onto an immutable same-net wire`, () => {
    const { inputProblem, traces } = getPartialRailFixture(orientation)
    const fixedTrace = getFixedTrace({
      orientation,
      globalConnNetId: "power-net",
    })
    const allTraces = [...traces, fixedTrace]
    const result = align(allTraces, {
      inputProblem,
      eligibleTraceIds: new Set(traces.map((trace) => trace.mspPairId)),
    })

    expect(result.alignedRailGroupCount).toBe(0)
    expect(result.traces).toEqual(allTraces)
  })

  test(`preserves net-wide overlap with an untouched ${orientation} wire`, () => {
    const { inputProblem, traces } = getPartialRailFixture(orientation)
    const middle = traces[1]!
    const keeperPath = [middle.tracePath[1]!, middle.tracePath[2]!]
    const overlapKeeper = createTrace("overlap-keeper", keeperPath, [
      { pinId: "keeper.1", chipId: "keeper", ...keeperPath[0]! },
      { pinId: "keeper.2", chipId: "keeper", ...keeperPath[1]! },
    ])
    // This eligible two-point trace has no movable interior rail. Moving the
    // middle U away from its existing overlap would add a second visible run.
    const allTraces = [...traces, overlapKeeper]
    const result = align(allTraces, { inputProblem })

    expect(getVisibleTraceLength(allTraces)).toBeCloseTo(15)
    expect(result.alignedRailGroupCount).toBe(0)
    expect(result.traces).toEqual(allTraces)
  })

  test(`preserves other-net clearance during ${orientation} partial alignment`, () => {
    const { inputProblem, traces } = getPartialRailFixture(orientation)
    const fixedTrace = getFixedTrace({
      orientation,
      globalConnNetId: "other-net",
    })
    const allTraces = [...traces, fixedTrace]
    const result = align(allTraces, {
      inputProblem,
      eligibleTraceIds: new Set(traces.map((trace) => trace.mspPairId)),
    })
    const alignedTraces = result.traces.filter(
      (trace) => trace.globalConnNetId === "power-net",
    )

    expect(result.traces[3]).toEqual(fixedTrace)
    for (const trace of alignedTraces) {
      expect(doesPathOverlapTraceStrokes(trace.tracePath, [fixedTrace])).toBe(
        false,
      )
      expect(
        isPathCollidingWithObstacles(
          trace.tracePath,
          getObstacleRects(inputProblem),
        ),
      ).toBe(false)
      const original = traces.find(
        (candidate) => candidate.mspPairId === trace.mspPairId,
      )!
      expect(trace.tracePath[0]).toEqual(original.tracePath[0])
      expect(trace.tracePath.at(-1)).toEqual(original.tracePath.at(-1))
    }
    expect(
      getTraceGeometryMetrics(alignedTraces, result.traces).otherNetCrossings,
    ).toBeLessThanOrEqual(
      getTraceGeometryMetrics(traces, allTraces).otherNetCrossings,
    )
  })
}
