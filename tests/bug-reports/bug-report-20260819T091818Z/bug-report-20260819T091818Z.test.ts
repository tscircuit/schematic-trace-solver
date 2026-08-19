import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260819T091818Z.json"
import "tests/fixtures/matcher"

test("disconnected netlabel", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)

  const vddLabel = solver.inlineNetLabelSolver
    ?.getOutput()
    .netLabelPlacements.find(
      (label) =>
        label.netId === "VDD_0V9" && label.pinIds.includes("schematic_port_99"),
    )
  expect(vddLabel?.anchorPoint).toEqual({
    x: -1.551,
    y: 4.600999999999994,
  })

  const vddConnector = solver.inlineNetLabelSolver
    ?.getOutput()
    .traces.find(
      (trace) =>
        trace.globalConnNetId === vddLabel?.globalConnNetId &&
        trace.pinIds.includes("schematic_port_99") &&
        trace.outputLabelAnchorPoint !== undefined,
    )
  expect(vddConnector).toBeDefined()

  const vddSnapshot = getSvgFromGraphicsObject(
    {
      lines: [{ points: vddConnector!.tracePath, strokeColor: "purple" }],
      rects: [
        {
          center: vddLabel!.center,
          width: vddLabel!.width,
          height: vddLabel!.height,
          fill: "rgba(0, 180, 80, 0.25)",
        },
      ],
      points: [
        {
          ...vddLabel!.anchorPoint,
          color: "orange",
          label: "VDD_0V9 anchor",
        },
      ],
      texts: [
        {
          text: "VDD_0V9",
          x: vddLabel!.center.x,
          y: vddLabel!.center.y,
          fontSize: 0.12,
          color: "green",
        },
      ],
    },
    { backgroundColor: "white" },
  )
  expect(vddSnapshot).toMatchSvgSnapshot(import.meta.path, "vdd-0v9-fixed")
})
