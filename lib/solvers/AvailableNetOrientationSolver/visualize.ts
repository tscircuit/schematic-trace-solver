import type { GraphicsObject } from "graphics-debug"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { CANDIDATE_REJECTED_COLOR, CANDIDATE_SELECTED_COLOR } from "./constants"
import type { EvaluatedCandidate } from "./types"

export const visualizeAvailableNetOrientationSolver = (params: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
  currentLabel: NetLabelPlacement | null
  currentCandidateResults: EvaluatedCandidate[]
  solved: boolean
}): GraphicsObject => {
  const graphics = visualizeInputProblem(params.inputProblem)
  ensureGraphicsArrays(graphics)

  drawTraces(graphics, params.traces)
  drawNetLabels(graphics, params.outputNetLabelPlacements)
  drawCurrentLabel(graphics, params.currentLabel, params.solved)
  drawCurrentCandidates(graphics, params.currentCandidateResults, params.solved)

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
  solved: boolean,
) => {
  if (!currentLabel || solved) return

  graphics.rects!.push({
    center: currentLabel.center,
    width: currentLabel.width,
    height: currentLabel.height,
    fill: "rgba(255, 0, 0, 0.2)",
    strokeColor: CANDIDATE_REJECTED_COLOR,
    label: `available orientation target\n${currentLabel.netId ?? currentLabel.globalConnNetId}`,
  } as any)
}

const drawCurrentCandidates = (
  graphics: GraphicsObject,
  candidates: EvaluatedCandidate[],
  solved: boolean,
) => {
  if (solved) return

  for (const candidate of candidates) {
    const color = candidate.selected
      ? CANDIDATE_SELECTED_COLOR
      : CANDIDATE_REJECTED_COLOR
    const distanceLabel =
      candidate.distance === undefined
        ? ""
        : `\ndistance: ${candidate.distance.toFixed(3)}`
    const outwardDistanceLabel =
      candidate.outwardDistance === undefined || candidate.outwardDistance === 0
        ? ""
        : `\noutward distance: ${candidate.outwardDistance.toFixed(3)}`

    graphics.rects!.push({
      center: candidate.center,
      width: candidate.width,
      height: candidate.height,
      fill: candidate.selected
        ? "rgba(0, 0, 255, 0.2)"
        : "rgba(255, 0, 0, 0.15)",
      strokeColor: color,
      strokeDash: candidate.selected ? undefined : "4 2",
      label: `${candidate.selected ? "selected" : candidate.status} available orientation\nphase: ${candidate.phase}\norientation: ${candidate.orientation}${distanceLabel}${outwardDistanceLabel}`,
    } as any)
    graphics.points!.push({
      x: candidate.anchorPoint.x,
      y: candidate.anchorPoint.y,
      color,
      label: `candidate anchor\n${candidate.phase}\n${candidate.orientation}`,
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
