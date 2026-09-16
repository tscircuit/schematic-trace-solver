import { getLocalTraceLabelShifts } from "./getLocalTraceLabelShifts"
import {
  getOutputLabelCollisions,
  sameOutputLabelCollision,
  type OutputLabelCollision,
} from "./getOutputLabelCollisions"
import { getInlineLabelObstacles } from "./getInlineLabelObstacles"
import { NetLabelNetLabelCollisionSolver } from "../NetLabelNetLabelCollisionSolver/NetLabelNetLabelCollisionSolver"
import type { Bounds, Point } from "@tscircuit/math-utils"
import type { GraphicsObject, Rect, Text } from "graphics-debug"
import type { ConnectivityMap } from "connectivity-map"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getTraceConnectedPinComponents } from "lib/solvers/SchematicTraceLinesSolver/getTraceConnectedPinComponents"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getPinDirection } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { CompletedTraceReroute } from "lib/solvers/TraceElbowTransitionSimplificationSolver/types"
import type {
  InputDirectConnection,
  InputNetConnection,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { boundsOverlap, getTextBoxBounds } from "lib/utils/textBoxBounds"
import { isLabelRepresentedInline } from "./isLabelRepresentedInline"
import { alignPortOnlyInlineNetLabelStubs } from "./alignPortOnlyInlineNetLabelStubs"
import {
  type AxisAlignedSegment,
  getAxisAlignedSegments,
} from "./getAxisAlignedSegments"
import { getAnchoredNetLabelRenderedBounds } from "./getAnchoredNetLabelRenderedBounds"
import { pushAnchoredNetLabelsAwayFromInlineLabels } from "./pushAnchoredNetLabelsAwayFromInlineLabels"
import { pushInlineTerminalLabelsAwayFromAnchoredLabels } from "./pushInlineTerminalLabelsAwayFromAnchoredLabels"
import { restoreReroutesAroundSupersededLabels } from "./restoreReroutesAroundSupersededLabels"

export const DEFAULT_INLINE_NET_LABEL_HEIGHT = 0.18

/**
 * Preferred gap between a trace and its inline text. A tighter parallel-wire
 * slot may use a smaller, evenly divided gap if the full text still fits.
 */
export const INLINE_NET_LABEL_TRACE_MARGIN = 0.05

/** Clearance between a generated terminal stub and an unrelated trace. */
export const INLINE_NET_LABEL_STUB_TRACE_CLEARANCE = 0.05

/**
 * Largest perpendicular deviation a route may have and still be labeled as one
 * span. A route that is straight except for elbow jogs up to this size reads
 * as a single wire, so its name may be centered over the whole route,
 * bridging the jogs. Anything more meandering falls back to an anchored net
 * label.
 */
export const INLINE_NET_LABEL_MAX_SPAN_JOG = 0.4

/**
 * A net label drawn parallel to the trace it names, rather than anchored to the
 * end of it. Used for point-to-point signal traces, where an anchored label
 * would break the visual line between the two pins.
 *
 * `center` is the center of the text box in the schematic's own (unrotated)
 * coordinate space. `width` is the extent of the text along the trace and
 * `height` is its extent perpendicular to the trace, so a vertical label has
 * its `width` running along y.
 */
export interface InlineNetLabelPlacement {
  globalConnNetId: string
  netId?: string
  /** User-facing label content, separate from the connectivity identifier. */
  netLabelText?: string
  mspPairId?: string
  pinIds: PinId[]

  /**
   * A generated single-ended trace stub. Present for a single-pin net or for
   * one endpoint of an unrouted two-pin net; routed point-to-point traces omit
   * it.
   */
  stubTracePath?: [Point, Point]

  /** Axis the text runs along: "x" reads left-to-right, "y" reads bottom-to-top */
  axis: "x" | "y"

  /** Midpoint of the trace segment the label is attached to */
  anchorPoint: Point

  /** Center of the label text, offset perpendicular to the trace */
  center: Point

  /** Extent along the trace */
  width: number
  /** Extent perpendicular to the trace */
  height: number

  /**
   * Which side of the trace the label sits on. For a horizontal trace, "y+" is
   * above; for a vertical trace, "x-" is the left side (which is "above" once
   * the text is rotated).
   */
  side: "x+" | "x-" | "y+" | "y-"
}

interface InlineNetLabelSolverInput {
  /** Exact connector IDs supplied by their producer; IDs are never parsed. */
  netLabelConnectorTraceIds?: ReadonlySet<string>
  resolveTraceCollisions?: boolean
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  completedReroutes?: CompletedTraceReroute[]
}

export interface InlineNetLabelOutput {
  netLabelConnectorTraceIds?: ReadonlySet<string>
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  inlineNetLabelPlacements: InlineNetLabelPlacement[]
}

type InlineOutput = Omit<InlineNetLabelOutput, "inputProblem">

type InlineEligibleConnection = InputDirectConnection | InputNetConnection

type QueuedInlineConnection =
  | { kind: "direct_connection"; connection: InputDirectConnection }
  | { kind: "net_connection"; connection: InputNetConnection }

interface NetConnectionInlineConversion {
  globalConnNetId: string
  placements: InlineNetLabelPlacement[]
  supersededTraceIds: Set<string>
}

interface NetConnectionComponent {
  pinIds: PinId[]
  labeledPinIds: PinId[]
  traces: SolvedTracePath[]
}

const getPinPairKey = (pinIds: readonly string[]) =>
  JSON.stringify([...pinIds].sort())

const getTraceLength = (trace: SolvedTracePath) => {
  let length = 0
  for (let index = 0; index < trace.tracePath.length - 1; index++) {
    const start = trace.tracePath[index]!
    const end = trace.tracePath[index + 1]!
    length += Math.abs(end.x - start.x) + Math.abs(end.y - start.y)
  }
  return length
}

const setsEqual = <T>(first: Set<T>, second: Set<T>) =>
  first.size === second.size && [...first].every((value) => second.has(value))

const getInlinePlacementBounds = (
  placement: InlineNetLabelPlacement,
): Bounds => {
  const renderedWidth =
    placement.axis === "y" ? placement.height : placement.width
  const renderedHeight =
    placement.axis === "y" ? placement.width : placement.height
  return {
    minX: placement.center.x - renderedWidth / 2,
    maxX: placement.center.x + renderedWidth / 2,
    minY: placement.center.y - renderedHeight / 2,
    maxY: placement.center.y + renderedHeight / 2,
  }
}

const getInlinePlacementKey = (placement: InlineNetLabelPlacement) =>
  JSON.stringify([
    placement.globalConnNetId,
    [...placement.pinIds].sort(),
    placement.mspPairId ?? null,
  ])

const terminalStubIntersectsTrace = (
  path: [Point, Point],
  trace: SolvedTracePath,
) => {
  const clearance = INLINE_NET_LABEL_STUB_TRACE_CLEARANCE - GEOMETRY_EPSILON
  const bounds = {
    minX: Math.min(path[0].x, path[1].x) - clearance,
    maxX: Math.max(path[0].x, path[1].x) + clearance,
    minY: Math.min(path[0].y, path[1].y) - clearance,
    maxY: Math.max(path[0].y, path[1].y) + clearance,
  }
  return doesPathIntersectBounds(trace.tracePath, bounds)
}

/**
 * Places "inline net labels" - net names drawn alongside the trace they belong
 * to - for connections that opted in via `allowInlineNetLabel`.
 *
 * Anchored labels are removed only for the connected components represented
 * inline. A blocked component keeps its label without undoing clear ones.
 */
export class InlineNetLabelSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  inputNetLabelPlacements: NetLabelPlacement[]
  completedReroutes: CompletedTraceReroute[]

  inlineNetLabelPlacements: InlineNetLabelPlacement[] = []

  /** Eligible connections still waiting to be processed. */
  queuedConnections: QueuedInlineConnection[]

  private readonly netLabelConnectorTraceIds: ReadonlySet<string>
  private tracesByPinPairKey: Map<string, SolvedTracePath[]>
  private globalConnMap: ConnectivityMap
  private inlineConversions: NetConnectionInlineConversion[] = []
  private hasAlignedPortOnlyStubs = false
  private postProcessedOutput?: InlineOutput
  declare activeSubSolver: InlineNetLabelSolver | null
  private refinementComplete = false
  private refinement?: {
    proposals: Generator<InlineOutput>
    queue: Array<{
      output: InlineOutput
      distance: number
    }>
    collecting: boolean
    before: OutputLabelCollision[]
  }
  private currentProposal?: InlineOutput

  constructor(private readonly input: InlineNetLabelSolverInput) {
    super()
    this.netLabelConnectorTraceIds =
      input.netLabelConnectorTraceIds ?? new Set()
    this.inputProblem = input.inputProblem
    this.traces = input.traces
    this.inputNetLabelPlacements = input.netLabelPlacements
    this.completedReroutes = input.completedReroutes ?? []
    this.globalConnMap = getConnectivityMapsFromInputProblem(
      this.inputProblem,
    ).netConnMap

    this.queuedConnections = [
      ...this.inputProblem.directConnections
        .filter(
          (connection) =>
            connection.allowInlineNetLabel &&
            connection.netId &&
            // An opted-in named net owns all of its connected components.
            // Do not plan the same pair again through its direct connection.
            !this.inputProblem.netConnections.some(
              (net) =>
                net.allowInlineNetLabel &&
                net.netId &&
                connection.pinIds.every((pin) => net.pinIds.includes(pin)),
            ),
        )
        .map((connection) => ({
          kind: "direct_connection" as const,
          connection,
        })),
      ...this.inputProblem.netConnections
        .filter(
          (connection) =>
            connection.allowInlineNetLabel &&
            connection.pinIds.length >= 1 &&
            connection.netId,
        )
        .map((connection) => ({
          kind: "net_connection" as const,
          connection,
        })),
    ]

    this.tracesByPinPairKey = new Map()
    for (const trace of this.traces) {
      if (this.netLabelConnectorTraceIds.has(trace.mspPairId)) continue
      const key = getPinPairKey(trace.pins.map((p) => p.pinId))
      const existing = this.tracesByPinPairKey.get(key)
      if (existing) {
        existing.push(trace)
      } else {
        this.tracesByPinPairKey.set(key, [trace])
      }
    }
  }

  override getConstructorParams(): [InlineNetLabelSolverInput] {
    return [
      {
        inputProblem: this.inputProblem,
        traces: this.traces,
        netLabelPlacements: this.inputNetLabelPlacements,
        completedReroutes: this.completedReroutes,
        resolveTraceCollisions: this.input.resolveTraceCollisions,
        netLabelConnectorTraceIds: this.netLabelConnectorTraceIds,
      },
    ]
  }

  override _step() {
    const queuedConnection = this.queuedConnections.shift()
    if (queuedConnection) {
      if (
        queuedConnection.kind === "net_connection" &&
        queuedConnection.connection.pinIds.length > 2
      ) {
        const netConnections = [
          queuedConnection.connection,
          ...this.queuedConnections
            .filter(
              (
                queued,
              ): queued is Extract<
                QueuedInlineConnection,
                { kind: "net_connection" }
              > =>
                queued.kind === "net_connection" &&
                queued.connection.pinIds.length > 2,
            )
            .map((queued) => queued.connection),
        ]
        this.queuedConnections = this.queuedConnections.filter(
          (queued) =>
            queued.kind !== "net_connection" ||
            queued.connection.pinIds.length <= 2,
        )
        for (const conversion of this.computeNetConnectionInlineConversions(
          netConnections,
        )) {
          this.inlineNetLabelPlacements.push(...conversion.placements)
          this.inlineConversions.push(conversion)
        }
        return
      }

      const { connection } = queuedConnection

      const routedTraces =
        connection.pinIds.length === 2
          ? (this.tracesByPinPairKey.get(getPinPairKey(connection.pinIds)) ??
            [])
          : []

      if (routedTraces.length > 0) {
        const placement = this.computeInlinePlacement({
          connection,
          trace: routedTraces[0]!,
          pinIds: connection.pinIds,
        })
        if (placement) this.inlineNetLabelPlacements.push(placement)
      } else {
        // Unrouted endpoints are separate connected components. A blocked
        // endpoint keeps its anchored tag without changing the label style at
        // clear endpoints of the same named net.
        for (const pinId of connection.pinIds) {
          const placement = this.computeTerminalInlinePlacement(
            connection,
            pinId,
          )
          if (placement) this.inlineNetLabelPlacements.push(placement)
        }
      }
      return
    }

    if (!this.hasAlignedPortOnlyStubs) {
      this.inlineNetLabelPlacements = alignPortOnlyInlineNetLabelStubs({
        placements: this.inlineNetLabelPlacements,
        inputProblem: this.inputProblem,
        traces: this.traces,
        netLabelPlacements: this.inputNetLabelPlacements,
      })
      this.hasAlignedPortOnlyStubs = true
      return
    }

    if (!this.postProcessedOutput) {
      this.postProcessedOutput = this.buildPostProcessedOutput()
      return
    }

    if (this.input.resolveTraceCollisions && !this.refinementComplete) {
      this.stepTraceRefinement()
      return
    }
    this.solved = true
    this.stats.inlineNetLabelCount = this.inlineNetLabelPlacements.length
  }

  /**
   * Plans all opted-in multi-pin nets together. Short routed components can
   * mutually block the outward endpoint stubs that replace them, so tentative
   * replacements are ignored as obstacles only while their connected component still
   * converts successfully. Failed conversions retain both their traces and
   * their conventional labels, and the remaining conversions are retried.
   */
  private computeNetConnectionInlineConversions(
    connections: InputNetConnection[],
  ): NetConnectionInlineConversion[] {
    const prospectiveTraceIdsByConnection = new Map<
      InputNetConnection,
      Set<string>
    >()
    for (const connection of connections) {
      const prospectiveTraceIds = new Set<string>()
      for (const component of this.getNetConnectionComponents(connection)) {
        if (component.traces.length === 0) continue
        const hasInlinePlacement = component.traces.some((trace) =>
          Boolean(
            this.computeInlinePlacement({
              connection,
              trace,
              pinIds: component.pinIds,
            }),
          ),
        )
        if (!hasInlinePlacement) {
          for (const trace of component.traces) {
            prospectiveTraceIds.add(trace.mspPairId)
          }
        }
      }
      prospectiveTraceIdsByConnection.set(connection, prospectiveTraceIds)
    }

    let ignoredTraceIds = new Set(
      [...prospectiveTraceIdsByConnection.values()].flatMap((ids) => [...ids]),
    )

    while (true) {
      const conversions = connections.map((connection) => ({
        connection,
        conversion: this.computeNetConnectionInlinePlacements(
          connection,
          ignoredTraceIds,
          prospectiveTraceIdsByConnection.get(connection) ?? new Set(),
        ),
      }))
      const nextIgnoredTraceIds = new Set(
        conversions.flatMap(({ conversion }) =>
          conversion.flatMap((component) => [...component.supersededTraceIds]),
        ),
      )
      if (setsEqual(ignoredTraceIds, nextIgnoredTraceIds)) {
        return conversions.flatMap(({ conversion }) => conversion)
      }
      ignoredTraceIds = nextIgnoredTraceIds
    }
  }

  /**
   * Splits an input net into the connected components created by its solved
   * traces. This intentionally does not depend on anchored-label placement:
   * a group whose anchored label failed still has the same routing topology.
   */
  private getNetConnectionComponents(
    connection: InputNetConnection,
  ): NetConnectionComponent[] {
    const firstPinId = connection.pinIds[0]
    if (!firstPinId) return []
    const canonicalGlobalConnNetId =
      this.globalConnMap.getNetConnectedToId(firstPinId)
    if (!canonicalGlobalConnNetId) return []

    const inputPinIds = new Set(
      this.inputProblem.chips.flatMap((chip) =>
        chip.pins.map((pin) => pin.pinId),
      ),
    )
    const pinIdsInGlobalNet = (
      this.globalConnMap.getIdsConnectedToNet(
        canonicalGlobalConnNetId,
      ) as string[]
    ).filter((id): id is PinId => inputPinIds.has(id))
    const labeledPinIds = new Set(connection.pinIds)

    return getTraceConnectedPinComponents({
      pinIds: pinIdsInGlobalNet,
      // Available-net-orientation traces only connect a pin to its generated
      // anchored label. They are removed when that label becomes inline, so
      // treating them as routed circuitry would leave text on a deleted wire.
      traces: this.traces.filter(
        (trace) => !this.netLabelConnectorTraceIds.has(trace.mspPairId),
      ),
    })
      .map((component) => ({
        pinIds: component.pinIds,
        labeledPinIds: component.pinIds.filter((pinId) =>
          labeledPinIds.has(pinId),
        ),
        traces: component.traces.sort(
          (a, b) => getTraceLength(b) - getTraceLength(a),
        ),
      }))
      .filter((component) => component.labeledPinIds.length > 0)
  }

  private getGlobalConnNetId(
    connection: InputNetConnection,
  ): string | undefined {
    const firstPinId = connection.pinIds[0]
    if (!firstPinId) return undefined
    const connectionPinIds = new Set(connection.pinIds)
    return (
      this.traces.find((trace) =>
        trace.pins.some((pin) => connectionPinIds.has(pin.pinId)),
      )?.globalConnNetId ??
      this.inputNetLabelPlacements.find(
        (placement) => placement.netId === connection.netId,
      )?.globalConnNetId ??
      this.globalConnMap.getNetConnectedToId(firstPinId) ??
      undefined
    )
  }

  /**
   * Converts every conventional label representation for an opted-in named
   * net. Routed connected components become labels on their representative
   * trace; disconnected pins become outward terminal stubs. The conversion is
   * atomic within each routed component, so replacing its traces cannot strand
   * a pin. Disconnected components can keep their own label style.
   */
  private computeNetConnectionInlinePlacements(
    connection: InputNetConnection,
    ignoredTraceIds: Set<string>,
    forcedTerminalTraceIds: Set<string>,
  ): NetConnectionInlineConversion[] {
    const components = this.getNetConnectionComponents(connection)
    const globalConnNetId = this.getGlobalConnNetId(connection)
    if (!globalConnNetId) return []

    const conversions: NetConnectionInlineConversion[] = []
    for (const component of components) {
      const shouldUseTerminalStubs = component.traces.some((trace) =>
        forcedTerminalTraceIds.has(trace.mspPairId),
      )

      let inlinePlacement: InlineNetLabelPlacement | null = null
      if (!shouldUseTerminalStubs) {
        for (const trace of component.traces) {
          inlinePlacement = this.computeInlinePlacement({
            connection,
            trace,
            pinIds: component.pinIds,
            ignoredTraceIds,
          })
          if (inlinePlacement) break
        }
      }
      if (inlinePlacement) {
        conversions.push({
          globalConnNetId,
          placements: [inlinePlacement],
          supersededTraceIds: new Set(),
        })
        continue
      }
      if (component.traces.length > 0 && !shouldUseTerminalStubs) {
        // This route originally had a valid inline placement, but a trace from
        // a conversion that had to be rolled back now blocks it. Retain
        // this component as well instead of introducing a new replacement and
        // allowing the batch plan to oscillate.
        continue
      }
      if (component.labeledPinIds.length !== component.pinIds.length) {
        // Removing this component's traces would strand an intermediate pin
        // that was connected through the global net but was not an endpoint of
        // this named connection. Retain the original routed representation.
        continue
      }

      // A routed component may be too short to carry its text. In that case,
      // replace the component atomically with equivalent named terminal stubs
      // at every endpoint. This preserves connectivity through the net name
      // without retaining a short, redundant wire beside the new labels.
      const terminalPlacements = component.pinIds.map((pinId) =>
        this.computeTerminalInlinePlacement(
          connection,
          pinId,
          globalConnNetId,
          ignoredTraceIds,
        ),
      )
      if (terminalPlacements.some((placement) => placement === null)) {
        continue
      }
      conversions.push({
        globalConnNetId,
        placements: terminalPlacements as InlineNetLabelPlacement[],
        supersededTraceIds: new Set(
          component.traces.map((trace) => trace.mspPairId),
        ),
      })
    }

    return conversions
  }

  /** Prefer the normal gap, then center text in a tighter parallel-wire slot. */
  private getInlineOffsets(
    anchor: Point,
    axis: "x" | "y",
    side: InlineNetLabelPlacement["side"],
    width: number,
    height: number,
    traces: SolvedTracePath[],
    ignoredTraceIds: Set<string>,
  ): number[] {
    const normal = height / 2 + INLINE_NET_LABEL_TRACE_MARGIN
    const across = axis === "x" ? "y" : "x"
    const sign = side === "x+" || side === "y+" ? 1 : -1
    let gap = Infinity
    for (const trace of traces) {
      if (ignoredTraceIds.has(trace.mspPairId)) continue
      for (const segment of getAxisAlignedSegments(trace.tracePath)) {
        if (segment.axis !== axis) continue
        if (
          Math.max(segment.start[axis], segment.end[axis]) <=
            anchor[axis] - width / 2 ||
          Math.min(segment.start[axis], segment.end[axis]) >=
            anchor[axis] + width / 2
        )
          continue
        const distance = sign * (segment.start[across] - anchor[across])
        if (distance > GEOMETRY_EPSILON) gap = Math.min(gap, distance)
      }
    }
    return gap > height + GEOMETRY_EPSILON &&
      gap / 2 < normal - GEOMETRY_EPSILON
      ? [normal, gap / 2]
      : [normal]
  }

  /**
   * Converts one conventional endpoint placement into an inline label on an
   * outward stub that follows the pin's true facing direction.
   */
  private computeTerminalInlinePlacement(
    connection: InlineEligibleConnection,
    pinId: PinId,
    knownGlobalConnNetId?: string,
    ignoredTraceIds = new Set<string>(),
    obstacles?: {
      traces: SolvedTracePath[]
      anchored: NetLabelPlacement[]
      inline: InlineNetLabelPlacement[]
    },
  ): InlineNetLabelPlacement | null {
    if (!connection.netId) return null

    const anchoredPlacement = this.inputNetLabelPlacements.find(
      (placement) =>
        placement.netId === connection.netId &&
        placement.pinIds.length === 1 &&
        placement.pinIds[0] === pinId,
    )
    const globalConnNetId =
      knownGlobalConnNetId ?? anchoredPlacement?.globalConnNetId
    if (!globalConnNetId) return null

    const inputChip = this.inputProblem.chips.find((chip) =>
      chip.pins.some((pin) => pin.pinId === pinId),
    )
    const inputPin = inputChip?.pins.find((pin) => pin.pinId === pinId)

    const height =
      connection.inlineNetLabelHeight ?? DEFAULT_INLINE_NET_LABEL_HEIGHT
    const netLabelText = connection.netLabelText?.trim() || undefined
    const width =
      connection.inlineNetLabelWidth ??
      connection.netLabelWidth ??
      estimateInlineNetLabelWidth(netLabelText ?? connection.netId, height)

    // Leave a small wire tail at both ends of the text so it unmistakably
    // reads as a label on a trace rather than free-standing text.
    const stubLength = Math.max(width + 0.2, 0.6)
    if (!inputPin && !anchoredPlacement) return null
    const start = inputPin
      ? { x: inputPin.x, y: inputPin.y }
      : anchoredPlacement!.anchorPoint
    const direction =
      inputPin && inputChip
        ? (inputPin._facingDirection ?? getPinDirection(inputPin, inputChip))
        : anchoredPlacement!.orientation
    const intendedEnd: Point =
      direction === "x+"
        ? { x: start.x + stubLength, y: start.y }
        : direction === "x-"
          ? { x: start.x - stubLength, y: start.y }
          : direction === "y+"
            ? { x: start.x, y: start.y + stubLength }
            : { x: start.x, y: start.y - stubLength }

    const end = getCollisionLimitedTerminalStubEnd({
      start,
      intendedEnd,
      minimumLength: width + 2 * INLINE_NET_LABEL_TRACE_MARGIN,
      traces: obstacles?.traces ?? this.traces,
      ownGlobalConnNetId: globalConnNetId,
      ignoredTraceIds,
    })
    if (!end) return null

    const axis: InlineNetLabelPlacement["axis"] =
      direction === "x+" || direction === "x-" ? "x" : "y"
    const anchorPoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    }
    const sides: InlineNetLabelPlacement["side"][] =
      axis === "x" ? ["y+", "y-"] : ["x-", "x+"]

    for (const side of sides) {
      for (const offset of this.getInlineOffsets(
        anchorPoint,
        axis,
        side,
        width,
        height,
        obstacles?.traces ?? this.traces,
        ignoredTraceIds,
      )) {
        const center: Point =
          side === "y+"
            ? { x: anchorPoint.x, y: anchorPoint.y + offset }
            : side === "y-"
              ? { x: anchorPoint.x, y: anchorPoint.y - offset }
              : side === "x-"
                ? { x: anchorPoint.x - offset, y: anchorPoint.y }
                : { x: anchorPoint.x + offset, y: anchorPoint.y }

        const halfAlong = width / 2
        const halfAcross = height / 2
        const bounds: Bounds =
          axis === "x"
            ? {
                minX: center.x - halfAlong,
                maxX: center.x + halfAlong,
                minY: center.y - halfAcross,
                maxY: center.y + halfAcross,
              }
            : {
                minX: center.x - halfAcross,
                maxX: center.x + halfAcross,
                minY: center.y - halfAlong,
                maxY: center.y + halfAlong,
              }

        if (
          this.isObstructed(bounds, {
            ownGlobalConnNetId: globalConnNetId,
            ignoredTraceIds,
            obstacles,
          })
        ) {
          continue
        }

        return {
          globalConnNetId,
          netId: connection.netId,
          netLabelText,
          pinIds: [pinId],
          stubTracePath: [start, end],
          axis,
          anchorPoint,
          center,
          width,
          height,
          side,
        }
      }
    }
    return null
  }

  private computeInlinePlacement({
    connection,
    trace,
    pinIds,
    ignoredTraceIds = new Set<string>(),
  }: {
    connection: InlineEligibleConnection
    trace: SolvedTracePath
    pinIds: PinId[]
    ignoredTraceIds?: Set<string>
  }): InlineNetLabelPlacement | null {
    const segments = getAxisAlignedSegments(trace.tracePath)
    if (segments.length === 0) return null

    const height =
      connection.inlineNetLabelHeight ?? DEFAULT_INLINE_NET_LABEL_HEIGHT
    const netLabelText = connection.netLabelText?.trim() || undefined
    const width =
      connection.inlineNetLabelWidth ??
      connection.netLabelWidth ??
      estimateInlineNetLabelWidth(netLabelText ?? connection.netId!, height)

    const offset = height / 2 + INLINE_NET_LABEL_TRACE_MARGIN

    // First choice: a straight run the label fully fits on, longest first, so
    // the text hugs the wire it names. Within a run, try the preferred side
    // before the far side, and positions near the middle before the ends. The
    // label never extends past the end of a run - a name hanging off its wire
    // reads as floating text.
    const usableSegments = segments
      .filter((segment) => segment.length >= width)
      .sort((a, b) => b.length - a.length)

    for (const segment of usableSegments) {
      // "Above" the trace: +y for a horizontal trace, and -x for a vertical one
      // (rotating the text 90deg counter-clockwise maps "above" onto the left).
      const sides: InlineNetLabelPlacement["side"][] =
        segment.axis === "x" ? ["y+", "y-"] : ["x-", "x+"]

      for (const side of sides) {
        for (const anchorPoint of getAnchorCandidates(segment, width)) {
          for (const offset of this.getInlineOffsets(
            anchorPoint,
            segment.axis,
            side,
            width,
            height,
            this.traces,
            ignoredTraceIds,
          )) {
            const center =
              side === "y+"
                ? { x: anchorPoint.x, y: anchorPoint.y + offset }
                : side === "y-"
                  ? { x: anchorPoint.x, y: anchorPoint.y - offset }
                  : side === "x-"
                    ? { x: anchorPoint.x - offset, y: anchorPoint.y }
                    : { x: anchorPoint.x + offset, y: anchorPoint.y }

            const halfAlong = width / 2
            const halfAcross = height / 2
            const bounds: Bounds =
              segment.axis === "x"
                ? {
                    minX: center.x - halfAlong,
                    maxX: center.x + halfAlong,
                    minY: center.y - halfAcross,
                    maxY: center.y + halfAcross,
                  }
                : {
                    minX: center.x - halfAcross,
                    maxX: center.x + halfAcross,
                    minY: center.y - halfAlong,
                    maxY: center.y + halfAlong,
                  }

            if (
              this.isObstructed(bounds, {
                ownTrace: trace,
                ownGlobalConnNetId: trace.globalConnNetId,
                ignoredTraceIds,
              })
            )
              continue

            return {
              globalConnNetId: trace.globalConnNetId,
              netId: connection.netId,
              netLabelText,
              mspPairId: trace.mspPairId,
              pinIds: [...pinIds],
              axis: segment.axis,
              anchorPoint,
              center,
              width,
              height,
              side,
            }
          }
        }
      }
    }

    // Second choice: no single run fits, but a route that is straight except
    // for small jogs still reads as one wire - center the label over the
    // route's overall span, bridging the jogs, without extending past its
    // endpoints.
    const spanPlacement = this.computeSpanPlacement({
      trace,
      connection,
      netLabelText,
      width,
      height,
      offset,
      pinIds,
      ignoredTraceIds,
    })
    if (spanPlacement) return spanPlacement

    // No room anywhere along the trace. Leave the net to the regular anchored
    // net label rather than drawing the name over a chip.
    return null
  }

  /**
   * Places the label over the whole route when the route is straight except
   * for perpendicular jogs of at most INLINE_NET_LABEL_MAX_SPAN_JOG. The label
   * sits clear of the route's full perpendicular extent and stays within its
   * endpoints along the dominant axis.
   */
  private computeSpanPlacement({
    trace,
    connection,
    netLabelText,
    width,
    height,
    offset,
    pinIds,
    ignoredTraceIds,
  }: {
    trace: SolvedTracePath
    connection: InlineEligibleConnection
    netLabelText?: string
    width: number
    height: number
    offset: number
    pinIds: PinId[]
    ignoredTraceIds: Set<string>
  }): InlineNetLabelPlacement | null {
    const path = trace.tracePath
    if (path.length < 2) return null

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const point of path) {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minY = Math.min(minY, point.y)
      maxY = Math.max(maxY, point.y)
    }

    const extentX = maxX - minX
    const extentY = maxY - minY
    const axis: InlineNetLabelPlacement["axis"] = extentX >= extentY ? "x" : "y"
    const spanLength = axis === "x" ? extentX : extentY
    const jog = axis === "x" ? extentY : extentX

    if (jog > INLINE_NET_LABEL_MAX_SPAN_JOG) return null
    if (spanLength < width) return null

    const spanStart = axis === "x" ? minX : minY
    const spanEnd = axis === "x" ? maxX : maxY
    const mid = (spanStart + spanEnd) / 2

    // Slide candidates within the span, centered first (same scheme as the
    // per-segment stage).
    const halfRange = (spanLength - width) / 2
    const offsets: number[] = [0]
    for (let value = 0.1; value <= halfRange + 1e-9; value += 0.1) {
      offsets.push(value, -value)
    }
    offsets.push(halfRange, -halfRange)

    const sides: InlineNetLabelPlacement["side"][] =
      axis === "x" ? ["y+", "y-"] : ["x-", "x+"]

    for (const side of sides) {
      for (const alongOffset of offsets) {
        const along = mid + alongOffset
        // The label clears the far side of every jog, not just the run it is
        // nearest to.
        const center: Point =
          side === "y+"
            ? { x: along, y: maxY + offset }
            : side === "y-"
              ? { x: along, y: minY - offset }
              : side === "x-"
                ? { x: minX - offset, y: along }
                : { x: maxX + offset, y: along }

        const halfAlong = width / 2
        const halfAcross = height / 2
        const bounds: Bounds =
          axis === "x"
            ? {
                minX: center.x - halfAlong,
                maxX: center.x + halfAlong,
                minY: center.y - halfAcross,
                maxY: center.y + halfAcross,
              }
            : {
                minX: center.x - halfAcross,
                maxX: center.x + halfAcross,
                minY: center.y - halfAlong,
                maxY: center.y + halfAlong,
              }

        if (
          this.isObstructed(bounds, {
            ownTrace: trace,
            ownGlobalConnNetId: trace.globalConnNetId,
            ignoredTraceIds,
          })
        )
          continue

        const anchorPoint: Point =
          axis === "x"
            ? { x: along, y: side === "y+" ? maxY : minY }
            : { x: side === "x-" ? minX : maxX, y: along }

        return {
          globalConnNetId: trace.globalConnNetId,
          netId: connection.netId,
          netLabelText,
          mspPairId: trace.mspPairId,
          pinIds: [...pinIds],
          axis,
          anchorPoint,
          center,
          width,
          height,
          side,
        }
      }
    }

    return null
  }

  /**
   * An inline label may not sit on top of a chip, a component's text, or a
   * trace belonging to another net.
   */
  private isObstructed(
    bounds: Bounds,
    {
      ownTrace,
      ownGlobalConnNetId,
      ignoredTraceIds = new Set<string>(),
      obstacles,
    }: {
      ownTrace?: SolvedTracePath
      ownGlobalConnNetId: string
      ignoredTraceIds?: Set<string>
      obstacles?: {
        traces: SolvedTracePath[]
        anchored: NetLabelPlacement[]
        inline: InlineNetLabelPlacement[]
      }
    },
  ): boolean {
    for (const chip of this.inputProblem.chips) {
      const chipBounds: Bounds = {
        minX: chip.center.x - chip.width / 2,
        maxX: chip.center.x + chip.width / 2,
        minY: chip.center.y - chip.height / 2,
        maxY: chip.center.y + chip.height / 2,
      }
      if (boundsOverlap(bounds, chipBounds)) return true
    }

    for (const textBox of this.inputProblem.textBoxes ?? []) {
      if (boundsOverlap(bounds, getTextBoxBounds(textBox))) return true
    }

    for (const trace of obstacles?.traces ?? this.traces) {
      if (ignoredTraceIds.has(trace.mspPairId)) continue
      if (ownTrace && trace.mspPairId === ownTrace.mspPairId) continue
      if (trace.globalConnNetId === ownGlobalConnNetId) continue
      if (doesPathIntersectBounds(trace.tracePath, bounds)) return true
    }

    if (
      obstacles?.anchored.some((label) =>
        boundsOverlap(bounds, getAnchoredNetLabelRenderedBounds(label)),
      )
    )
      return true
    if (
      obstacles?.inline.some(
        (label) =>
          boundsOverlap(bounds, getInlinePlacementBounds(label)) ||
          (label.stubTracePath &&
            label.globalConnNetId !== ownGlobalConnNetId &&
            doesPathIntersectBounds(label.stubTracePath, bounds)),
      )
    )
      return true
    return false
  }

  private getOutputTraces(placements: InlineNetLabelPlacement[]) {
    const activeKeys = new Set(placements.map(getInlinePlacementKey))
    const supersededTraceIds = new Set(
      this.inlineConversions
        .filter((conversion) =>
          conversion.placements.every((placement) =>
            activeKeys.has(getInlinePlacementKey(placement)),
          ),
        )
        .flatMap((conversion) => [...conversion.supersededTraceIds]),
    )
    return this.traces.filter(
      (trace) =>
        !supersededTraceIds.has(trace.mspPairId) &&
        !(
          this.netLabelConnectorTraceIds.has(trace.mspPairId) &&
          isLabelRepresentedInline(trace, placements)
        ),
    )
  }

  private getBlockedInlinePlacements({
    inlineNetLabelPlacements,
    anchoredNetLabelPlacements,
    traces,
  }: {
    inlineNetLabelPlacements: InlineNetLabelPlacement[]
    anchoredNetLabelPlacements: NetLabelPlacement[]
    traces: SolvedTracePath[]
  }): Set<string> {
    const blockedKeys = new Set<string>()
    for (const inline of inlineNetLabelPlacements) {
      const bounds = getInlinePlacementBounds(inline)
      const blockedByLabel = anchoredNetLabelPlacements.some((anchored) => {
        const anchoredBounds = getAnchoredNetLabelRenderedBounds(anchored)
        return (
          boundsOverlap(bounds, anchoredBounds) ||
          (inline.stubTracePath &&
            doesPathIntersectBounds(inline.stubTracePath, anchoredBounds))
        )
      })
      // Rolling back a routed component restores its original wires. Recheck
      // other inline conversions against those wires before accepting them.
      const blockedByTrace = traces.some(
        (trace) =>
          trace.globalConnNetId !== inline.globalConnNetId &&
          (doesPathIntersectBounds(trace.tracePath, bounds) ||
            (inline.stubTracePath &&
              terminalStubIntersectsTrace(inline.stubTracePath, trace))),
      )
      const blockedByInlineWire = inlineNetLabelPlacements.some(
        (other) =>
          other !== inline &&
          other.globalConnNetId !== inline.globalConnNetId &&
          other.stubTracePath &&
          doesPathIntersectBounds(other.stubTracePath, bounds),
      )
      const blockedByInlineText = inlineNetLabelPlacements.some(
        (other) =>
          other !== inline &&
          boundsOverlap(bounds, getInlinePlacementBounds(other)),
      )
      if (
        blockedByLabel ||
        blockedByTrace ||
        blockedByInlineWire ||
        blockedByInlineText
      )
        blockedKeys.add(getInlinePlacementKey(inline))
    }
    for (const conversion of this.inlineConversions) {
      if (
        conversion.placements.some((placement) =>
          blockedKeys.has(getInlinePlacementKey(placement)),
        )
      ) {
        for (const placement of conversion.placements)
          blockedKeys.add(getInlinePlacementKey(placement))
      }
    }
    return blockedKeys
  }

  private buildPostProcessedOutput(): InlineOutput {
    let activeInlinePlacements = this.inlineNetLabelPlacements
    while (true) {
      const retainedNetLabelPlacements = this.inputNetLabelPlacements.filter(
        (placement) =>
          !isLabelRepresentedInline(placement, activeInlinePlacements),
      )
      const outputTraces = this.getOutputTraces(activeInlinePlacements)
      // Replacing tags frees space on neighboring routed nets. Reconsider
      // their anchors with the inline text and terminal wires held fixed.
      const { fixedLabels, terminalTraces } = getInlineLabelObstacles(
        this.inputProblem,
        activeInlinePlacements,
      )
      const labelCollisionSolver = new NetLabelNetLabelCollisionSolver({
        inputProblem: this.inputProblem,
        traces: [...outputTraces, ...terminalTraces],
        netLabelPlacements: retainedNetLabelPlacements,
        fixedNetLabelPlacements: fixedLabels,
        netLabelConnectorTraceIds: this.netLabelConnectorTraceIds,
        useRenderedLabelBounds: activeInlinePlacements.length > 0,
      })
      if (activeInlinePlacements.length > 0) labelCollisionSolver.solve()
      const pushed = pushAnchoredNetLabelsAwayFromInlineLabels({
        inputProblem: this.inputProblem,
        traces: outputTraces,
        netLabelPlacements:
          labelCollisionSolver.solved && !labelCollisionSolver.failed
            ? labelCollisionSolver.getOutput().netLabelPlacements
            : retainedNetLabelPlacements,
        inlineNetLabelPlacements: activeInlinePlacements,
        netLabelConnectorTraceIds: this.netLabelConnectorTraceIds,
      })
      let blockedPlacementKeys = this.getBlockedInlinePlacements({
        inlineNetLabelPlacements: activeInlinePlacements,
        anchoredNetLabelPlacements: pushed.netLabelPlacements,
        traces: pushed.traces,
      })
      if (blockedPlacementKeys.size > 0) {
        const shiftedInlineTerminalLabels =
          pushInlineTerminalLabelsAwayFromAnchoredLabels({
            inputProblem: this.inputProblem,
            traces: pushed.traces,
            anchoredNetLabelPlacements: pushed.netLabelPlacements,
            inlineNetLabelPlacements: activeInlinePlacements,
          })
        if (shiftedInlineTerminalLabels.movedGroupCount > 0) {
          activeInlinePlacements =
            shiftedInlineTerminalLabels.inlineNetLabelPlacements
          continue
        }
        // Obstacles changed after anchor placement. Reuse the existing side
        // search, starting with obstructed terminals. Keep every terminal wire
        // fixed as an obstacle while selecting text positions.
        const { terminalTraces } = getInlineLabelObstacles(
          this.inputProblem,
          activeInlinePlacements,
        )
        const replanned = activeInlinePlacements.filter(
          (label) => !label.stubTracePath,
        )
        const terminals = activeInlinePlacements
          .filter((label) => label.stubTracePath)
          .sort(
            (a, b) =>
              Number(blockedPlacementKeys.has(getInlinePlacementKey(b))) -
              Number(blockedPlacementKeys.has(getInlinePlacementKey(a))),
          )
        for (const placement of terminals) {
          const connection = [
            ...this.inputProblem.netConnections,
            ...this.inputProblem.directConnections,
          ].find(
            (connection) =>
              connection.netId === placement.netId &&
              connection.allowInlineNetLabel,
          )
          const candidate = connection
            ? this.computeTerminalInlinePlacement(
                connection,
                placement.pinIds[0]!,
                placement.globalConnNetId,
                new Set(),
                {
                  traces: [...pushed.traces, ...terminalTraces],
                  anchored: pushed.netLabelPlacements,
                  inline: replanned,
                },
              )
            : null
          replanned.push(candidate ?? placement)
        }
        const byKey = new Map(
          replanned.map((label) => [getInlinePlacementKey(label), label]),
        )
        activeInlinePlacements = activeInlinePlacements.map(
          (label) => byKey.get(getInlinePlacementKey(label)) ?? label,
        )
        blockedPlacementKeys = this.getBlockedInlinePlacements({
          inlineNetLabelPlacements: activeInlinePlacements,
          anchoredNetLabelPlacements: pushed.netLabelPlacements,
          traces: pushed.traces,
        })
      }
      if (blockedPlacementKeys.size === 0) {
        this.inlineNetLabelPlacements = activeInlinePlacements
        this.stats.pushedAnchoredNetLabelCount = pushed.movedLabelCount
        const restored = restoreReroutesAroundSupersededLabels({
          inputProblem: this.inputProblem,
          traces: pushed.traces,
          netLabelPlacements: pushed.netLabelPlacements,
          inlineNetLabelPlacements: activeInlinePlacements,
          completedReroutes: this.completedReroutes,
        })
        this.stats.restoredSupersededLabelRerouteCount =
          restored.restoredTraceCount
        const output = {
          traces: restored.traces,
          netLabelConnectorTraceIds: pushed.netLabelConnectorTraceIds,
          netLabelPlacements: pushed.netLabelPlacements,
          inlineNetLabelPlacements: activeInlinePlacements,
        }
        this.inlineNetLabelPlacements = output.inlineNetLabelPlacements
        return output
      }
      activeInlinePlacements = activeInlinePlacements.filter(
        (placement) =>
          !blockedPlacementKeys.has(getInlinePlacementKey(placement)),
      )
    }
  }

  /** Enumerate nearby moves in the existing order; collect one proposal per step. */
  private *getTraceRefinementProposals(current: InlineOutput) {
    yield* getLocalTraceLabelShifts(this.inputProblem, current)
    // An anchored endpoint can hide the larger footprint of its requested
    // inline label. Consider that footprint without changing caller opt-ins.
    for (const label of current.netLabelPlacements) {
      if (label.pinIds.length !== 1) continue
      const connection = [
        ...this.inputProblem.netConnections,
        ...this.inputProblem.directConnections,
      ].find(
        (connection) =>
          connection.allowInlineNetLabel &&
          connection.netId === label.netId &&
          connection.pinIds.includes(label.pinIds[0]!),
      )
      if (!connection) continue
      const placement = this.computeTerminalInlinePlacement(
        connection,
        label.pinIds[0]!,
        label.globalConnNetId,
        new Set(),
        { traces: [], anchored: [], inline: [] },
      )
      if (placement)
        yield* getLocalTraceLabelShifts(this.inputProblem, current, [placement])
    }
  }

  private createRefinementCandidate(
    proposal: InlineOutput,
  ): InlineNetLabelSolver {
    const traceMap = new Map(
      proposal.traces.map((trace) => [trace.mspPairId, trace]),
    )
    const labelKey = (label: NetLabelPlacement) =>
      JSON.stringify([label.globalConnNetId, [...label.pinIds].sort()])
    const labelMap = new Map(
      proposal.netLabelPlacements.map((label) => [labelKey(label), label]),
    )
    const originalTraceIds = new Set(
      this.traces.map((trace) => trace.mspPairId),
    )
    return new InlineNetLabelSolver({
      inputProblem: this.inputProblem,
      traces: [
        ...this.traces.map((trace) => traceMap.get(trace.mspPairId) ?? trace),
        ...proposal.traces.filter(
          (trace) => !originalTraceIds.has(trace.mspPairId),
        ),
      ],
      netLabelPlacements: this.inputNetLabelPlacements.map(
        (label) => labelMap.get(labelKey(label)) ?? label,
      ),
      completedReroutes: this.completedReroutes,
      netLabelConnectorTraceIds: proposal.netLabelConnectorTraceIds,
    })
  }

  private acceptRefinementCandidate(
    proposal: InlineOutput,
    result: InlineOutput,
  ): boolean {
    const current = this.postProcessedOutput!
    const before = this.refinement!.before
    const after = getOutputLabelCollisions(result)
    if (
      after.some(
        (collision) =>
          !before.some((previous) =>
            sameOutputLabelCollision(collision, previous),
          ),
      )
    )
      return false
    const movedTraceIds = new Set(
      proposal.traces
        .filter((trace, index) => trace !== current.traces[index])
        .map((trace) => trace.mspPairId),
    )
    // Every moved route must clear its collisions, using its exact identity.
    if (
      after.some(
        (collision) =>
          collision.kind === "trace-label" &&
          collision.trace.kind === "routed" &&
          movedTraceIds.has(collision.trace.id),
      )
    )
      return false
    if (
      after.length >= before.length &&
      result.inlineNetLabelPlacements.length <=
        current.inlineNetLabelPlacements.length
    )
      return false
    this.postProcessedOutput = result
    this.inlineNetLabelPlacements = result.inlineNetLabelPlacements
    return true
  }

  private stepTraceRefinement() {
    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      if (!this.activeSubSolver.solved && !this.activeSubSolver.failed) return
      // A failed or exhausted solver cannot replace the last accepted output.
      if (
        this.activeSubSolver.solved &&
        !this.activeSubSolver.failed &&
        this.acceptRefinementCandidate(
          this.currentProposal!,
          this.activeSubSolver.getOutput(),
        )
      ) {
        this.refinement = undefined
      }
      this.activeSubSolver = null
      this.currentProposal = undefined
      return
    }
    const current = this.postProcessedOutput!
    if (!this.refinement) {
      this.refinement = {
        proposals: this.getTraceRefinementProposals(current),
        queue: [],
        collecting: true,
        before: getOutputLabelCollisions(current),
      }
    }
    const refinement = this.refinement
    if (refinement.collecting) {
      const next = refinement.proposals.next()
      if (!next.done) {
        const distance = next.value.traces.reduce(
          (sum, trace, index) =>
            sum +
            trace.tracePath.reduce((distance, point, pointIndex) => {
              const previous = current.traces[index]!.tracePath[pointIndex]!
              return (
                distance +
                Math.abs(point.x - previous.x) +
                Math.abs(point.y - previous.y)
              )
            }, 0),
          0,
        )
        refinement.queue.push({ output: next.value, distance })
      } else {
        // Keep the previous smallest-move-first ordering, including stable ties.
        refinement.queue.sort((a, b) => a.distance - b.distance)
        refinement.collecting = false
      }
      return
    }
    const next = refinement.queue.shift()
    if (!next) {
      this.refinementComplete = true
      return
    }
    this.currentProposal = next.output
    this.activeSubSolver = this.createRefinementCandidate(next.output)
  }

  getOutput(): InlineOutput {
    if (this.postProcessedOutput) return this.postProcessedOutput
    return this.buildPostProcessedOutput()
  }

  override visualize(): GraphicsObject {
    // Mirrors the previous pipeline stage's visualization so that a problem
    // with no inline labels renders identically, then layers the inline labels
    // on top.
    return visualizeInlineNetLabelOutput({
      inputProblem: this.inputProblem,
      ...this.getOutput(),
    })
  }
}

export const visualizeInlineNetLabelOutput = ({
  inputProblem,
  traces,
  netLabelPlacements,
  inlineNetLabelPlacements,
}: InlineNetLabelOutput): GraphicsObject => {
  const graphics = visualizeInputProblem(inputProblem)
  graphics.lines ??= []
  graphics.rects ??= []
  graphics.points ??= []
  graphics.texts ??= []

  for (const trace of traces) {
    graphics.lines.push({
      points: trace.tracePath,
      strokeColor: "purple",
    })
  }

  for (const label of netLabelPlacements) {
    graphics.rects.push({
      center: label.center,
      width: label.width,
      height: label.height,
      fill: getColorFromString(label.globalConnNetId, 0.35),
      strokeColor: getColorFromString(label.globalConnNetId, 0.9),
      label: `netId: ${label.netId}\nglobalConnNetId: ${label.globalConnNetId}`,
    } as Rect & { strokeColor: string })
    graphics.points.push({
      x: label.anchorPoint.x,
      y: label.anchorPoint.y,
      color: getColorFromString(label.globalConnNetId, 0.9),
      label: `anchorPoint\norientation: ${label.orientation}`,
    })
  }

  for (const inlineLabel of inlineNetLabelPlacements) {
    if (inlineLabel.stubTracePath) {
      graphics.lines.push({
        points: inlineLabel.stubTracePath,
        strokeColor: "purple",
      })
    }
    const isHorizontal = inlineLabel.axis === "x"
    let renderedWidth = inlineLabel.width
    let renderedHeight = inlineLabel.height
    if (!isHorizontal) {
      renderedWidth = inlineLabel.height
      renderedHeight = inlineLabel.width
    }
    graphics.rects.push({
      center: inlineLabel.center,
      width: renderedWidth,
      height: renderedHeight,
      fill: getColorFromString(inlineLabel.globalConnNetId, 0.35),
      strokeColor: "green",
      label: [
        `INLINE netId: ${inlineLabel.netId}`,
        `axis: ${inlineLabel.axis}`,
        `side: ${inlineLabel.side}`,
      ].join("\n"),
    } as Rect & { strokeColor: string })

    let textX = inlineLabel.center.x
    let textY = inlineLabel.center.y
    let anchorSide: Text["anchorSide"] = "center"
    let rotation: Text["rotation"]
    if (inlineLabel.stubTracePath) {
      const stubStart = inlineLabel.stubTracePath[0]
      const stubEnd = inlineLabel.stubTracePath[1]
      let labelOffset = inlineLabel.width / 2
      if (stubEnd[inlineLabel.axis] > stubStart[inlineLabel.axis]) {
        labelOffset = -inlineLabel.width / 2
        anchorSide = "center_left"
      } else {
        anchorSide = "center_right"
      }
      if (inlineLabel.axis === "x") {
        textX += labelOffset
      } else {
        textY += labelOffset
      }
    }
    if (inlineLabel.axis === "y") rotation = 90

    graphics.texts.push({
      x: textX,
      y: textY,
      text: inlineLabel.netLabelText ?? inlineLabel.netId ?? "",
      color: "green",
      fontSize: inlineLabel.height,
      anchorSide,
      // Vertical labels read bottom-to-top, alongside the wire they name.
      rotation,
    })
    graphics.points.push({
      x: inlineLabel.anchorPoint.x,
      y: inlineLabel.anchorPoint.y,
      color: "green",
      label: `inline anchor\n${inlineLabel.netLabelText ?? inlineLabel.netId}`,
    })
  }

  return graphics
}

/**
 * Mirrors the net label text width used by @tscircuit/core so a label that core
 * did not measure for us still reserves a sane amount of space.
 */
export const estimateInlineNetLabelWidth = (
  text: string,
  fontSize = DEFAULT_INLINE_NET_LABEL_HEIGHT,
) => {
  const fontScale = fontSize / 0.18
  return text.length * 0.12 * fontScale + 0.12 * fontScale
}

/**
 * Points along a segment where the label's midpoint could sit, ordered from the
 * middle of the segment outwards. Sliding the label along the wire lets it
 * dodge a chip that only crowds one end. Candidates always keep the label
 * fully on the wire; callers only pass segments the label fits on.
 */
const getAnchorCandidates = (
  segment: AxisAlignedSegment,
  labelWidth: number,
  step = 0.1,
): Point[] => {
  const along = segment.axis === "x" ? "x" : "y"
  const start = segment.start[along]
  const end = segment.end[along]
  const mid = (start + end) / 2
  const direction = Math.sign(end - start) || 1

  const pointAt = (value: number): Point =>
    segment.axis === "x"
      ? { x: value, y: segment.start.y }
      : { x: segment.start.x, y: segment.start.y + (value - start) }

  const slack = segment.length - labelWidth
  if (slack <= 0) return [pointAt(mid)]

  const offsets: number[] = [0]
  for (let offset = step; offset <= slack / 2 + 1e-9; offset += step) {
    offsets.push(offset, -offset)
  }
  // Always consider both extremes, even when they fall between samples.
  offsets.push(slack / 2, -slack / 2)

  return offsets.map((offset) => pointAt(mid + offset * direction))
}

const doesPathIntersectBounds = (path: Point[], bounds: Bounds): boolean => {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    const segmentBounds: Bounds = {
      minX: Math.min(a.x, b.x),
      maxX: Math.max(a.x, b.x),
      minY: Math.min(a.y, b.y),
      maxY: Math.max(a.y, b.y),
    }
    // Trace segments are axis-aligned, so their bounding box is the segment.
    if (boundsOverlap(segmentBounds, bounds)) return true
  }
  return false
}

const GEOMETRY_EPSILON = 1e-6

/**
 * Shortens an axis-aligned terminal stub before the first unrelated trace.
 * Coordinates are schematic-world millimetres with +x right and +y up.
 */
const getCollisionLimitedTerminalStubEnd = ({
  start,
  intendedEnd,
  minimumLength,
  traces,
  ownGlobalConnNetId,
  ignoredTraceIds,
}: {
  start: Point
  intendedEnd: Point
  minimumLength: number
  traces: SolvedTracePath[]
  ownGlobalConnNetId: string
  ignoredTraceIds: Set<string>
}): Point | null => {
  const isHorizontal =
    Math.abs(intendedEnd.x - start.x) >= Math.abs(intendedEnd.y - start.y)
  const alongAxis = isHorizontal ? "x" : "y"
  const acrossAxis = isHorizontal ? "y" : "x"
  const direction = Math.sign(intendedEnd[alongAxis] - start[alongAxis]) || 1
  const intendedLength = Math.abs(intendedEnd[alongAxis] - start[alongAxis])
  let availableLength = intendedLength

  for (const trace of traces) {
    if (ignoredTraceIds.has(trace.mspPairId)) continue
    if (trace.globalConnNetId === ownGlobalConnNetId) continue

    for (
      let segmentIndex = 0;
      segmentIndex < trace.tracePath.length - 1;
      segmentIndex++
    ) {
      const segmentStart = trace.tracePath[segmentIndex]!
      const segmentEnd = trace.tracePath[segmentIndex + 1]!
      const startAlong =
        (segmentStart[alongAxis] - start[alongAxis]) * direction
      const endAlong = (segmentEnd[alongAxis] - start[alongAxis]) * direction
      const startAcross = segmentStart[acrossAxis] - start[acrossAxis]
      const endAcross = segmentEnd[acrossAxis] - start[acrossAxis]
      const minAlong = Math.min(startAlong, endAlong)
      const maxAlong = Math.max(startAlong, endAlong)
      const minAcross = Math.min(startAcross, endAcross)
      const maxAcross = Math.max(startAcross, endAcross)

      let collisionDistance: number | undefined
      const isCollinear =
        Math.abs(startAcross) <= GEOMETRY_EPSILON &&
        Math.abs(endAcross) <= GEOMETRY_EPSILON
      if (
        isCollinear &&
        maxAlong >= -GEOMETRY_EPSILON &&
        minAlong <=
          intendedLength +
            INLINE_NET_LABEL_STUB_TRACE_CLEARANCE +
            GEOMETRY_EPSILON
      ) {
        collisionDistance = Math.max(0, minAlong)
      } else {
        const crossesStubAxis =
          minAcross <= GEOMETRY_EPSILON && maxAcross >= -GEOMETRY_EPSILON
        const perpendicularAlong = (startAlong + endAlong) / 2
        if (
          crossesStubAxis &&
          Math.abs(startAlong - endAlong) <= GEOMETRY_EPSILON &&
          perpendicularAlong >= -GEOMETRY_EPSILON &&
          perpendicularAlong <=
            intendedLength +
              INLINE_NET_LABEL_STUB_TRACE_CLEARANCE +
              GEOMETRY_EPSILON
        ) {
          collisionDistance = Math.max(0, perpendicularAlong)
        }
      }

      if (collisionDistance !== undefined) {
        availableLength = Math.min(
          availableLength,
          collisionDistance - INLINE_NET_LABEL_STUB_TRACE_CLEARANCE,
        )
      }
    }
  }

  if (availableLength + GEOMETRY_EPSILON < minimumLength) return null

  return isHorizontal
    ? { x: start.x + direction * availableLength, y: start.y }
    : { x: start.x, y: start.y + direction * availableLength }
}
