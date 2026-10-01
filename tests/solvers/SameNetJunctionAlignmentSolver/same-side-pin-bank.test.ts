import { expect, test } from "bun:test"
import { alignSameNetJunctions } from "lib/solvers/SameNetJunctionAlignmentSolver/alignSameNetJunctions"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"

const fixture = (rotation = 0, scale = 1, reverse = false, reorder = false) => {
  const point = (x: number, y: number) => {
    for (let i = 0; i < rotation; i++) [x, y] = [-y, x]
    return { x: x * scale + 7, y: y * scale - 4 }
  }
  const facing = (["x-", "y-", "x+", "y+"] as const)[rotation]!
  const pins = [2, 1, 0].map((y, i) => ({
    pinId: `U.${i}`,
    chipId: "U",
    ...point(0, y),
    _facingDirection: facing,
  }))
  const trace = (
    id: string,
    indexes: [number, number],
    coords: number[][],
  ): SolvedTracePath => {
    const orderedPins = indexes.map((i) => pins[i]!) as SolvedTracePath["pins"]
    const path = coords.map(([x, y]) => point(x!, y!))
    if (reverse) {
      orderedPins.reverse()
      path.reverse()
    }
    return {
      mspPairId: id,
      dcConnNetId: "bus",
      globalConnNetId: "bus",
      pins: orderedPins,
      pinIds: orderedPins.map((p) => p.pinId),
      mspConnectionPairIds: [id],
      tracePath: path,
    }
  }
  const traces = [
    trace(
      "outer",
      [1, 2],
      [
        [0, 1],
        [-3, 1],
        [-3, 0],
        [0, 0],
      ],
    ),
    trace(
      "branch",
      [0, 1],
      [
        [0, 2],
        [-0.2, 2],
        [-0.2, 1],
        [0, 1],
      ],
    ),
  ]
  // A signal between the lower bus pins requires the existing long escape.
  traces.push({
    ...traces[0]!,
    mspPairId: "signal",
    globalConnNetId: "signal",
    pins: [
      { pinId: "signal.1", chipId: "signal", ...point(0, 0.5) },
      { pinId: "signal.2", chipId: "signal", ...point(-2, 0.5) },
    ],
    pinIds: ["signal.1", "signal.2"],
    tracePath: [point(0, 0.5), point(-2, 0.5)],
  })
  if (reorder) traces.reverse()
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U",
        center: point(0.5, 1),
        width: (rotation % 2 ? 3 : 1) * scale,
        height: (rotation % 2 ? 1 : 3) * scale,
        pins,
      },
    ],
    directConnections: [],
    netConnections: [{ netId: "bus", pinIds: pins.map((p) => p.pinId) }],
    availableNetLabelOrientations: {},
  }
  return {
    inputProblem,
    traces,
    netLabelPlacements: [] as NetLabelPlacement[],
    netLabelConnectorTraceIds: new Set<string>(),
    point,
    pins,
  }
}

for (const rotation of [0, 1, 2, 3])
  for (const scale of [0.5, 1, 4])
    for (const reverse of [false, true])
      for (const reorder of [false, true]) {
        test(`same-side bus follows existing escape: rotation=${rotation}, scale=${scale}, reverse=${reverse}, reorder=${reorder}`, () => {
          const f = fixture(rotation, scale, reverse, reorder)
          const before = structuredClone(f.traces)
          const result = alignSameNetJunctions(f)
          const bus = result.traces.filter((t) => t.globalConnNetId === "bus")
          const branch = bus.find((t) => t.mspPairId === "branch")!
          expect(tracePathContainsPoint(branch.tracePath, f.point(-3, 2))).toBe(
            true,
          )
          expect(
            branch.tracePath.some(
              (p) =>
                Math.hypot(p.x - f.point(-0.2, 2).x, p.y - f.point(-0.2, 2).y) <
                1e-6,
            ),
          ).toBe(false)
          for (const pin of f.pins)
            expect(
              bus.some((t) => tracePathContainsPoint(t.tracePath, pin)),
            ).toBe(true)
          expect(result.traces.find((t) => t.mspPairId === "signal")).toEqual(
            before.find((t) => t.mspPairId === "signal"),
          )
          expect(f.traces).toEqual(before)
          expect(
            alignSameNetJunctions({
              ...f,
              traces: result.traces,
              netLabelPlacements: result.netLabelPlacements,
            }).traces,
          ).toEqual(result.traces)
        })
      }

for (const blocker of ["component", "label", "crossing", "overlap"] as const) {
  test(`preserves separate rails when alignment meets a ${blocker}`, () => {
    const f = fixture()
    if (blocker === "component")
      f.inputProblem.chips.push({
        chipId: "obstacle",
        center: f.point(-3, 1.5),
        width: 0.3,
        height: 0.3,
        pins: [],
      })
    else if (blocker === "label")
      f.netLabelPlacements.push({
        globalConnNetId: "other",
        mspConnectionPairIds: [],
        pinIds: [],
        orientation: "x+",
        anchorPoint: f.point(-3.2, 1.5),
        center: f.point(-3, 1.5),
        width: 0.4,
        height: 0.3,
      })
    else
      f.traces.push({
        ...f.traces[2]!,
        mspPairId: "blocker",
        tracePath:
          blocker === "crossing"
            ? [f.point(-3.5, 1.5), f.point(-2.5, 1.5)]
            : [f.point(-3, 1.3), f.point(-3, 1.7)],
      })
    const result = alignSameNetJunctions(f)
    const branch = result.traces.find((t) => t.mspPairId === "branch")!
    expect(tracePathContainsPoint(branch.tracePath, f.point(-0.2, 2))).toBe(
      true,
    )
    expect(tracePathContainsPoint(branch.tracePath, f.point(-3, 2))).toBe(false)
  })
}

for (const mismatch of ["net", "chip", "facing"] as const)
  test(`does not relax distance for mismatched ${mismatch}`, () => {
    const f = fixture()
    const branch = f.traces[1]!
    if (mismatch === "net") branch.globalConnNetId = "other"
    else if (mismatch === "chip") branch.pins[0]!.chipId = "other"
    else branch.pins[0]!._facingDirection = "x+"
    const result = alignSameNetJunctions(f)
    expect(
      tracePathContainsPoint(
        result.traces.find((t) => t.mspPairId === "branch")!.tracePath,
        f.point(-0.2, 2),
      ),
    ).toBe(true)
  })
