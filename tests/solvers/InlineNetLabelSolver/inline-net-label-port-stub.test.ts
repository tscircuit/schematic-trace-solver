import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../../assets/inline-net-label-port-stub.json"
import "tests/fixtures/matcher"

test("single-pin named nets get outward inline-label stubs", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const placements = solver.inlineNetLabelSolver!.inlineNetLabelPlacements
  expect(placements.map((placement) => placement.netId).sort()).toEqual([
    "NET_MDC",
    "NET_PRU0_MII_RXLINK1",
    "NET_PRU0_MII_TX_CLK1",
  ])
  expect(placements.every((placement) => placement.pinIds.length === 1)).toBe(
    true,
  )
  expect(
    placements.every((placement) => placement.stubTracePath?.length === 2),
  ).toBe(true)

  const leftStub = placements.find(
    (placement) => placement.netId === "NET_PRU0_MII_TX_CLK1",
  )!.stubTracePath!
  const rightStub = placements.find(
    (placement) => placement.netId === "NET_PRU0_MII_RXLINK1",
  )!.stubTracePath!
  expect(leftStub[1]!.x).toBeLessThan(leftStub[0]!.x)
  expect(rightStub[1]!.x).toBeGreaterThan(rightStub[0]!.x)

  const shortLeftStub = placements.find(
    (placement) => placement.netId === "NET_MDC",
  )!.stubTracePath!
  // Rows leaving the same component side terminate on one clean line even
  // though their labels require different minimum lengths.
  expect(shortLeftStub[1]!.x).toBeCloseTo(leftStub[1]!.x, 9)

  const shortLeftPlacement = placements.find(
    (placement) => placement.netId === "NET_MDC",
  )!
  // Aligning the free wire ends must not recenter shorter text on the extended
  // stub. Terminal text stays aligned at the pin-side end of its own label.
  expect(shortLeftPlacement.center.x).toBeCloseTo(
    shortLeftStub[0]!.x - shortLeftPlacement.width / 2 - 0.1,
    9,
  )

  expect(
    solver.inlineNetLabelSolver!.getOutput().netLabelPlacements,
  ).toHaveLength(0)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
