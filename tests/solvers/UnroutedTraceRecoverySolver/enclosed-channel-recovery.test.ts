import { expect, test } from "bun:test"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { findFirstCollision } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { UnroutedTraceRecoverySolver } from "lib/solvers/UnroutedTraceRecoverySolver/UnroutedTraceRecoverySolver"
import type { InputProblem } from "lib/types/InputProblem"

const makeFixture = (offset: number, vertical: boolean, blocked: boolean) => {
  const pins: MspConnectionPair["pins"] = [
    { pinId: "a", chipId: "left", x: -4, y: 0, _facingDirection: "x+" },
    { pinId: "b", chipId: "right", x: 4, y: offset, _facingDirection: "x-" },
  ]
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "left",
        center: { x: -5, y: 0 },
        width: 1,
        height: 1,
        pins: [pins[0]],
      },
      {
        chipId: "right",
        center: { x: 5, y: offset },
        width: 1,
        height: 1,
        pins: [pins[1]],
      },
      {
        chipId: "blocker",
        center: { x: 0, y: 0 },
        width: 2,
        height: blocked ? 10 : 3,
        pins: [],
      },
      ...[
        { x: 0, y: -5, width: 20, height: 0.1 },
        { x: 0, y: 5, width: 20, height: 0.1 },
        { x: -10, y: 0, width: 0.1, height: 10 },
        { x: 10, y: 0, width: 0.1, height: 10 },
      ].map(({ x, y, width, height }, index) => ({
        chipId: `border-${index}`,
        center: { x, y },
        width,
        height,
        pins: [],
      })),
    ],
    directConnections: [{ pinIds: ["a", "b"] }],
    netConnections: [],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 20,
    allowInteriorChannelRecovery: true,
  }
  if (vertical) {
    for (const chip of inputProblem.chips) {
      chip.center = { x: chip.center.y, y: chip.center.x }
      ;[chip.width, chip.height] = [chip.height, chip.width]
      for (const pin of chip.pins) {
        ;[pin.x, pin.y] = [pin.y, pin.x]
        pin._facingDirection = pin._facingDirection === "x+" ? "y+" : "y-"
      }
    }
  }
  const connectionPair: MspConnectionPair = {
    mspPairId: "a-b",
    dcConnNetId: "net",
    globalConnNetId: "net",
    pins,
  }
  return { inputProblem, connectionPair }
}

for (const vertical of [false, true]) {
  for (const offset of [0, 1]) {
    test(`recovers an enclosed ${vertical ? "vertical" : "horizontal"} connection with offset ${offset}`, () => {
      const { inputProblem, connectionPair } = makeFixture(
        offset,
        vertical,
        false,
      )
      const solver = new UnroutedTraceRecoverySolver({
        inputProblem,
        failedConnectionPairs: [connectionPair],
        alreadySolvedTraces: [],
      })
      solver.solve()
      expect(solver.solved).toBe(true)
      const traces = solver.getOutput().newTraces
      expect(traces).toHaveLength(1)
      const path = traces[0]!.tracePath
      expect(path[0]).toMatchObject({
        x: connectionPair.pins[0].x,
        y: connectionPair.pins[0].y,
      })
      expect(path.at(-1)).toMatchObject({
        x: connectionPair.pins[1].x,
        y: connectionPair.pins[1].y,
      })
      expect(
        findFirstCollision(path, getObstacleRects(inputProblem)),
      ).toBeNull()
      const axis = vertical ? "y" : "x"
      expect(path[1]![axis]).toBeGreaterThan(path[0]![axis])
      expect(path.at(-2)![axis]).toBeLessThan(path.at(-1)![axis])
      for (let i = 1; i < path.length; i++) {
        expect(
          path[i]!.x === path[i - 1]!.x || path[i]!.y === path[i - 1]!.y,
        ).toBe(true)
        expect(Math.abs(path[i]!.x)).toBeLessThan(vertical ? 4.95 : 9.95)
        expect(Math.abs(path[i]!.y)).toBeLessThan(vertical ? 9.95 : 4.95)
      }
    })
  }
}

test("does not recover through a fully blocked enclosure", () => {
  const { inputProblem, connectionPair } = makeFixture(0, false, true)
  const solver = new UnroutedTraceRecoverySolver({
    inputProblem,
    failedConnectionPairs: [connectionPair],
    alreadySolvedTraces: [],
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.getOutput().newTraces).toHaveLength(0)
})

test("pipeline recovery connects enclosed pins after single-line routing fails", () => {
  const { inputProblem } = makeFixture(0, false, false)
  const solver = new SchematicTracePipelineSolver(inputProblem)
  for (
    let i = 0;
    i < 1000 &&
    solver.getCurrentPhase() !== "traceOverlapShiftSolver" &&
    !solver.failed &&
    !solver.solved;
    i++
  )
    solver.step()
  expect(solver.getCurrentPhase()).toBe("traceOverlapShiftSolver")
  expect(solver.schematicTraceLinesSolver!.failedConnectionPairs).toHaveLength(
    1,
  )
  expect(
    solver.unroutedTraceRecoverySolver!.getOutput().newTraces,
  ).toHaveLength(1)
})

for (const enabled of [undefined, false]) {
  test(`preserves label fallback when interior recovery is ${enabled}`, () => {
    const { inputProblem, connectionPair } = makeFixture(0, false, false)
    inputProblem.allowInteriorChannelRecovery = enabled
    const solver = new UnroutedTraceRecoverySolver({
      inputProblem,
      failedConnectionPairs: [connectionPair],
      alreadySolvedTraces: [],
    })
    solver.solve()
    expect(solver.getOutput().newTraces).toHaveLength(0)
  })
}
