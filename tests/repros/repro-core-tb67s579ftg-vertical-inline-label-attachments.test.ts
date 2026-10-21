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

// Captured from a vertical layout of core's existing
// tests/repros/repro-tb67s579ftg-inline-net-labels.test.tsx circuit.
// Normal TSX props put U1's pin rows on top/bottom, J1 below U1, and J4 above.
// Components and connections are unchanged; no routed geometry is edited.
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
  const stubDetail: GraphicsObject = {
    coordinateSystem: "cartesian",
    lines: [],
    circles: [],
    texts: [],
  }
  for (const [netId, textAnchor] of [
    ["OUT_A_P", "left"],
    ["OUT_B_P", "right"],
    ["AGC_OUT", undefined],
  ] as const) {
    const placements = output.inlineNetLabelPlacements.filter(
      (placement) => placement.netId === netId,
    )
    expect(placements).toHaveLength(1)
    const placement = placements[0]!
    const path =
      placement.stubTracePath ??
      output.traces.find((trace) => trace.mspPairId === placement.mspPairId)!
        .tracePath
    const attachmentDistances = path
      .slice(1)
      .map((end, index) =>
        pointToSegmentDistance(placement.anchorPoint, path[index]!, end),
      )
    expect(Math.min(...attachmentDistances)).toBeLessThan(1e-6)
    expect(placement.textAnchor).toBe(textAnchor)
    expect(placement.axis).toBe("y")

    if (placement.stubTracePath) {
      expect(path).toHaveLength(2)
      expect(path[0]!.x).toBeCloseTo(path[1]!.x)
      expect(path[1]!.y).toBeLessThan(path[0]!.y)
    } else {
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
    }
    const view = placement.stubTracePath ? stubDetail : detail

    const bounds = getBoundFromCenteredRect({
      center: placement.center,
      width: placement.height,
      height: placement.width,
    })
    view.lines!.push(
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
    view.circles!.push({
      center: placement.anchorPoint,
      radius: 0.015,
      fill: "#2563eb",
    })
    view.texts!.push({
      ...placement.center,
      text: placement.netLabelText ?? placement.netId!,
      fontSize: placement.height,
      rotation: 90,
      anchorSide: "center",
      color: "black",
    })
  }

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
  for (const [suffix, view] of [
    ["detail", detail],
    ["straight-stub", stubDetail],
  ] as const) {
    const bounds = getBoundsFromPoints(
      view.lines!.flatMap((line) => line.points),
    )!
    view.texts!.push({
      x: (bounds.minX + bounds.maxX) / 2,
      y: bounds.maxY + 0.2,
      text: "Dashed: text bounds / Blue dot: attachment point",
      fontSize: 0.045,
      color: "#2563eb",
      anchorSide: "center",
    })
    await expect(
      getSvgFromGraphicsObject(view, {
        backgroundColor: "white",
        svgWidth: 1000,
        svgHeight: 700,
      }).replace(/[ \t]+$/gm, ""),
    ).toMatchSvgSnapshot(
      import.meta.path,
      `repro-core-tb67s579ftg-vertical-inline-label-attachments-${suffix}`,
    )
  }
})
