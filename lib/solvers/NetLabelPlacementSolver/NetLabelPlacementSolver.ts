import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem, PinId } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import { SingleNetLabelPlacementSolver } from "./SingleNetLabelPlacementSolver/SingleNetLabelPlacementSolver"
import type { FacingDirection } from "lib/utils/dir"
import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { getConnectivityMapsFromInputProblem } from "../MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { getNetLabelWidthForConnection } from "lib/utils/getNetLabelWidthForConnection"
import { getTraceConnectedPinComponents } from "lib/solvers/SchematicTraceLinesSolver/getTraceConnectedPinComponents"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import {
  getCenterFromAnchor,
  getDimsForOrientation,
  getRectBounds,
} from "./SingleNetLabelPlacementSolver/geometry"
import { rectIntersectsAnyTrace } from "./SingleNetLabelPlacementSolver/collisions"
import { rectIntersectsAnyTextBox } from "lib/utils/textBoxBounds"

/**
 * A group of traces that have at least one overlapping segment and
 * are part of the same global connectivity net
 */
export type OverlappingSameNetTraceGroup = {
  globalConnNetId: string
  netId?: string
  netLabelText?: string
  overlappingTraces?: SolvedTracePath
  portOnlyPinId?: string
  mspConnectionPairIds?: MspConnectionPairId[]
}

export interface NetLabelPlacement {
  globalConnNetId: string
  dcConnNetId?: string
  /**
   * Optional user-provided net identifier (if present in the input problem).
   */
  netId?: string
  /** User-facing label content, separate from the connectivity identifier. */
  netLabelText?: string
  /**
   * MSP pair ids that the label is associated with. Port-only labels use [].
   */
  mspConnectionPairIds: MspConnectionPairId[]
  /**
   * Pin ids relevant to this label. For a host trace, the two pins of that pair;
   * for a port-only label, the single port pin id.
   */
  pinIds: PinId[]
  orientation: FacingDirection

  /**
   * The anchor point is the point on the trace where the net label connects
   */
  anchorPoint: Point

  width: number
  height: number

  /**
   * The center point is computed from the anchor point, the width and height
   * and the orientation.
   */
  center: Point
}

/**
 * Places net labels in an available orientation along a trace in each group.
 *
 * Trace groups each receive either one net label or no net label if there
 * isn't a netId.
 *
 * The specific placement of the net label is solved for using the
 */
export class NetLabelPlacementSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>

  overlappingSameNetTraceGroups: Array<OverlappingSameNetTraceGroup>

  queuedOverlappingSameNetTraceGroups: Array<OverlappingSameNetTraceGroup>

  declare activeSubSolver: SingleNetLabelPlacementSolver | null

  netLabelPlacements: Array<NetLabelPlacement> = []
  failedGroups: Array<OverlappingSameNetTraceGroup> = []
  currentGroup: OverlappingSameNetTraceGroup | null = null
  triedAnyOrientationFallbackForCurrentGroup = false

  constructor(params: {
    inputProblem: InputProblem
    inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraceMap = params.inputTraceMap

    this.overlappingSameNetTraceGroups =
      this.computeOverlappingSameNetTraceGroups()

    this.queuedOverlappingSameNetTraceGroups = [
      ...this.overlappingSameNetTraceGroups,
    ]
  }

  computeOverlappingSameNetTraceGroups(): Array<OverlappingSameNetTraceGroup> {
    // Group existing traces by their global connectivity net id.
    const byGlobal: Record<string, Array<SolvedTracePath>> = {}
    for (const trace of Object.values(this.inputTraceMap)) {
      const key = trace.globalConnNetId
      if (!byGlobal[key]) byGlobal[key] = []
      byGlobal[key].push(trace)
    }

    // Build global connectivity from input so we also consider pins with no traces
    const { netConnMap } = getConnectivityMapsFromInputProblem(
      this.inputProblem,
    )

    const pinIdToPinMap = new Map<string, unknown>()
    for (const chip of this.inputProblem.chips) {
      for (const pin of chip.pins) {
        pinIdToPinMap.set(pin.pinId, pin)
      }
    }

    // Map pins to user-provided connectivity ids and display text (if any).
    const userNetIdByPinId: Record<string, string | undefined> = {}
    const netLabelTextByPinId: Record<string, string | undefined> = {}
    for (const dc of this.inputProblem.directConnections) {
      if (dc.netId) {
        const [a, b] = dc.pinIds
        userNetIdByPinId[a] = dc.netId
        userNetIdByPinId[b] = dc.netId
      }
      const netLabelText = dc.netLabelText?.trim()
      if (netLabelText) {
        const [a, b] = dc.pinIds
        netLabelTextByPinId[a] = netLabelText
        netLabelTextByPinId[b] = netLabelText
      }
    }
    for (const nc of this.inputProblem.netConnections) {
      for (const pid of nc.pinIds) {
        userNetIdByPinId[pid] = nc.netId
        const netLabelText = nc.netLabelText?.trim()
        if (netLabelText) netLabelTextByPinId[pid] = netLabelText
      }
    }

    const groups: Array<OverlappingSameNetTraceGroup> = []

    const allPinIds = this.inputProblem.chips.flatMap((c) =>
      c.pins.map((p) => p.pinId),
    )

    const allGlobalConnNetIds = new Set<string>()
    for (const pinId of allPinIds) {
      const netId = netConnMap.getNetConnectedToId(pinId)
      if (netId) {
        allGlobalConnNetIds.add(netId)
      }
    }

    // Consider every global connectivity net id
    for (const globalConnNetId of allGlobalConnNetIds) {
      const allIdsInNet = netConnMap.getIdsConnectedToNet(
        globalConnNetId,
      ) as string[]
      const pinsInNet = allIdsInNet.filter((id) => pinIdToPinMap.has(id))

      for (const traceConnectedComponent of getTraceConnectedPinComponents({
        pinIds: pinsInNet,
        traces: byGlobal[globalConnNetId] ?? [],
      })) {
        const component = new Set(traceConnectedComponent.pinIds)
        const compTraces = traceConnectedComponent.traces

        if (compTraces.length > 0) {
          // This routed trace exists specifically because two endpoint labels
          // could not fit in the available gap. Do not replace that pair with
          // one redundant long label on the newly routed wire. If routing had
          // failed there would be no trace here, so the port-only fallback
          // branch below would still label both endpoints.
          if (compTraces.some((trace) => trace.suppressNetLabel)) continue

          // Choose a representative trace (longest by L1 length)
          const lengthOf = (path: SolvedTracePath) => {
            let sum = 0
            const pts = path.tracePath
            for (let i = 0; i < pts.length - 1; i++) {
              sum +=
                Math.abs(pts[i + 1]!.x - pts[i]!.x) +
                Math.abs(pts[i + 1]!.y - pts[i]!.y)
            }
            return sum
          }
          let rep = compTraces[0]!
          let repLen = lengthOf(rep)
          for (let i = 1; i < compTraces.length; i++) {
            const len = lengthOf(compTraces[i]!)
            if (len > repLen) {
              rep = compTraces[i]!
              repLen = len
            }
          }

          let userNetId = compTraces.find((t) => t.userNetId != null)?.userNetId
          if (!userNetId) {
            for (const p of component) {
              if (userNetIdByPinId[p]) {
                userNetId = userNetIdByPinId[p]
                break
              }
            }
          }
          const mspConnectionPairIds = Array.from(
            new Set(
              compTraces.flatMap(
                (t) => t.mspConnectionPairIds ?? [t.mspPairId],
              ),
            ),
          )

          const group = {
            globalConnNetId,
            netId: userNetId,
            netLabelText: [...component]
              .map((pinId) => netLabelTextByPinId[pinId])
              .find((text): text is string => Boolean(text)),
            overlappingTraces: rep,
            mspConnectionPairIds,
          }
          groups.push(group)
        } else {
          // No traces in this component: place label at each pin that has a user net id
          for (const p of component) {
            const userNetId = userNetIdByPinId[p]
            if (!userNetId) continue
            groups.push({
              globalConnNetId,
              netId: userNetId,
              netLabelText: netLabelTextByPinId[p],
              portOnlyPinId: p,
            })
          }
        }
      }
    }

    return groups
  }

  private getNetLabelWidthForGroup(
    group: OverlappingSameNetTraceGroup,
  ): number | undefined {
    const pinIds = group.overlappingTraces?.pins.map((p) => p.pinId) ?? []
    if (group.portOnlyPinId) {
      pinIds.push(group.portOnlyPinId)
    }
    return getNetLabelWidthForConnection({
      inputProblem: this.inputProblem,
      netId: group.netId,
      pinIds,
      isPortOnlyLabel: group.portOnlyPinId !== undefined,
    })
  }

  private getNetLabelHeightForGroup(
    group: OverlappingSameNetTraceGroup,
  ): number | undefined {
    if (group.netId) {
      const ncHeight = this.inputProblem.netConnections.find(
        (nc) => nc.netId === group.netId,
      )?.netLabelHeight
      if (ncHeight !== undefined) return ncHeight
    }

    const pinIds = group.overlappingTraces?.pins.map((p) => p.pinId) ?? []
    if (group.portOnlyPinId) {
      pinIds.push(group.portOnlyPinId)
    }

    return this.inputProblem.netConnections.find((nc) =>
      nc.pinIds.some((pid) => pinIds.includes(pid)),
    )?.netLabelHeight
  }

  override _step() {
    if (this.activeSubSolver?.solved) {
      this.netLabelPlacements.push(this.activeSubSolver.netLabelPlacement!)
      this.activeSubSolver = null
      this.currentGroup = null
      this.triedAnyOrientationFallbackForCurrentGroup = false
      return
    }

    if (this.activeSubSolver?.failed) {
      // Retry once with all orientations as a fallback before failing
      const fullOrients: FacingDirection[] = ["x+", "x-", "y+", "y-"]
      const currOrients = this.activeSubSolver.availableOrientations
      const isAlreadyFull =
        currOrients.length === 4 &&
        fullOrients.every((o) => currOrients.includes(o))

      if (
        !this.triedAnyOrientationFallbackForCurrentGroup &&
        !isAlreadyFull &&
        this.currentGroup
      ) {
        this.triedAnyOrientationFallbackForCurrentGroup = true
        const netLabelWidth = this.getNetLabelWidthForGroup(this.currentGroup)
        const netLabelHeight = this.getNetLabelHeightForGroup(this.currentGroup)
        this.activeSubSolver = new SingleNetLabelPlacementSolver({
          inputProblem: this.inputProblem,
          inputTraceMap: this.inputTraceMap,
          overlappingSameNetTraceGroup: this.currentGroup,
          availableOrientations: fullOrients,
          netLabelWidth,
          netLabelHeight,
        })
        return
      }

      // Record the failure for this group and continue to the next one
      if (this.currentGroup) {
        this.failedGroups.push(this.currentGroup)
      }
      this.activeSubSolver = null
      this.currentGroup = null
      this.triedAnyOrientationFallbackForCurrentGroup = false
      return
    }

    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      return
    }

    const nextOverlappingSameNetTraceGroup =
      this.queuedOverlappingSameNetTraceGroups.shift()

    if (!nextOverlappingSameNetTraceGroup) {
      this.resolvePortOnlyOverlapsWithEndpointAxialFallback()
      this.solved = true
      return
    }

    const netId =
      nextOverlappingSameNetTraceGroup.netId ??
      nextOverlappingSameNetTraceGroup.globalConnNetId

    this.currentGroup = nextOverlappingSameNetTraceGroup
    this.triedAnyOrientationFallbackForCurrentGroup = false

    const netLabelWidth = this.getNetLabelWidthForGroup(this.currentGroup)
    const netLabelHeight = this.getNetLabelHeightForGroup(this.currentGroup)

    this.activeSubSolver = new SingleNetLabelPlacementSolver({
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
      overlappingSameNetTraceGroup: nextOverlappingSameNetTraceGroup,
      availableOrientations: this.inputProblem.availableNetLabelOrientations[
        netId
      ] ?? ["x+", "x-", "y+", "y-"],
      netLabelWidth,
      netLabelHeight,
    })
  }

  private resolvePortOnlyOverlapsWithEndpointAxialFallback() {
    const EPS = 1e-6
    const boundsOverlap = (
      a: { minX: number; minY: number; maxX: number; maxY: number },
      b: { minX: number; minY: number; maxX: number; maxY: number },
    ) =>
      a.minX < b.maxX - 1e-9 &&
      a.maxX > b.minX + 1e-9 &&
      a.minY < b.maxY - 1e-9 &&
      a.maxY > b.minY + 1e-9

    const portOnlyLabels = this.netLabelPlacements.filter(
      (label) => label.mspConnectionPairIds.length === 0,
    )
    if (portOnlyLabels.length === 0) return

    const chipIndex =
      this.inputProblem._chipObstacleSpatialIndex ??
      new ChipObstacleSpatialIndex(this.inputProblem.chips)

    for (let i = 0; i < this.netLabelPlacements.length; i++) {
      const label = this.netLabelPlacements[i]!
      if (label.mspConnectionPairIds.length !== 1) continue
      const trace = this.inputTraceMap[label.mspConnectionPairIds[0]!]
      if (!trace || trace.tracePath.length !== 2) continue

      const labelBounds = getRectBounds(label.center, label.width, label.height)
      const collidingPortLabels = portOnlyLabels.filter(
        (portLabel) =>
          portLabel.globalConnNetId !== label.globalConnNetId &&
          boundsOverlap(
            labelBounds,
            getRectBounds(portLabel.center, portLabel.width, portLabel.height),
          ),
      )
      if (collidingPortLabels.length === 0) continue

      const [segStart, segEnd] = trace.tracePath as [Point, Point]
      const isHorizontal = Math.abs(segStart.y - segEnd.y) < EPS
      const isVertical = Math.abs(segStart.x - segEnd.x) < EPS
      if (!isHorizontal && !isVertical) continue

      const netLabelWidth =
        label.orientation === "x+" || label.orientation === "x-"
          ? label.width
          : label.height
      const netLabelHeight =
        label.orientation === "x+" || label.orientation === "x-"
          ? label.height
          : label.width

      const netKey = label.netId ?? label.globalConnNetId
      const allowedOrientations = this.inputProblem
        .availableNetLabelOrientations[netKey] ?? ["x+", "x-", "y+", "y-"]

      const endpointCandidates: Array<{
        anchor: Point
        orientation: FacingDirection
      }> = isHorizontal
        ? [
            {
              anchor: segStart,
              orientation: segStart.x < segEnd.x ? "x-" : "x+",
            },
            {
              anchor: segEnd,
              orientation: segEnd.x < segStart.x ? "x-" : "x+",
            },
          ]
        : [
            {
              anchor: segStart,
              orientation: segStart.y < segEnd.y ? "y-" : "y+",
            },
            {
              anchor: segEnd,
              orientation: segEnd.y < segStart.y ? "y-" : "y+",
            },
          ]

      for (const { anchor, orientation } of endpointCandidates) {
        if (!allowedOrientations.includes(orientation)) continue
        const { width, height } = getDimsForOrientation({
          orientation,
          netLabelWidth,
          netLabelHeight,
        })
        const center = getCenterFromAnchor(anchor, orientation, width, height)
        const outward =
          orientation === "x+"
            ? { x: 1, y: 0 }
            : orientation === "x-"
              ? { x: -1, y: 0 }
              : orientation === "y+"
                ? { x: 0, y: 1 }
                : { x: 0, y: -1 }
        const testCenter = {
          x: center.x + outward.x * 1e-4,
          y: center.y + outward.y * 1e-4,
        }
        const bounds = getRectBounds(testCenter, width, height)
        if (chipIndex.getChipsInBounds(bounds).length > 0) continue
        if (rectIntersectsAnyTextBox(bounds, this.inputProblem)) continue
        if (
          rectIntersectsAnyTrace(bounds, this.inputTraceMap, trace.mspPairId, 0)
            .hasIntersection
        ) {
          continue
        }
        if (
          collidingPortLabels.some((portLabel) =>
            boundsOverlap(
              bounds,
              getRectBounds(
                portLabel.center,
                portLabel.width,
                portLabel.height,
              ),
            ),
          )
        ) {
          continue
        }

        this.netLabelPlacements[i] = {
          ...label,
          orientation,
          anchorPoint: anchor,
          width,
          height,
          center,
        }
        break
      }
    }
  }

  override visualize(): GraphicsObject {
    if (this.activeSubSolver) {
      return this.activeSubSolver.visualize()
    }
    const graphics = visualizeInputProblem(this.inputProblem)

    for (const trace of Object.values(this.inputTraceMap)) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    for (const p of this.netLabelPlacements) {
      graphics.rects!.push({
        center: p.center,
        width: p.width,
        height: p.height,
        fill: getColorFromString(p.globalConnNetId, 0.35),
        strokeColor: getColorFromString(p.globalConnNetId, 0.9),
        label: `netId: ${p.netId}\nglobalConnNetId: ${p.globalConnNetId}`,
      } as any)
      graphics.points!.push({
        x: p.anchorPoint.x,
        y: p.anchorPoint.y,
        color: getColorFromString(p.globalConnNetId, 0.9),
        label: `anchorPoint\norientation: ${p.orientation}`,
      } as any)
    }

    return graphics
  }
}
