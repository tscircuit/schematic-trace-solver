import type { GraphicsObject } from "graphics-debug"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import type { LabelCandidate, LabelOverlap } from "./types"

const CANDIDATE_SELECTED_COLOR = "blue"
const CANDIDATE_REJECTED_COLOR = "red"

export const visualizeTraceAnchoredNetLabelOverlapSolver = (state: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
  currentOverlap: LabelOverlap | null
  currentCandidateResults: LabelCandidate[]
  solved: boolean
}): GraphicsObject => {
  const graphics = visualizeInputProblem(state.inputProblem)
  ensureGraphicsArrays(graphics)

  drawTraces(graphics, state.traces)
  drawNetLabels(graphics, state.outputNetLabelPlacements)

  if (!state.solved) {
    drawCurrentOverlap(graphics, state)
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

const drawCurrentOverlap = (
  graphics: GraphicsObject,
  state: {
    outputNetLabelPlacements: NetLabelPlacement[]
    currentOverlap: LabelOverlap | null
  },
) => {
  if (!state.currentOverlap) return

  for (const labelIndex of [
    state.currentOverlap.firstLabelIndex,
    state.currentOverlap.secondLabelIndex,
  ]) {
    const label = state.outputNetLabelPlacements[labelIndex]
    if (!label) continue

    graphics.rects!.push({
      center: label.center,
      width: label.width,
      height: label.height,
      fill: "rgba(255, 0, 0, 0.2)",
      strokeColor: CANDIDATE_REJECTED_COLOR,
      label: `netlabel overlap target\n${label.netId ?? label.globalConnNetId}`,
    } as any)
  }
}

const drawCurrentCandidates = (
  graphics: GraphicsObject,
  candidates: LabelCandidate[],
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
      label: `${candidate.selected ? "selected" : candidate.status} netlabel overlap candidate\ntrace: ${candidate.traceId}\ndistance: ${candidate.distanceFromOriginal.toFixed(3)}`,
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
