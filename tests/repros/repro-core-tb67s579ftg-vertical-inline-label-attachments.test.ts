import { expect, test } from "bun:test"
import {
  getBoundFromCenteredRect,
  getBoundsFromPoints,
  pointToSegmentDistance,
} from "@tscircuit/math-utils"
import { getSvgFromGraphicsObject, type GraphicsObject } from "graphics-debug"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./assets/repro-core-tb67s579ftg-vertical-inline-label-attachments.input.json"
import "tests/fixtures/matcher"

// Captured from core's repro-tb67s579ftg-vertical-inline-label-attachments
// TSX test: the existing TB67 breakout laid out vertically using schematic
// props. Components and connections are unchanged; no routed geometry is edited.
test("core TB67 vertical bent-route inline label attachment points", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )
  solver.solve()

  const output = solver.inlineNetLabelSolver!.getOutput()
  // Test-only guides in schematic-world mm (+x right, +y up). The dashed
  // boxes and blue circles show the actual text bounds and attachment points.
  const detail: GraphicsObject = {
    title:
      "Vertical TB67: dashed boxes = label bounds; blue dots = anchorPoint",
    coordinateSystem: "cartesian",
    lines: [],
    circles: [],
    texts: [],
  }
  for (const [netId, textAnchor] of [
    ["OUT_A_P", "left"],
    ["OUT_B_P", "right"],
  ] as const) {
    const placements = output.inlineNetLabelPlacements.filter(
      (placement) => placement.netId === netId,
    )
    expect(placements).toHaveLength(1)
    const placement = placements[0]!
    const path = output.traces.find(
      (trace) => trace.mspPairId === placement.mspPairId,
    )!.tracePath
    const attachmentDistances = path
      .slice(1)
      .map((end, index) =>
        pointToSegmentDistance(placement.anchorPoint, path[index]!, end),
      )
    expect(Math.min(...attachmentDistances)).toBeLessThan(1e-6)
    expect(placement.textAnchor).toBe(textAnchor)
    expect(placement.axis).toBe("y")

    // Changing alignment keeps the selected text box in place. The old
    // centered attachment at this x-coordinate would fall into the route's jog.
    expect(placement.anchorPoint.y).toBeCloseTo(
      placement.center.y +
        (textAnchor === "left" ? -placement.width / 2 : placement.width / 2),
    )
    const centeredAttachment = {
      x: placement.anchorPoint.x,
      y: placement.center.y,
    }
    const centerDistances = path
      .slice(1)
      .map((end, index) =>
        pointToSegmentDistance(centeredAttachment, path[index]!, end),
      )
    expect(Math.min(...centerDistances)).toBeGreaterThan(1e-6)

    const bounds = getBoundFromCenteredRect({
      center: placement.center,
      width: placement.height,
      height: placement.width,
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
      rotation: 90,
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
    "repro-core-tb67s579ftg-vertical-inline-label-attachments-detail",
  )
})
