import { expect, test } from "bun:test"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { findFirstCollision } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { UnroutedTraceRecoverySolver } from "lib/solvers/UnroutedTraceRecoverySolver/UnroutedTraceRecoverySolver"
import type { InputPin, InputProblem } from "lib/types/InputProblem"
import { getLastStepSvg } from "tests/fixtures/getLastStepSvg"

const makeFixture = (axis: "x" | "y" = "x", offset = 0, blocked = false) => {
  const point = (x: number, y: number) =>
    axis === "x" ? { x, y } : { x: y, y: x }
  const pins: MspConnectionPair["pins"] = [
    {
      pinId: "a",
      chipId: "left",
      ...point(-4, 0),
      _facingDirection: `${axis}+`,
    },
    {
      pinId: "b",
      chipId: "right",
      ...point(4, offset),
      _facingDirection: `${axis}-`,
    },
  ]
  const chip = (
    chipId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    pins: InputPin[] = [],
  ) => ({
    chipId,
    center: point(x, y),
    width: axis === "x" ? width : height,
    height: axis === "x" ? height : width,
    pins,
  })
  const inputProblem: InputProblem = {
    chips: [
      chip("left", -5, 0, 1, 1, [pins[0]]),
      chip("right", 5, offset, 1, 1, [pins[1]]),
      chip("blocker", 0, 0, 2, blocked ? 10 : 3),
      chip("border-0", 0, -5, 20, 0.1),
      chip("border-1", 0, 5, 20, 0.1),
      chip("border-2", -10, 0, 0.1, 10),
      chip("border-3", 10, 0, 0.1, 10),
    ],
    directConnections: [{ pinIds: ["a", "b"] }],
    netConnections: [],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 20,
    allowInteriorChannelRecovery: true,
  }
  return {
    inputProblem,
    failedConnectionPairs: [
      { mspPairId: "a-b", dcConnNetId: "net", globalConnNetId: "net", pins },
    ],
    alreadySolvedTraces: [],
  }
}

const recover = (fixture = makeFixture()) => {
  const solver = new UnroutedTraceRecoverySolver(fixture)
  solver.solve()
  expect(solver.solved).toBe(true)
  return solver.getOutput().newTraces
}

test.each([
  ["x", 0],
  ["x", 1],
  ["y", 0],
  ["y", 1],
] as const)(
  "recovers an enclosed connection (axis=%s, offset=%i)",
  (axis, offset) => {
    const fixture = makeFixture(axis, offset)
    const traces = recover(fixture)
    expect(traces).toHaveLength(1)
    const path = traces[0].tracePath
    expect([path[0], path.at(-1)]).toMatchObject(
      fixture.failedConnectionPairs[0].pins.map(({ x, y }) => ({ x, y })),
    )
    expect(
      findFirstCollision(path, getObstacleRects(fixture.inputProblem)),
    ).toBeNull()
    expect(path[1][axis]).toBeGreaterThan(path[0][axis])
    expect(path.at(-2)![axis]).toBeLessThan(path.at(-1)![axis])
    for (let i = 1; i < path.length; i++) {
      expect(path[i].x === path[i - 1].x || path[i].y === path[i - 1].y).toBe(
        true,
      )
      expect(Math.abs(path[i].x)).toBeLessThan(axis === "x" ? 9.95 : 4.95)
      expect(Math.abs(path[i].y)).toBeLessThan(axis === "x" ? 4.95 : 9.95)
    }
  },
)

test("does not recover through a fully blocked enclosure", () => {
  expect(recover(makeFixture("x", 0, true))).toHaveLength(0)
})

test("pipeline recovery connects enclosed pins after single-line routing fails", async () => {
  const solver = new SchematicTracePipelineSolver(makeFixture().inputProblem)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.schematicTraceLinesSolver!.failedConnectionPairs).toHaveLength(
    1,
  )
  const recovery = solver.unroutedTraceRecoverySolver!
  expect(recovery.getOutput().newTraces).toHaveLength(1)
  const svg = getLastStepSvg(recovery.visualize()).replace(/[ \t]+$/gm, "")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test.each(["omitted", "false"])(
  "preserves label fallback when interior recovery is %s",
  (option) => {
    const fixture = makeFixture()
    if (option === "omitted")
      delete fixture.inputProblem.allowInteriorChannelRecovery
    else fixture.inputProblem.allowInteriorChannelRecovery = false
    expect(recover(fixture)).toHaveLength(0)
  },
)
