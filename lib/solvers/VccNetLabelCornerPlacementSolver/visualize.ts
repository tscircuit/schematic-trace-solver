import type { GraphicsObject } from "graphics-debug"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import type { EvaluatedCornerCandidate } from "./types"

const CANDIDATE_SELECTED_COLOR = "blue"
const CANDIDATE_REJECTED_COLOR = "red"

export const visualizeVccNetLabelCornerPlacementSolver = (state: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
  currentLabel: NetLabelPlacement | null
  currentCandidateResults: EvaluatedCornerCandidate[]
  solved: boolean
}): GraphicsObject => {
  const graphics = visualizeInputProblem(state.inputProblem)
  ensureGraphicsArrays(graphics)

  drawTraces(graphics, state.traces)
  drawNetLabels(graphics, state.outputNetLabelPlacements)

  if (!state.solved) {
    drawCurrentLabel(graphics, state.currentLabel)
    drawCurrentCandidates(graphics, state.currentCandidateResults)
  }

  return graphics
}

const drawTraces = (graphics: GraphicsObject, traces: SolvedTracePath[]) => {
  for (const trace of traces) {
    graphics.lines!.push({
      points: trace.tracePath,
      strokeColor: "purple",
    } as any)
  }
}

const drawNetLabels = (
  graphics: GraphicsObject,
  labels: NetLabelPlacement[],
) => {
  for (const label of labels) {
    graphics.rects!.push({
      center: label.center,
      width: label.width,
      height: label.height,
      fill: getColorFromString(label.globalConnNetId, 0.35),
      strokeColor: getColorFromString(label.globalConnNetId, 0.9),
      label: `netId: ${label.netId}\nglobalConnNetId: ${label.globalConnNetId}`,
    } as any)
    graphics.points!.push({
      x: label.anchorPoint.x,
      y: label.anchorPoint.y,
      color: getColorFromString(label.globalConnNetId, 0.9),
      label: `anchorPoint\norientation: ${label.orientation}`,
    } as any)
  }
}

const drawCurrentLabel = (
  graphics: GraphicsObject,
  currentLabel: NetLabelPlacement | null,
) => {
  if (!currentLabel) return

  graphics.rects!.push({
    center: currentLabel.center,
    width: currentLabel.width,
    height: currentLabel.height,
    fill: "rgba(255, 0, 0, 0.2)",
    strokeColor: CANDIDATE_REJECTED_COLOR,
    label: `trace-line VCC target\n${currentLabel.netId ?? currentLabel.globalConnNetId}`,
  } as any)
}

const drawCurrentCandidates = (
  graphics: GraphicsObject,
  candidates: EvaluatedCornerCandidate[],
) => {
  for (const candidate of candidates) {
    const color = candidate.selected
      ? CANDIDATE_SELECTED_COLOR
      : CANDIDATE_REJECTED_COLOR
    graphics.rects!.push({
      center: candidate.center,
      width: candidate.width,
      height: candidate.height,
      fill: candidate.selected
        ? "rgba(0, 0, 255, 0.2)"
        : "rgba(255, 0, 0, 0.15)",
      strokeColor: color,
      strokeDash: candidate.selected ? undefined : "4 2",
      label: `${candidate.selected ? "selected" : candidate.status} trace corner\ntrace: ${candidate.traceId}\ndistance: ${candidate.distance.toFixed(3)}`,
    } as any)
    graphics.points!.push({
      ...candidate.anchorPoint,
      color,
      label: `candidate anchor\n${candidate.status}`,
    } as any)
  }
}

const ensureGraphicsArrays = (graphics: GraphicsObject) => {
  if (!graphics.lines) graphics.lines = []
  if (!graphics.points) graphics.points = []
  if (!graphics.rects) graphics.rects = []
  if (!graphics.circles) graphics.circles = []
  if (!graphics.texts) graphics.texts = []
}
