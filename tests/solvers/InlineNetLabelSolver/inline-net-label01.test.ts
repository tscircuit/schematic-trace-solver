import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../../assets/inline-net-label01.json"
import "tests/fixtures/matcher"

test("inline-net-label01 places inline labels alongside point-to-point traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const inlinePlacements = solver
    .inlineNetLabelSolver!.inlineNetLabelPlacements.slice()
    .sort((a, b) => (a.netId ?? "").localeCompare(b.netId ?? ""))

  expect(inlinePlacements.map((p) => p.netId)).toEqual([
    "SPI_SCK",
    "USER_LED_ANODE",
  ])

  const [spiSck, userLedAnode] = inlinePlacements

  // The horizontal trace gets a horizontal label sitting above the wire.
  expect(userLedAnode!.axis).toBe("x")
  expect(userLedAnode!.side).toBe("y+")
  expect(userLedAnode!.center.x).toBeCloseTo(userLedAnode!.anchorPoint.x, 6)
  expect(userLedAnode!.center.y).toBeGreaterThan(userLedAnode!.anchorPoint.y)

  // The vertical trace gets a vertical label on the left of the wire, which is
  // "above" it once the text is rotated.
  expect(spiSck!.axis).toBe("y")
  expect(spiSck!.side).toBe("x-")
  expect(spiSck!.center.y).toBeCloseTo(spiSck!.anchorPoint.y, 6)
  expect(spiSck!.center.x).toBeLessThan(spiSck!.anchorPoint.x)

  // An inline label replaces the anchored label for that net, it never adds a
  // second label.
  const inlineNetIds = new Set(inlinePlacements.map((p) => p.globalConnNetId))
  const anchoredNetIds = solver
    .inlineNetLabelSolver!.getOutput()
    .netLabelPlacements.map((p) => p.globalConnNetId)
  expect(anchoredNetIds.filter((id) => inlineNetIds.has(id))).toEqual([])

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
