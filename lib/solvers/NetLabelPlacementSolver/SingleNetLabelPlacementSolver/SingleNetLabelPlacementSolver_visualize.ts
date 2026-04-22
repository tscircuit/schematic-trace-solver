import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { chooseHostTraceForGroup } from "./host"
import type { SingleNetLabelPlacementSolver } from "./SingleNetLabelPlacementSolver"

export function visualizeSingleNetLabelPlacementSolver(
  solver: SingleNetLabelPlacementSolver,
): GraphicsObject {
  const graphics = visualizeInputProblem(solver.inputProblem)

  for (const rect of graphics.rects ?? []) {
    if (rect.label) {
      rect.label = `CHIP\n${rect.label}`
    }
  }

  // Visualize the entire trace group for this net id
  const groupId = solver.overlappingSameNetTraceGroup.globalConnNetId
  const host = chooseHostTraceForGroup({
    inputProblem: solver.inputProblem,
    inputTraceMap: solver.inputTraceMap,
    globalConnNetId: groupId,
    fallbackTrace: solver.overlappingSameNetTraceGroup.overlappingTraces,
  })
  const groupStroke = getColorFromString(groupId, 0.9)
  const groupFill = getColorFromString(groupId, 0.5)

  for (const trace of Object.values(solver.inputTraceMap)) {
    const isHost = host ? trace.mspPairId === host.mspPairId : false
    graphics.lines!.push({
      points: trace.tracePath,
      // strokeColor: isHost ? groupStroke : groupFill,
      // strokeDash: isHost ? undefined : "4 2",
    } as any)
  }

  // Visualize all tested candidate rectangles with reason coloring
  for (const c of solver.testedCandidates) {
    const fill =
      c.status === "ok"
        ? "rgba(0, 180, 0, 0.25)"
        : c.status === "chip-collision"
          ? "rgba(220, 0, 0, 0.25)"
          : c.status === "trace-collision"
            ? "rgba(220, 140, 0, 0.25)"
            : "rgba(120, 120, 120, 0.15)"
    const stroke =
      c.status === "ok"
        ? "green"
        : c.status === "chip-collision"
          ? "red"
          : c.status === "trace-collision"
          ? "orange"
          : "gray"
    const candidateLabel =
      c.status === "ok"
        ? "VALID NET LABEL CANDIDATE"
        : c.status === "chip-collision"
          ? "CHIP COLLISION"
          : c.status === "trace-collision"
            ? "TRACE COLLISION"
            : "PARALLEL TO SEGMENT"

    graphics.rects!.push({
      center: {
        x: (c.bounds.minX + c.bounds.maxX) / 2,
        y: (c.bounds.minY + c.bounds.maxY) / 2,
      },
      width: c.width,
      height: c.height,
      fill,
      strokeColor: stroke,
      label: `${candidateLabel}\n${c.orientation}`,
    } as any)

    graphics.points!.push({
      x: c.anchor.x,
      y: c.anchor.y,
      color: stroke,
      label: `ANCHOR\n${c.orientation}`,
    } as any)
  }

  // Visualize the final accepted label (if any)
  if (solver.netLabelPlacement) {
    const p = solver.netLabelPlacement
    graphics.rects!.push({
      center: p.center,
      width: p.width,
      height: p.height,
      fill: "rgba(0, 128, 255, 0.35)",
      strokeColor: "blue",
      label:
        p.netId && p.netId !== p.globalConnNetId
          ? `PLACED NET LABEL\n${p.netId}\n${p.globalConnNetId}`
          : `PLACED NET LABEL\n${p.netId ?? p.globalConnNetId}`,
    } as any)
    graphics.points!.push({
      x: p.anchorPoint.x,
      y: p.anchorPoint.y,
      color: "blue",
      label: `ANCHOR\n${p.orientation}`,
    } as any)
  }

  return graphics
}
