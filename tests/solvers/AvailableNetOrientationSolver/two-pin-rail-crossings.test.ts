import { expect, test } from "bun:test"
import { ConnectivityMap } from "connectivity-map"
import { AvailableNetOrientationSolver } from "lib/solvers/AvailableNetOrientationSolver/AvailableNetOrientationSolver"
import { tracePathCrossesAnyTrace } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"
import type { InputProblem } from "lib/types/InputProblem"
import capturedInput from "../../bug-reports/bug-report-20261104T110624Z/bug-report-20261104T110624Z.json"

// Isolate the two rails for the mirrored unit guards. The bug-report test
// exercises and snapshots the entire captured four-component schematic.
const chip = capturedInput.chips[0]!
const input: InputProblem = {
  ...capturedInput,
  chips: [chip],
  directConnections: [],
  netConnections: capturedInput.netConnections.filter((net) =>
    ["VREF", "VCC_CHG"].includes(net.netId),
  ),
  textBoxes: capturedInput.textBoxes.filter(
    (text) => text.chipId === chip.chipId,
  ),
  availableNetLabelOrientations: { VREF: ["y+"], VCC_CHG: ["y+"] },
} as InputProblem

// Mirror the captured geometry and rename the nets to exercise the placement
// preference on either chip side for both upward and downward rails.
for (const side of ["left", "right"] as const) {
  for (const orientation of ["y+", "y-"] as const) {
    test(`uses a local ${orientation} rail branch on the ${side} without crossing another net`, () => {
      const problem = structuredClone(input) as InputProblem
      const transform = (point: { x: number; y: number }) => ({
        x: side === "left" ? point.x : -point.x,
        y: orientation === "y+" ? point.y : -point.y,
      })
      for (const chip of problem.chips) {
        chip.center = transform(chip.center)
        for (const pin of chip.pins) {
          Object.assign(pin, transform(pin))
          if (side === "right") {
            pin._facingDirection = pin._facingDirection === "x-" ? "x+" : "x-"
          }
        }
      }
      for (const text of problem.textBoxes ?? [])
        text.center = transform(text.center)
      for (const net of problem.netConnections) {
        net.netId = net.pinIds.length === 2 ? "LOCAL_RAIL" : "OTHER_RAIL"
        net.isGround = orientation === "y-"
      }
      problem.availableNetLabelOrientations = {
        LOCAL_RAIL: [orientation],
        OTHER_RAIL: [orientation],
      }
      const solver = new SchematicTracePipelineSolver(problem)
      solver.solve()
      expect(solver.solved).toBe(true)
      const { traces, netLabelPlacements } =
        solver.netLabelToTraceSolver!.getOutput()
      const label = netLabelPlacements.find(
        (label) => label.netId === "LOCAL_RAIL",
      )!
      expect(label.orientation).toBe(orientation)
      const local = traces.filter(
        (trace) => trace.globalConnNetId === label.globalConnNetId,
      )
      const other = traces.filter(
        (trace) => trace.globalConnNetId !== label.globalConnNetId,
      )
      const crossings = local.flatMap((trace) =>
        other.flatMap((other) =>
          findPerpendicularPathCrossings(trace.tracePath, other.tracePath, {
            includeTerminalSegments: true,
          }),
        ),
      )
      expect(crossings).toHaveLength(0)

      const connector = local.find((trace) =>
        solver.availableNetOrientationSolver!.netLabelConnectorTraceIds.has(
          trace.mspPairId,
        ),
      )!
      expect(connector).toBeDefined()
      const length = connector.tracePath
        .slice(1)
        .reduce((total, point, index) => {
          const previous = connector.tracePath[index]!
          return (
            total +
            Math.abs(point.x - previous.x) +
            Math.abs(point.y - previous.y)
          )
        }, 0)
      expect(length).toBeLessThan(label.width + label.height)
      expect(
        local.some((trace) =>
          tracePathContainsPoint(trace.tracePath, label.anchorPoint),
        ),
      ).toBe(true)

      // Verify actual wire geometry, rather than only trace pin-id metadata.
      const pointId = (point: { x: number; y: number }) =>
        `${point.x.toFixed(6)},${point.y.toFixed(6)}`
      const connectivity = new ConnectivityMap({})
      for (const trace of traces)
        connectivity.addConnections([trace.tracePath.map(pointId)])
      const pins = problem.chips.flatMap((chip) => chip.pins)
      const netIds = problem.netConnections.map((net) => {
        const pinNets = net.pinIds.map((id) =>
          connectivity.getNetConnectedToId(
            pointId(pins.find((pin) => pin.pinId === id)!),
          ),
        )
        expect(pinNets.every((id) => id !== undefined && id !== null)).toBe(
          true,
        )
        expect(new Set(pinNets).size).toBe(1)
        return pinNets[0]
      })
      expect(new Set(netIds).size).toBe(2)
    })
  }
}

test("preserves the existing aligned extension when the column is clear", () => {
  const problem = structuredClone(input) as InputProblem
  problem.netConnections = problem.netConnections.filter(
    (net) => net.pinIds.length === 2,
  )
  const solver = new SchematicTracePipelineSolver(problem)
  solver.solve()
  const orientationStage = solver.availableNetOrientationSolver!
  const initial = orientationStage.netLabelPlacements.find(
    (label) => label.netId === "VREF",
  )!
  const placed = orientationStage.outputNetLabelPlacements.find(
    (label) => label.netId === "VREF",
  )!
  expect(placed.orientation).toBe("y+")
  expect(placed.anchorPoint.x).toBe(initial.anchorPoint.x)
  expect(placed.anchorPoint.y).toBeGreaterThan(initial.anchorPoint.y)
})

test("crossing checks exclude branches of the same connected net", () => {
  const solver = new SchematicTracePipelineSolver(input as InputProblem)
  solver.solve()
  const trace = solver
    .netLabelToTraceSolver!.getOutput()
    .traces.find((trace) => trace.userNetId === "VCC_CHG")!
  const verticalPath = [
    { x: 2.65, y: 0.2 },
    { x: 2.65, y: 1 },
  ]
  const traceMap = { [trace.mspPairId]: trace }
  expect(tracePathCrossesAnyTrace(verticalPath, traceMap)).toBe(true)
  expect(
    tracePathCrossesAnyTrace(verticalPath, traceMap, trace.globalConnNetId),
  ).toBe(false)
  expect(tracePathCrossesAnyTrace(verticalPath, traceMap, "other-net")).toBe(
    true,
  )
})

test("retains the required orientation when the aligned extension is the only clear placement", () => {
  const pipeline = new SchematicTracePipelineSolver(input as InputProblem)
  pipeline.solveUntilPhase("availableNetOrientationSolver")
  pipeline.step()
  const params = pipeline.availableNetOrientationSolver!.getConstructorParams()
  const initial = params.netLabelPlacements.find(
    (label) => label.netId === "VREF",
  )!
  const solver = new AvailableNetOrientationSolver({
    ...params,
    netLabelPlacements: [initial],
    inputProblem: {
      ...params.inputProblem,
      textBoxes: [
        ...(params.inputProblem.textBoxes ?? []),
        // Block the side-placement search, leaving the aligned column clear.
        {
          center: { x: -2.36, y: -1 },
          width: 10,
          height: 4.6,
          text: "obstacle",
        },
      ],
    },
  })
  solver.solve()
  const label = solver.getOutput().netLabelPlacements[0]!
  expect(label.orientation).toBe("y+")
  expect(label.anchorPoint.x).toBe(initial.anchorPoint.x)
  expect(label.anchorPoint.y).toBeGreaterThan(1.4)
  expect(
    solver.traces.some(
      (trace) =>
        solver.netLabelConnectorTraceIds.has(trace.mspPairId) &&
        tracePathContainsPoint(trace.tracePath, label.anchorPoint),
    ),
  ).toBe(true)
})
