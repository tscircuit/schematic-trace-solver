import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { SinglePinNetLabelPlacementSolver } from "./SinglePinNetLabelPlacementSolver"

export function visualizeSinglePinNetLabelPlacementSolver(
  solver: SinglePinNetLabelPlacementSolver,
): GraphicsObject {
  const graphics = visualizeInputProblem(solver.inputProblem)

  for (const trace of Object.values(solver.inputTraceMap)) {
    graphics.lines!.push({
      points: trace.tracePath,
    } as any)
  }

  for (const c of solver.testedCandidates) {
    const fill =
      c.status === "ok"
        ? "rgba(0, 180, 0, 0.25)"
        : c.status === "chip-collision"
          ? "rgba(220, 0, 0, 0.20)"
          : "rgba(220, 140, 0, 0.20)"
    const stroke =
      c.status === "ok"
        ? "green"
        : c.status === "chip-collision"
          ? "red"
          : "orange"
    const candidateLabel =
      c.status === "ok"
        ? "status: ok (valid candidate)"
        : c.status === "chip-collision"
          ? "status: chip-collision"
          : "status: trace-collision"

    graphics.rects!.push({
      center: {
        x: (c.bounds.minX + c.bounds.maxX) / 2,
        y: (c.bounds.minY + c.bounds.maxY) / 2,
      },
      width: c.width,
      height: c.height,
      fill,
      strokeColor: stroke,
      label: `${candidateLabel}\norientation: ${c.orientation}\nstep: ${c.step.toFixed(3)}\nperpOffset: ${c.perpOffset.toFixed(3)}`,
    } as any)

    graphics.points!.push({
      x: c.anchor.x,
      y: c.anchor.y,
      color: stroke,
      label: `candidate anchor\norientation: ${c.orientation}`,
    } as any)
  }

  if (solver.netLabelPlacement && solver.pinPosition) {
    const p = solver.netLabelPlacement
    graphics.rects!.push({
      center: p.center,
      width: p.width,
      height: p.height,
      fill: "rgba(0, 128, 255, 0.35)",
      strokeColor: "blue",
      label: `netId: ${p.netId}\nglobalConnNetId: ${p.globalConnNetId}\norientation: ${p.orientation}`,
    } as any)

    graphics.points!.push({
      x: p.anchorPoint.x,
      y: p.anchorPoint.y,
      color: "blue",
      label: `anchorPoint\norientation: ${p.orientation}`,
    } as any)

    graphics.lines!.push({
      points: [
        { x: solver.pinPosition.x, y: solver.pinPosition.y },
        { x: p.anchorPoint.x, y: p.anchorPoint.y },
      ],
      strokeColor: "blue",
      strokeDash: "3 2",
    } as any)
  }

  return graphics
}
