import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem, PinId } from "lib/types/InputProblem"
import inputProblemJson from "./assets/pullup-rail-missing-power-label.input.json"
import "tests/fixtures/matcher"

test("places a collision-free V3_3 label and connector trace for obstructed multi-pin rail islands", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const output = solver.netLabelToTraceSolver!.getOutput()
  const railPinIds = inputProblem.netConnections.find(
    (netConnection) => netConnection.netId === "V3_3",
  )!.pinIds

  const connectedPinIdsByPinId = new Map<PinId, Set<PinId>>()
  for (const trace of output.traces) {
    const [pinIdA, pinIdB] = trace.pinIds
    if (!pinIdA || !pinIdB) continue
    if (!connectedPinIdsByPinId.has(pinIdA)) {
      connectedPinIdsByPinId.set(pinIdA, new Set())
    }
    if (!connectedPinIdsByPinId.has(pinIdB)) {
      connectedPinIdsByPinId.set(pinIdB, new Set())
    }
    connectedPinIdsByPinId.get(pinIdA)!.add(pinIdB)
    connectedPinIdsByPinId.get(pinIdB)!.add(pinIdA)
  }

  const railLabels = output.netLabelPlacements.filter(
    (netLabel) => netLabel.netId === "V3_3",
  )
  expect(railLabels).toHaveLength(2)
  for (const railLabel of railLabels) {
    expect(railLabel.orientation).toBe("y+")
  }

  const pinIdsReachingRailLabel = new Set<PinId>(
    railLabels.flatMap((netLabel) => netLabel.pinIds),
  )
  const pinIdsToVisit = [...pinIdsReachingRailLabel]
  while (pinIdsToVisit.length > 0) {
    const pinId = pinIdsToVisit.pop()!
    for (const connectedPinId of connectedPinIdsByPinId.get(pinId) ?? []) {
      if (pinIdsReachingRailLabel.has(connectedPinId)) continue
      pinIdsReachingRailLabel.add(connectedPinId)
      pinIdsToVisit.push(connectedPinId)
    }
  }

  const railPinIdsWithoutLabel = railPinIds.filter(
    (pinId) => !pinIdsReachingRailLabel.has(pinId),
  )
  expect(railPinIdsWithoutLabel).toEqual([])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
