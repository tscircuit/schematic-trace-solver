import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import {
  getCenterFromAnchor,
  getDimsForOrientation,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"
import {
  EPS,
  getManhattanDistance,
  getPointAtTraceDistance,
  getTraceLength,
  getTraceVertexDistances,
} from "./geometry"
import type { Bounds, LabelCandidate, TraceLocation } from "./types"

const CANDIDATE_STEP = 0.1

export const generateCandidatesAlongTrace = (params: {
  inputProblem: InputProblem
  label: NetLabelPlacement
  traceLocation: TraceLocation
}) => {
  const { inputProblem, label, traceLocation } = params
  const traceLength = getTraceLength(traceLocation.trace)
  const orientationConstraint = getOrientationConstraint(inputProblem, label)
  const candidateDistances = getCandidateDistances(
    traceLength,
    getTraceVertexDistances(traceLocation.trace),
  )
  const netLabelWidth = getNetLabelWidth(inputProblem, label)
  const candidates: LabelCandidate[] = []
  const seenCandidateKeys = new Set<string>()

  for (const pathDistance of candidateDistances) {
    const point = getPointAtTraceDistance(traceLocation.trace, pathDistance)
    const orientations = getOrientationsForPoint({
      inputProblem,
      label,
      point,
      orientationConstraint,
    })

    for (const orientation of orientations) {
      if (isSamePlacement(label, point, orientation)) continue
      const key = [point.x.toFixed(6), point.y.toFixed(6), orientation].join(
        ":",
      )
      if (seenCandidateKeys.has(key)) continue
      seenCandidateKeys.add(key)

      candidates.push(
        createCandidate({
          point,
          orientation,
          netLabelWidth,
          traceLocation,
          pathDistance,
          label,
        }),
      )
    }
  }

  return candidates
}

const getCandidateDistances = (
  traceLength: number,
  vertexDistances: number[],
) => {
  const distances = new Set<number>()
  const maxSteps = Math.ceil(traceLength / CANDIDATE_STEP)

  for (let i = 0; i <= maxSteps; i++) {
    const distance = Math.min(traceLength, i * CANDIDATE_STEP)
    distances.add(roundDistance(distance))
  }
  for (const distance of vertexDistances) {
    distances.add(roundDistance(distance))
  }

  return [...distances]
    .filter((distance) => distance >= -EPS && distance <= traceLength + EPS)
    .sort((a, b) => a - b)
}

const getOrientationsForPoint = (params: {
  inputProblem: InputProblem
  label: NetLabelPlacement
  point: Point
  orientationConstraint: FacingDirection[] | null
}) => {
  const { inputProblem, label, point, orientationConstraint } = params

  if (orientationConstraint) {
    return orientationConstraint
  }

  return getUnconstrainedOrientations({
    label,
    inputProblem,
    point,
  })
}

const createCandidate = (params: {
  point: Point
  orientation: FacingDirection
  netLabelWidth: number
  traceLocation: TraceLocation
  pathDistance: number
  label: NetLabelPlacement
}): LabelCandidate => {
  const {
    point,
    orientation,
    netLabelWidth,
    traceLocation,
    pathDistance,
    label,
  } = params
  const { width, height } = getDimsForOrientation({
    orientation,
    netLabelWidth,
  })

  return {
    anchorPoint: point,
    center: getCenterFromAnchor(point, orientation, width, height),
    width,
    height,
    orientation,
    traceId: traceLocation.trace.mspPairId,
    pathDistance,
    distanceFromOriginal: getManhattanDistance(point, label.anchorPoint),
    status: "valid",
    selected: false,
  }
}

const getOrientationConstraint = (
  inputProblem: InputProblem,
  label: NetLabelPlacement,
): FacingDirection[] | null => {
  const availableOrientations = inputProblem.availableNetLabelOrientations ?? {}
  for (const netId of getOrientationConstraintKeys(inputProblem, label)) {
    if (Object.hasOwn(availableOrientations, netId)) {
      return dedupeOrientations(
        (availableOrientations[netId] ?? [])
          .map(normalizeFacingDirection)
          .filter(
            (orientation): orientation is FacingDirection =>
              orientation !== undefined,
          ),
      )
    }
  }

  return null
}

const getOrientationConstraintKeys = (
  inputProblem: InputProblem,
  label: NetLabelPlacement,
) =>
  dedupeStrings([
    label.netId,
    label.globalConnNetId,
    ...inputProblem.netConnections
      .filter((connection) =>
        label.pinIds.some((pinId) => connection.pinIds.includes(pinId)),
      )
      .map((connection) => connection.netId),
  ])

const getUnconstrainedOrientations = (params: {
  label: NetLabelPlacement
  inputProblem: InputProblem
  point: Point
}) => {
  const { label, inputProblem, point } = params
  return dedupeOrientations([
    ...getInitialOrientations(label),
    ...getOutwardOrientations({
      inputProblem,
      point,
    }),
    ...ALL_ORIENTATIONS,
  ])
}

const getInitialOrientations = (label: NetLabelPlacement) => [
  label.orientation,
  getFlippedOrientation(label.orientation),
]

const getOutwardOrientations = (params: {
  inputProblem: InputProblem
  point: Point
}) => {
  const { inputProblem, point } = params
  const chipBounds = getChipBounds(inputProblem)

  return dedupeOrientations(
    getOutwardOrientationOptions(point, chipBounds)
      .sort((a, b) => b.outwardScore - a.outwardScore)
      .map(({ orientation }) => orientation),
  )
}

const getOutwardOrientationOptions = (point: Point, chipBounds: ChipBounds) => {
  const options: OutwardOrientationOption[] = []

  options.push(
    getOutwardAxisOption({
      value: point.y,
      min: chipBounds.minY,
      max: chipBounds.maxY,
      center: chipBounds.centerY,
      positiveOrientation: "y+",
      negativeOrientation: "y-",
    }),
  )
  options.push(
    getOutwardAxisOption({
      value: point.x,
      min: chipBounds.minX,
      max: chipBounds.maxX,
      center: chipBounds.centerX,
      positiveOrientation: "x+",
      negativeOrientation: "x-",
    }),
  )

  return options
}

type OutwardOrientationOption = {
  orientation: FacingDirection
  outwardScore: number
}

const getOutwardAxisOption = (params: {
  value: number
  min: number
  max: number
  center: number
  positiveOrientation: FacingDirection
  negativeOrientation: FacingDirection
}): OutwardOrientationOption => {
  const { value, min, max, center, positiveOrientation, negativeOrientation } =
    params

  if (value > max + EPS) {
    return {
      orientation: positiveOrientation,
      outwardScore: 1 + value - max,
    }
  }
  if (value < min - EPS) {
    return {
      orientation: negativeOrientation,
      outwardScore: 1 + min - value,
    }
  }

  return {
    orientation: value >= center ? positiveOrientation : negativeOrientation,
    outwardScore: getNormalizedCenterDistance(value, center, max - min),
  }
}

const getNormalizedCenterDistance = (
  value: number,
  center: number,
  span: number,
) => Math.abs(value - center) / Math.max(EPS, span / 2)

const ALL_ORIENTATIONS: FacingDirection[] = ["x+", "x-", "y+", "y-"]

const getFlippedOrientation = (
  orientation: FacingDirection,
): FacingDirection => {
  switch (orientation) {
    case "x+":
      return "x-"
    case "x-":
      return "x+"
    case "y+":
      return "y-"
    case "y-":
      return "y+"
  }
}

type ChipBounds = Bounds & {
  centerX: number
  centerY: number
}

const getChipBounds = (inputProblem: InputProblem): ChipBounds => {
  if (inputProblem.chips.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      centerX: 0,
      centerY: 0,
    }
  }

  const bounds = inputProblem.chips.reduce<Bounds>(
    (acc, chip) => ({
      minX: Math.min(acc.minX, chip.center.x - chip.width / 2),
      minY: Math.min(acc.minY, chip.center.y - chip.height / 2),
      maxX: Math.max(acc.maxX, chip.center.x + chip.width / 2),
      maxY: Math.max(acc.maxY, chip.center.y + chip.height / 2),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  )

  return {
    ...bounds,
    centerX: (bounds.minX + bounds.maxX) / 2,
    centerY: (bounds.minY + bounds.maxY) / 2,
  }
}

const getNetLabelWidth = (
  inputProblem: InputProblem,
  label: NetLabelPlacement,
) => {
  const configuredWidth = inputProblem.netConnections.find(
    (connection) => connection.netId === label.netId,
  )?.netLabelWidth
  if (configuredWidth !== undefined) return configuredWidth

  return label.orientation === "y+" || label.orientation === "y-"
    ? label.height
    : label.width
}

const roundDistance = (distance: number) => Number(distance.toFixed(6))

const dedupeOrientations = (orientations: FacingDirection[]) => [
  ...new Set(orientations),
]

const normalizeFacingDirection = (
  value: string,
): FacingDirection | undefined => {
  switch (value) {
    case "x+":
    case "+x":
      return "x+"
    case "x-":
    case "-x":
      return "x-"
    case "y+":
    case "+y":
      return "y+"
    case "y-":
    case "-y":
      return "y-"
  }
}

const dedupeStrings = (values: Array<string | undefined>) => [
  ...new Set(values.filter((value): value is string => value !== undefined)),
]

const isSamePlacement = (
  label: NetLabelPlacement,
  point: Point,
  orientation: FacingDirection,
) =>
  Math.abs(point.x - label.anchorPoint.x) <= EPS &&
  Math.abs(point.y - label.anchorPoint.y) <= EPS &&
  orientation === label.orientation
