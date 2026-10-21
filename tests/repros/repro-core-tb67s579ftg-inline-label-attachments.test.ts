import { expect, test } from "bun:test"
import {
  getBoundFromCenteredRect,
  getBoundsFromPoints,
} from "@tscircuit/math-utils"
import { getSvgFromGraphicsObject, type GraphicsObject } from "graphics-debug"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./assets/repro-core-tb67s579ftg-inline-label-attachments.input.json"
import "tests/fixtures/matcher"

// Captured from core's TB67 breakout at 588d3bc, with only J4 moved from
// (7, -0.4) to (4.6, 0.5). No generated traces or label geometry were edited.
test("core TB67 bent-route inline label attachment points", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )
  solver.solve()

  const output = solver.inlineNetLabelSolver!.getOutput()
  // Test-only guides in schematic-world mm (+x right, +y up). The dashed
  // boxes and blue circles show the actual text bounds and attachment points.
  const detail: GraphicsObject = {
    title: "TB67: dashed boxes = label bounds; blue dots = anchorPoint",
    coordinateSystem: "cartesian",
    lines: [],
    circles: [],
    texts: [],
  }
  for (const netId of ["OUT_A_P", "OUT_B_P"]) {
    const placements = output.inlineNetLabelPlacements.filter(
      (placement) => placement.netId === netId,
    )
    expect(placements).toHaveLength(1)
    const placement = placements[0]!
    const path = output.traces.find(
      (trace) => trace.mspPairId === placement.mspPairId,
    )!.tracePath
    const bounds = getBoundFromCenteredRect({
      center: placement.center,
      width: placement.width,
      height: placement.height,
    })
    detail.lines!.push(
      { points: path, strokeColor: "green", strokeWidth: 0.015 },
      {
        points: [
          { x: bounds.minX, y: bounds.minY },
          { x: bounds.maxX, y: bounds.minY },
          { x: bounds.maxX, y: bounds.maxY },
          { x: bounds.minX, y: bounds.maxY },
          { x: bounds.minX, y: bounds.minY },
        ],
        strokeColor: "#2563eb",
        strokeWidth: 0.008,
        strokeDash: "4 3",
      },
    )
    detail.circles!.push({
      center: placement.anchorPoint,
      radius: 0.015,
      fill: "#2563eb",
    })
    detail.texts!.push({
      ...placement.center,
      text: placement.netLabelText ?? placement.netId!,
      fontSize: placement.height,
      anchorSide: "center",
      color: "black",
    })
  }

  const detailBounds = getBoundsFromPoints(
    detail.lines!.flatMap((line) => line.points),
  )!
  detail.texts!.push({
    x: (detailBounds.minX + detailBounds.maxX) / 2,
    y: detailBounds.maxY + 0.2,
    text: "Dashed: text bounds / Blue dot: attachment point",
    fontSize: 0.045,
    color: "#2563eb",
    anchorSide: "center",
  })

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
  await expect(
    getSvgFromGraphicsObject(detail, {
      backgroundColor: "white",
      svgWidth: 1000,
      svgHeight: 700,
    }).replace(/[ \t]+$/gm, ""),
  ).toMatchSvgSnapshot(
    import.meta.path,
    "repro-core-tb67s579ftg-inline-label-attachments-detail",
  )
})
