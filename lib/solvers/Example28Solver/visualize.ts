import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import type {
  Example28VisualizationState,
  RerouteCandidateResult,
} from "./types"

const CANDIDATE_SELECTED_COLOR = "blue"
const CANDIDATE_REJECTED_COLOR = "red"

export const visualizeExample28Solver = (
  state: Example28VisualizationState,
): GraphicsObject => {
  const graphics = visualizeInputProblem(state.inputProblem)

  drawTraces(graphics, state)
  drawNetLabels(graphics, state)

  if (!state.solved) {
    drawCurrentCandidates(graphics, state.currentCandidateResults)
    drawCurrentOverlap(graphics, state)
  }

  return graphics
}

const drawTraces = (
  graphics: GraphicsObject,
  state: Example28VisualizationState,
) => {
  for (const trace of state.outputTraces) {
    graphics.lines!.push({
      points: trace.tracePath,
      strokeColor: "purple",
    } as any)
  }
}

const drawNetLabels = (
  graphics: GraphicsObject,
  state: Example28VisualizationState,
) => {
  for (const label of state.outputNetLabelPlacements) {
    const color = getColorFromString(label.globalConnNetId, 0.35)
    graphics.rects!.push({
      center: label.center,
      width: label.width,
      height: label.height,
      fill: color,
      strokeColor: getColorFromString(label.globalConnNetId, 0.9),
      label: `netId: ${label.netId}\nglobalConnNetId: ${label.globalConnNetId}`,
    } as any)
    graphics.points!.push({
      ...label.anchorPoint,
      color: getColorFromString(label.globalConnNetId, 0.9),
      label: `anchorPoint\norientation: ${label.orientation}`,
    } as any)
  }
}

const drawCurrentCandidates = (
  graphics: GraphicsObject,
  candidateResults: RerouteCandidateResult[],
) => {
  for (const candidate of candidateResults) {
    const scoreLabel = candidate.score
      ? `\nlabel intersections: ${candidate.score.labelIntersections}\ntrace intersections: ${candidate.score.traceIntersections}`
      : ""
    graphics.lines!.push({
      points: candidate.path,
      strokeColor: candidate.selected
        ? CANDIDATE_SELECTED_COLOR
        : CANDIDATE_REJECTED_COLOR,
      strokeDash: candidate.selected ? undefined : "4 2",
      label: `${candidate.selected ? "selected" : candidate.status} reroute${scoreLabel}`,
    } as any)
  }
}

const drawCurrentOverlap = (
  graphics: GraphicsObject,
  state: Example28VisualizationState,
) => {
  if (!state.currentOverlap) return

  const label = state.currentOverlap.label
  graphics.rects!.push({
    center: label.center,
    width: label.width,
    height: label.height,
    fill: "rgba(255, 0, 0, 0.2)",
    strokeColor: CANDIDATE_REJECTED_COLOR,
    label: `overlap target\n${label.netId ?? label.globalConnNetId}`,
  } as any)
}
