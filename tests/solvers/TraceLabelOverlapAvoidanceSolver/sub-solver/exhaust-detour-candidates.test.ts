import { expect, test } from "bun:test"
import { SingleOverlapSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/SingleOverlapSolver/SingleOverlapSolver"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"

test("finds the valid detour after earlier candidates hit obstacles", () => {
  const params: ConstructorParameters<typeof SingleOverlapSolver>[0] = {
    trace: {
      mspPairId: "route",
      mspConnectionPairIds: ["route"],
      globalConnNetId: "route",
      dcConnNetId: "route",
      pinIds: ["routea", "routeb"],
      pins: [
        { pinId: "routea", chipId: "U", x: 0, y: 0 },
        { pinId: "routeb", chipId: "V", x: 4, y: 4 },
      ],
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 2 },
        { x: 3, y: 2 },
        { x: 3, y: 4 },
        { x: 4, y: 4 },
      ],
    },
    label: {
      globalConnNetId: "label",
      netId: "LABEL",
      mspConnectionPairIds: [],
      pinIds: [],
      orientation: "y+",
      width: 2.7,
      height: 2.4,
      center: { x: 1.8, y: 0.8 },
      anchorPoint: { x: 1.8, y: -0.4 },
    },
    problem: {
      chips: [
        {
          chipId: "block0",
          center: { x: -0.6, y: 1 },
          width: 1.2,
          height: 1,
          pins: [],
        },
      ],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    paddingBuffer: 0.1,
    detourCount: 0,
    tracesToAvoidOverlapping: [
      {
        mspPairId: "other1",
        mspConnectionPairIds: ["other1"],
        globalConnNetId: "other1",
        dcConnNetId: "other1",
        pinIds: ["other1a", "other1b"],
        pins: [
          { pinId: "other1a", chipId: "U", x: 2.8, y: 3 },
          { pinId: "other1b", chipId: "V", x: 2.8, y: 5.5 },
        ],
        tracePath: [
          { x: 2.8, y: 3 },
          { x: 2.8, y: 5.5 },
        ],
      },
    ],
  }
  const solver = new SingleOverlapSolver(params)
  solver.solve()
  expect(solver.solved).toBe(true)
  const path = solver.solvedTracePath!
  expect(path[0]).toEqual(params.trace.tracePath[0])
  expect(path.at(-1)).toEqual(params.trace.tracePath.at(-1))
  expect(
    isPathCollidingWithObstacles(path, getObstacleRects(params.problem)),
  ).toBe(false)
  expect(
    detectTraceLabelOverlap({
      traces: [{ ...params.trace, tracePath: path }],
      netLabels: [params.label],
    }),
  ).toHaveLength(0)
})
