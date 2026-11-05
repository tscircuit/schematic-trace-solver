import { expect, test } from "bun:test"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { RailNetLabelCornerPlacementSolver } from "lib/solvers/RailNetLabelCornerPlacementSolver/RailNetLabelCornerPlacementSolver"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import { createCrossedPortLabelsFixture } from "./fixtures/crossedPortLabels"

test("moves a crossed label and leaves room for its neighbor's full bounds", () => {
  const input = createCrossedPortLabelsFixture()
  const before = structuredClone(input)
  const solver = new RailNetLabelCornerPlacementSolver(input)
  solver.solve()
  expect(solver.solved).toBe(true)

  const { traces, netLabelPlacements } = solver.getOutput()
  const [label, neighbor] = netLabelPlacements
  const bounds = getRectBounds(label!.center, label!.width, label!.height)
  const neighborBounds = getRectBounds(
    neighbor!.center,
    neighbor!.width,
    neighbor!.height,
  )
  const railX = Math.min(...input.traces[2]!.tracePath.map((point) => point.x))
  expect(bounds.maxX).toBeLessThan(railX)
  expect(neighborBounds.maxX).toBeLessThan(bounds.minX)
  expect(
    detectTraceLabelOverlap({ traces, netLabels: netLabelPlacements }),
  ).toHaveLength(0)

  expect(traces[0]!.tracePath[0]).toEqual(before.traces[0]!.tracePath[0])
  expect(traces[0]!.tracePath.at(-1)).toEqual(label!.anchorPoint)
  expect(traces[1]!.tracePath[0]).toEqual(before.traces[1]!.tracePath[0])
  expect(traces[1]!.tracePath.at(-1)).toEqual(neighbor!.anchorPoint)
  expect(traces[2]).toEqual(before.traces[2])
  expect(input).toEqual(before)
})
