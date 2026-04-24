import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import {
  getDimsForOrientation,
  getCenterFromAnchor,
  getRectBounds,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import {
  rectIntersectsAnyTrace,
  segmentIntersectsRect,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { getPinDirection } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import type { InputProblem } from "lib/types/InputProblem"
import type {
  NetLabelPlacement,
  OverlappingSameNetTraceGroup,
} from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { FacingDirection } from "lib/utils/dir"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"

const SEARCH_STEP = 0.1

interface SinglePortLabelTraceCollisionSolverInput {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  netLabelPlacements: NetLabelPlacement[]
}

type PlacementCandidate = {
  center: { x: number; y: number }
  width: number
  height: number
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  anchor: { x: number; y: number }
  orientation: FacingDirection
  status: "ok" | "chip-collision" | "trace-collision" | "parallel-to-segment"
  hostSegIndex: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const dedupeConsecutivePoints = (points: Array<{ x: number; y: number }>) => {
  const deduped: Array<{ x: number; y: number }> = []

  for (const point of points) {
    const prev = deduped[deduped.length - 1]
    if (prev && prev.x === point.x && prev.y === point.y) continue
    deduped.push(point)
  }

  return deduped
}

const pathIntersectsAnyChip = (params: {
  path: Array<{ x: number; y: number }>
  chipObstacleSpatialIndex: ChipObstacleSpatialIndex
}) => {
  const { path, chipObstacleSpatialIndex } = params

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i]!
    const p2 = path[i + 1]!
    const bounds = {
      minX: Math.min(p1.x, p2.x),
      minY: Math.min(p1.y, p2.y),
      maxX: Math.max(p1.x, p2.x),
      maxY: Math.max(p1.y, p2.y),
    }

    for (const chip of chipObstacleSpatialIndex.getChipsInBounds(bounds)) {
      if (segmentIntersectsRect(p1, p2, chip.bounds)) {
        return true
      }
    }
  }

  return false
}

const getConnectorPath = (params: {
  anchor: { x: number; y: number }
  center: { x: number; y: number }
  width: number
  height: number
  orientation: FacingDirection
  pinFacingDirection: FacingDirection
}) => {
  const { anchor, center, width, height, orientation, pinFacingDirection } =
    params
  const bounds = getRectBounds(center, width, height)
  const getElbow = (target: { x: number; y: number }) =>
    pinFacingDirection === "x+" || pinFacingDirection === "x-"
      ? { x: target.x, y: anchor.y }
      : { x: anchor.x, y: target.y }

  if (orientation === "x+") {
    const target = {
      x: bounds.minX,
      y: clamp(anchor.y, bounds.minY, bounds.maxY),
    }
    const elbow = getElbow(target)
    return dedupeConsecutivePoints([anchor, elbow, target])
  }

  if (orientation === "x-") {
    const target = {
      x: bounds.maxX,
      y: clamp(anchor.y, bounds.minY, bounds.maxY),
    }
    const elbow = getElbow(target)
    return dedupeConsecutivePoints([anchor, elbow, target])
  }

  if (orientation === "y+") {
    const target = {
      x: clamp(anchor.x, bounds.minX, bounds.maxX),
      y: bounds.minY,
    }
    const elbow = getElbow(target)
    return dedupeConsecutivePoints([anchor, elbow, target])
  }

  const target = {
    x: clamp(anchor.x, bounds.minX, bounds.maxX),
    y: bounds.maxY,
  }
  const elbow = getElbow(target)
  return dedupeConsecutivePoints([anchor, elbow, target])
}

const getPortOnlyPinContext = (params: {
  inputProblem: InputProblem
  pinId: string
}):
  | {
      anchor: { x: number; y: number }
      pinFacingDirection: FacingDirection
      pinChip: InputProblem["chips"][number]
    }
  | undefined => {
  const { inputProblem, pinId } = params

  for (const chip of inputProblem.chips) {
    const pin = chip.pins.find((candidate) => candidate.pinId === pinId)
    if (!pin) continue

    return {
      anchor: { x: pin.x, y: pin.y },
      pinFacingDirection: pin._facingDirection || getPinDirection(pin, chip),
      pinChip: chip,
    }
  }
}

const createPlacement = (params: {
  group: OverlappingSameNetTraceGroup
  pinId: string
  anchor: { x: number; y: number }
  orientation: FacingDirection
  width: number
  height: number
  center: { x: number; y: number }
}): NetLabelPlacement => ({
  globalConnNetId: params.group.globalConnNetId,
  dcConnNetId: undefined,
  netId: params.group.netId,
  mspConnectionPairIds: [],
  pinIds: [params.pinId],
  orientation: params.orientation,
  anchorPoint: params.anchor,
  width: params.width,
  height: params.height,
  center: params.center,
})

const createConnectorTraceForPlacement = (params: {
  inputProblem: InputProblem
  placement: NetLabelPlacement
  connectorPath: Array<{ x: number; y: number }>
}): SolvedTracePath | null => {
  const { inputProblem, placement, connectorPath } = params
  const pinId = placement.pinIds[0]
  if (!pinId || connectorPath.length < 2) return null

  const bounds = getRectBounds(
    placement.center,
    placement.width,
    placement.height,
  )
  const anchor = placement.anchorPoint
  const EPS = 1e-6
  const CONTACT_TOLERANCE = 2e-3
  const anchorTouchesLabel =
    anchor.x >= bounds.minX - EPS &&
    anchor.x <= bounds.maxX + EPS &&
    anchor.y >= bounds.minY - EPS &&
    anchor.y <= bounds.maxY + EPS

  if (anchorTouchesLabel) return null

  const labelTouchesChip = inputProblem.chips.some((chip) => {
    const chipBounds = {
      minX: chip.center.x - chip.width / 2,
      minY: chip.center.y - chip.height / 2,
      maxX: chip.center.x + chip.width / 2,
      maxY: chip.center.y + chip.height / 2,
    }
    const overlapsX =
      bounds.maxX >= chipBounds.minX - EPS &&
      bounds.minX <= chipBounds.maxX + EPS
    const overlapsY =
      bounds.maxY >= chipBounds.minY - CONTACT_TOLERANCE &&
      bounds.minY <= chipBounds.maxY + CONTACT_TOLERANCE
    const touchesVerticalEdge =
      Math.abs(bounds.maxX - chipBounds.minX) <= CONTACT_TOLERANCE ||
      Math.abs(bounds.minX - chipBounds.maxX) <= CONTACT_TOLERANCE
    const touchesHorizontalEdge =
      Math.abs(bounds.maxY - chipBounds.minY) <= CONTACT_TOLERANCE ||
      Math.abs(bounds.minY - chipBounds.maxY) <= CONTACT_TOLERANCE

    return (
      (touchesVerticalEdge && overlapsY) || (touchesHorizontalEdge && overlapsX)
    )
  })

  if (labelTouchesChip) return null

  for (const chip of inputProblem.chips) {
    const pin = chip.pins.find((candidate) => candidate.pinId === pinId)
    if (!pin) continue

    const pinWithChip = { ...pin, chipId: chip.chipId }

    return {
      mspPairId: `netlabel_connector:${placement.globalConnNetId}:${pinId}`,
      dcConnNetId: placement.dcConnNetId ?? placement.globalConnNetId,
      globalConnNetId: placement.globalConnNetId,
      userNetId: placement.netId,
      pins: [pinWithChip, pinWithChip],
      tracePath: connectorPath,
      mspConnectionPairIds: [],
      pinIds: [pinId],
    }
  }

  return null
}

const solveDetachedPortOnlyPin = (params: {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  chipObstacleSpatialIndex: ChipObstacleSpatialIndex
  group: OverlappingSameNetTraceGroup
  availableOrientations: FacingDirection[]
  netLabelWidth?: number
}): {
  placement: NetLabelPlacement | null
  connectorPath?: Array<{ x: number; y: number }>
  testedCandidates: PlacementCandidate[]
} => {
  const {
    inputProblem,
    inputTraceMap,
    chipObstacleSpatialIndex,
    group,
    availableOrientations,
    netLabelWidth,
  } = params

  const pinId = group.portOnlyPinId
  if (!pinId) {
    return {
      placement: null,
      testedCandidates: [],
    }
  }

  const pinContext = getPortOnlyPinContext({ inputProblem, pinId })
  if (!pinContext) {
    return {
      placement: null,
      testedCandidates: [],
    }
  }

  const { anchor, pinFacingDirection, pinChip } = pinContext
  const orientations =
    availableOrientations.length > 0
      ? availableOrientations
      : (["x+", "x-", "y+", "y-"] as FacingDirection[])

  const outwardOf = (orientation: FacingDirection) =>
    orientation === "x+"
      ? { x: 1, y: 0 }
      : orientation === "x-"
        ? { x: -1, y: 0 }
        : orientation === "y+"
          ? { x: 0, y: 1 }
          : { x: 0, y: -1 }
  const tangentOf = (orientation: FacingDirection) =>
    orientation === "x+" || orientation === "x-"
      ? { x: 0, y: 1 }
      : { x: 1, y: 0 }
  const getSteppedDistances = (maxReach: number) => {
    const snappedMaxReach =
      Math.ceil(maxReach / SEARCH_STEP) * SEARCH_STEP + SEARCH_STEP / 2
    const distances = [0]
    for (
      let distance = SEARCH_STEP;
      distance <= snappedMaxReach;
      distance += SEARCH_STEP
    ) {
      distances.push(Number(distance.toFixed(6)))
    }
    return distances
  }

  const testedCenters = new Set<string>()
  const testedCandidates: PlacementCandidate[] = []
  const baseOffset = 1e-3
  const chipBounds = {
    minX: pinChip.center.x - pinChip.width / 2,
    minY: pinChip.center.y - pinChip.height / 2,
    maxX: pinChip.center.x + pinChip.width / 2,
    maxY: pinChip.center.y + pinChip.height / 2,
  }

  const tryCandidateCenter = (params: {
    orientation: FacingDirection
    width: number
    height: number
    center: { x: number; y: number }
  }) => {
    const { orientation, width, height, center } = params
    const centerKey = `${orientation}:${width}:${height}:${center.x.toFixed(6)},${center.y.toFixed(6)}`
    if (testedCenters.has(centerKey)) return null
    testedCenters.add(centerKey)

    const bounds = getRectBounds(center, width, height)
    const connectorPath = getConnectorPath({
      anchor,
      center,
      width,
      height,
      orientation,
      pinFacingDirection,
    })

    const chips = chipObstacleSpatialIndex.getChipsInBounds(bounds)
    if (
      chips.length > 0 ||
      pathIntersectsAnyChip({
        path: connectorPath,
        chipObstacleSpatialIndex,
      })
    ) {
      testedCandidates.push({
        center,
        width,
        height,
        bounds,
        anchor,
        orientation,
        status: "chip-collision",
        hostSegIndex: -1,
      })
      return null
    }

    const traceIntersectionResult = rectIntersectsAnyTrace(
      bounds,
      inputTraceMap,
      "" as MspConnectionPairId,
      -1,
    )
    if (traceIntersectionResult.hasIntersection) {
      testedCandidates.push({
        center,
        width,
        height,
        bounds,
        anchor,
        orientation,
        status: "trace-collision",
        hostSegIndex: -1,
      })
      return null
    }

    testedCandidates.push({
      center,
      width,
      height,
      bounds,
      anchor,
      orientation,
      status: "ok",
      hostSegIndex: -1,
    })

    return {
      placement: createPlacement({
        group,
        pinId,
        anchor,
        orientation,
        width,
        height,
        center,
      }),
      connectorPath,
      testedCandidates,
    }
  }

  for (const orientation of orientations) {
    const { width, height } = getDimsForOrientation({
      orientation,
      netLabelWidth,
    })
    const baseCenter = getCenterFromAnchor(anchor, orientation, width, height)
    const outward = outwardOf(orientation)
    const tangent = tangentOf(orientation)
    const tangentReach =
      orientation === "x+" || orientation === "x-"
        ? pinChip.height / 2 + height / 2 + SEARCH_STEP
        : pinChip.width / 2 + width / 2 + SEARCH_STEP
    const outwardReach =
      orientation === "x+" || orientation === "x-" ? width : height

    const outwardDistances = getSteppedDistances(outwardReach)
    const steppedSlideOffsets = getSteppedDistances(tangentReach).slice(1)

    if (orientation === "y+" || orientation === "y-") {
      for (const slideOffset of [
        0,
        ...steppedSlideOffsets.flatMap((offset) => [offset, -offset]),
      ]) {
        const center = {
          x: baseCenter.x + tangent.x * slideOffset,
          y: baseCenter.y + outward.y * baseOffset,
        }
        const result = tryCandidateCenter({
          orientation,
          width,
          height,
          center,
        })
        if (result) return result
      }

      for (const outwardDistance of outwardDistances.slice(1)) {
        const center = {
          x: baseCenter.x + outward.x * (baseOffset + outwardDistance),
          y: baseCenter.y + outward.y * (baseOffset + outwardDistance),
        }
        const result = tryCandidateCenter({
          orientation,
          width,
          height,
          center,
        })
        if (result) return result
      }

      for (const outwardDistance of outwardDistances.slice(1)) {
        for (const slideOffset of steppedSlideOffsets.flatMap((offset) => [
          offset,
          -offset,
        ])) {
          const center = {
            x:
              baseCenter.x +
              outward.x * (baseOffset + outwardDistance) +
              tangent.x * slideOffset,
            y:
              baseCenter.y +
              outward.y * (baseOffset + outwardDistance) +
              tangent.y * slideOffset,
          }
          const result = tryCandidateCenter({
            orientation,
            width,
            height,
            center,
          })
          if (result) return result
        }
      }

      continue
    }

    for (const outwardDistance of outwardDistances) {
      const center = {
        x: baseCenter.x + outward.x * (baseOffset + outwardDistance),
        y: baseCenter.y + outward.y * (baseOffset + outwardDistance),
      }
      const result = tryCandidateCenter({
        orientation,
        width,
        height,
        center,
      })
      if (result) return result
    }

    for (const slideOffset of steppedSlideOffsets.flatMap((offset) => [
      offset,
      -offset,
    ])) {
      for (const outwardDistance of outwardDistances) {
        const center = {
          x:
            baseCenter.x +
            outward.x * (baseOffset + outwardDistance) +
            tangent.x * slideOffset,
          y:
            baseCenter.y +
            outward.y * (baseOffset + outwardDistance) +
            tangent.y * slideOffset,
        }
        const result = tryCandidateCenter({
          orientation,
          width,
          height,
          center,
        })
        if (result) return result
      }
    }
  }

  // If moving in the label-facing direction cannot clear the chip, search
  // around the chip perimeter while preserving the requested orientation.
  // First sweep along +/-x at the anchor y. Only after that horizontal reach
  // is exhausted should we start trying alternate fixed y rows.
  for (const orientation of orientations) {
    const { width, height } = getDimsForOrientation({
      orientation,
      netLabelWidth,
    })
    const horizontalReach = pinChip.width / 2 + width + SEARCH_STEP
    const verticalReach = pinChip.height / 2 + height + SEARCH_STEP
    const xOffsets = [
      0,
      ...getSteppedDistances(horizontalReach)
        .slice(1)
        .flatMap((offset) => [offset, -offset]),
    ]

    for (const xOffset of xOffsets) {
      const result = tryCandidateCenter({
        orientation,
        width,
        height,
        center: {
          x: anchor.x + xOffset,
          y: anchor.y,
        },
      })
      if (result) return result
    }

    const yCenters = [
      chipBounds.maxY + height / 2 + baseOffset,
      chipBounds.minY - height / 2 - baseOffset,
    ]

    for (const y of yCenters) {
      for (const xOffset of xOffsets) {
        const result = tryCandidateCenter({
          orientation,
          width,
          height,
          center: {
            x: anchor.x + xOffset,
            y,
          },
        })
        if (result) return result
      }
    }
  }

  return {
    placement: null,
    testedCandidates,
  }
}

export class SinglePortLabelTraceCollisionSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  inputNetLabelPlacements: NetLabelPlacement[]
  chipObstacleSpatialIndex: ChipObstacleSpatialIndex

  pendingPlacements: NetLabelPlacement[] = []
  netLabelPlacements: NetLabelPlacement[] = []
  connectorTracePaths: SolvedTracePath[] = []
  testedCandidates: PlacementCandidate[] = []
  fixedPlacements: NetLabelPlacement[] = []
  currentPlacement: NetLabelPlacement | null = null
  currentDetachedPlacement: ReturnType<typeof solveDetachedPortOnlyPin> | null =
    null
  currentCandidateIndex = -1

  constructor(params: SinglePortLabelTraceCollisionSolverInput) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraceMap = params.inputTraceMap
    this.inputNetLabelPlacements = params.netLabelPlacements
    this.pendingPlacements = [...params.netLabelPlacements]
    this.netLabelPlacements = []
    this.chipObstacleSpatialIndex =
      params.inputProblem._chipObstacleSpatialIndex ??
      new ChipObstacleSpatialIndex(params.inputProblem.chips)
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SinglePortLabelTraceCollisionSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
      netLabelPlacements: this.inputNetLabelPlacements,
    }
  }

  private isSinglePortLabel(placement: NetLabelPlacement) {
    return (
      placement.mspConnectionPairIds.length === 0 &&
      placement.pinIds.length === 1
    )
  }

  private getAvailableOrientations(
    placement: NetLabelPlacement,
  ): FacingDirection[] {
    const netId = placement.netId ?? placement.globalConnNetId
    const availableNetLabelOrientations =
      this.inputProblem.availableNetLabelOrientations

    if (!availableNetLabelOrientations) {
      return ["x+", "x-"]
    }

    return (
      availableNetLabelOrientations[netId] ?? [
        "x+",
        "x-",
        "y+",
        "y-",
      ]
    )
  }

  private hasDisallowedOrientation(placement: NetLabelPlacement) {
    const availableOrientations = this.getAvailableOrientations(placement)
    return (
      availableOrientations.length > 0 &&
      !availableOrientations.includes(placement.orientation)
    )
  }

  private getNetLabelWidth(placement: NetLabelPlacement) {
    if (!placement.netId) return undefined

    return this.inputProblem.netConnections.find(
      (nc) => nc.netId === placement.netId,
    )?.netLabelWidth
  }

  private hasTraceCollision(placement: NetLabelPlacement) {
    const bounds = getRectBounds(
      placement.center,
      placement.width,
      placement.height,
    )
    return rectIntersectsAnyTrace(
      bounds,
      this.inputTraceMap,
      "" as MspConnectionPairId,
      -1,
    ).hasIntersection
  }

  private hasChipCollision(placement: NetLabelPlacement) {
    const bounds = getRectBounds(
      placement.center,
      placement.width,
      placement.height,
    )
    return this.chipObstacleSpatialIndex.getChipsInBounds(bounds).length > 0
  }

  private appendPlacement(placement: NetLabelPlacement) {
    this.netLabelPlacements.push(placement)
  }

  private finalizeCurrentPlacement() {
    if (!this.currentPlacement) return

    const detachedPlacement = this.currentDetachedPlacement

    if (!detachedPlacement?.placement || !detachedPlacement.connectorPath) {
      this.appendPlacement(this.currentPlacement)
    } else {
      this.appendPlacement(detachedPlacement.placement)
      this.fixedPlacements.push(detachedPlacement.placement)
      const connectorTrace = createConnectorTraceForPlacement({
        inputProblem: this.inputProblem,
        placement: detachedPlacement.placement,
        connectorPath: detachedPlacement.connectorPath,
      })
      if (connectorTrace) {
        this.connectorTracePaths.push(connectorTrace)
      }
    }

    this.currentPlacement = null
    this.currentDetachedPlacement = null
    this.currentCandidateIndex = -1
    this.testedCandidates = []
  }

  override _step() {
    if (this.currentPlacement && this.currentDetachedPlacement) {
      const candidates = this.currentDetachedPlacement.testedCandidates

      if (
        candidates.length === 0 ||
        this.currentCandidateIndex >= candidates.length - 1
      ) {
        this.finalizeCurrentPlacement()
        return
      }

      this.currentCandidateIndex += 1
      this.testedCandidates = candidates.slice(
        0,
        this.currentCandidateIndex + 1,
      )
      return
    }

    while (this.pendingPlacements.length > 0) {
      const placement = this.pendingPlacements.shift()!

      if (!this.isSinglePortLabel(placement)) {
        this.appendPlacement(placement)
        continue
      }

      const pinId = placement.pinIds[0]
      if (!pinId) {
        this.appendPlacement(placement)
        continue
      }

      const needsOrientationFix = this.hasDisallowedOrientation(placement)
      const hasTraceCollision = this.hasTraceCollision(placement)
      const hasChipCollision = this.hasChipCollision(placement)

      if (!needsOrientationFix && !hasTraceCollision && !hasChipCollision) {
        this.appendPlacement(placement)
        continue
      }

      const group = {
        globalConnNetId: placement.globalConnNetId,
        netId: placement.netId,
        portOnlyPinId: pinId,
      }
      const availableOrientations = this.getAvailableOrientations(placement)
      const netLabelWidth = this.getNetLabelWidth(placement)

      this.currentPlacement = placement
      this.currentDetachedPlacement = solveDetachedPortOnlyPin({
        inputProblem: this.inputProblem,
        inputTraceMap: this.inputTraceMap,
        chipObstacleSpatialIndex: this.chipObstacleSpatialIndex,
        group,
        availableOrientations,
        netLabelWidth,
      })
      this.currentCandidateIndex = -1
      this.testedCandidates = []

      if (this.currentDetachedPlacement.testedCandidates.length === 0) {
        this.finalizeCurrentPlacement()
        continue
      }

      return
    }

    this.solved = true
  }

  getOutput() {
    return {
      netLabelPlacements: this.netLabelPlacements,
      connectorTracePaths: this.connectorTracePaths,
      fixedPlacements: this.fixedPlacements,
    }
  }

  override visualize(): GraphicsObject {
    if (
      this.solved &&
      this.fixedPlacements.length === 0 &&
      this.connectorTracePaths.length === 0
    ) {
      return {}
    }

    if (
      !this.solved &&
      this.testedCandidates.length === 0 &&
      this.connectorTracePaths.length === 0 &&
      this.netLabelPlacements.length === 0 &&
      !this.currentPlacement &&
      this.pendingPlacements.length === 0
    ) {
      return {}
    }

    const graphics = visualizeInputProblem(this.inputProblem)
    const placementsToRender =
      !this.solved &&
      this.netLabelPlacements.length === 0 &&
      !this.currentPlacement &&
      this.pendingPlacements.length > 0
        ? this.inputNetLabelPlacements
        : this.netLabelPlacements

    for (const rect of graphics.rects ?? []) {
      if (rect.label) {
        rect.label = `CHIP\n${rect.label}`
      }
    }

    for (const trace of [
      ...Object.values(this.inputTraceMap),
      ...this.connectorTracePaths,
    ]) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    if (this.solved) {
      for (const placement of this.netLabelPlacements) {
        const color = getColorFromString(placement.globalConnNetId, 0.9)
        graphics.rects!.push({
          center: placement.center,
          width: placement.width,
          height: placement.height,
          fill: getColorFromString(placement.globalConnNetId, 0.35),
          strokeColor: color,
          label:
            placement.netId && placement.netId !== placement.globalConnNetId
              ? `PLACED NET LABEL\n${placement.netId}\n${placement.globalConnNetId}`
              : `PLACED NET LABEL\n${placement.netId ?? placement.globalConnNetId}`,
        } as any)
        graphics.points!.push({
          x: placement.anchorPoint.x,
          y: placement.anchorPoint.y,
          color,
          label: `ANCHOR\n${placement.orientation}`,
        } as any)
      }

      return graphics
    }

    for (const placement of placementsToRender) {
      const color = getColorFromString(placement.globalConnNetId, 0.9)
      graphics.rects!.push({
        center: placement.center,
        width: placement.width,
        height: placement.height,
        fill: getColorFromString(placement.globalConnNetId, 0.18),
        strokeColor: color,
        label:
          placement.netId && placement.netId !== placement.globalConnNetId
            ? `PLACED NET LABEL\n${placement.netId}\n${placement.globalConnNetId}`
            : `PLACED NET LABEL\n${placement.netId ?? placement.globalConnNetId}`,
      } as any)
      graphics.points!.push({
        x: placement.anchorPoint.x,
        y: placement.anchorPoint.y,
        color,
        label: `ANCHOR\n${placement.orientation}`,
      } as any)
    }

    if (this.currentPlacement) {
      const color = getColorFromString(
        this.currentPlacement.globalConnNetId,
        0.9,
      )
      graphics.rects!.push({
        center: this.currentPlacement.center,
        width: this.currentPlacement.width,
        height: this.currentPlacement.height,
        fill: "rgba(80, 80, 80, 0.15)",
        strokeColor: color,
        label:
          this.currentPlacement.netId &&
          this.currentPlacement.netId !== this.currentPlacement.globalConnNetId
            ? `CURRENT NET LABEL\n${this.currentPlacement.netId}\n${this.currentPlacement.globalConnNetId}`
            : `CURRENT NET LABEL\n${this.currentPlacement.netId ?? this.currentPlacement.globalConnNetId}`,
      } as any)
      graphics.points!.push({
        x: this.currentPlacement.anchorPoint.x,
        y: this.currentPlacement.anchorPoint.y,
        color,
        label: `CURRENT ANCHOR\n${this.currentPlacement.orientation}`,
      } as any)
    }

    for (const c of this.testedCandidates) {
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

    for (const placement of this.fixedPlacements) {
      const color = getColorFromString(placement.globalConnNetId, 0.9)
      graphics.rects!.push({
        center: placement.center,
        width: placement.width,
        height: placement.height,
        fill: getColorFromString(placement.globalConnNetId, 0.35),
        strokeColor: color,
        label:
          placement.netId && placement.netId !== placement.globalConnNetId
            ? `PLACED NET LABEL\n${placement.netId}\n${placement.globalConnNetId}`
            : `PLACED NET LABEL\n${placement.netId ?? placement.globalConnNetId}`,
      } as any)
      graphics.points!.push({
        x: placement.anchorPoint.x,
        y: placement.anchorPoint.y,
        color,
        label: `ANCHOR\n${placement.orientation}`,
      } as any)
    }

    return graphics
  }
}
