import type { Bounds, Point } from "@tscircuit/math-utils"
import type { GraphicsObject, Rect } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getPinDirection } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type {
  InputDirectConnection,
  InputNetConnection,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { boundsOverlap, getTextBoxBounds } from "lib/utils/textBoxBounds"
import {
  type AxisAlignedSegment,
  getAxisAlignedSegments,
} from "./getAxisAlignedSegments"
import { alignPortOnlyInlineNetLabelStubs } from "./alignPortOnlyInlineNetLabelStubs"
import { pushAnchoredNetLabelsAwayFromInlineLabels } from "./pushAnchoredNetLabelsAwayFromInlineLabels"

export const DEFAULT_INLINE_NET_LABEL_HEIGHT = 0.18

/**
 * Gap between the trace and the near edge of the inline label text.
 */
export const INLINE_NET_LABEL_TRACE_MARGIN = 0.05

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
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

type InlineEligibleConnection = InputDirectConnection | InputNetConnection

const getPinPairKey = (pinIds: readonly string[]) =>
  [...pinIds].sort().join("::")

/**
 * Places "inline net labels" - net names drawn alongside the trace they belong
 * to - for one- or two-pin connections that opted in via
 * `allowInlineNetLabel`.
 *
 * Any regular (anchored) net label placement for the same net is dropped, so a
 * net is never labeled twice.
 */
export class InlineNetLabelSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  inputNetLabelPlacements: NetLabelPlacement[]

  inlineNetLabelPlacements: InlineNetLabelPlacement[] = []

  /** Eligible one- or two-pin connections still waiting to be processed. */
  queuedConnections: InlineEligibleConnection[]

  private tracesByPinPairKey: Map<string, SolvedTracePath[]>
  private hasAlignedPortOnlyStubs = false
  private postProcessedOutput?: {
    traces: SolvedTracePath[]
    netLabelPlacements: NetLabelPlacement[]
    inlineNetLabelPlacements: InlineNetLabelPlacement[]
  }

  constructor(input: InlineNetLabelSolverInput) {
    super()
    this.inputProblem = input.inputProblem
    this.traces = input.traces
    this.inputNetLabelPlacements = input.netLabelPlacements

    this.queuedConnections = [
      ...this.inputProblem.directConnections.filter(
        (connection) => connection.allowInlineNetLabel && connection.netId,
      ),
      ...this.inputProblem.netConnections.filter(
        (connection) =>
          connection.allowInlineNetLabel &&
          connection.pinIds.length >= 1 &&
          connection.pinIds.length <= 2 &&
          connection.netId,
      ),
    ]

    this.tracesByPinPairKey = new Map()
    for (const trace of this.traces) {
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
      },
    ]
  }

  override _step() {
    const connection = this.queuedConnections.shift()
    if (connection) {
      const routedTraces =
        connection.pinIds.length === 2
          ? (this.tracesByPinPairKey.get(getPinPairKey(connection.pinIds)) ??
            [])
          : []

      if (routedTraces.length > 0) {
        const placement = this.computeInlinePlacement(connection)
        if (placement) this.inlineNetLabelPlacements.push(placement)
      } else {
        // A one-pin net has one conventional endpoint label, while a skipped
        // two-pin route has one at each endpoint. Convert a two-pin pair
        // atomically so a collision at one endpoint cannot leave mixed inline
        // and anchored representations for the same net.
        const terminalPlacements = connection.pinIds.map((pinId) =>
          this.computeTerminalInlinePlacement(connection, pinId),
        )
        if (terminalPlacements.every((placement) => placement !== null)) {
          this.inlineNetLabelPlacements.push(...terminalPlacements)
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

    this.solved = true
    this.stats.inlineNetLabelCount = this.inlineNetLabelPlacements.length
  }

  /**
   * Converts one conventional endpoint placement into an inline label on a
   * generated outward stub. The stub follows the pin's true facing direction;
   * an anchored label may finish in another direction after an elbow, which is
   * not the direction a terminal stub should leave the pin.
   */
  private computeTerminalInlinePlacement(
    connection: InlineEligibleConnection,
    pinId: PinId,
  ): InlineNetLabelPlacement | null {
    if (!connection.netId) return null

    const anchoredPlacement = this.inputNetLabelPlacements.find(
      (placement) =>
        placement.netId === connection.netId &&
        placement.pinIds.length === 1 &&
        placement.pinIds[0] === pinId,
    )
    if (!anchoredPlacement) return null

    const inputChip = this.inputProblem.chips.find((chip) =>
      chip.pins.some((pin) => pin.pinId === pinId),
    )
    const inputPin = inputChip?.pins.find((pin) => pin.pinId === pinId)

    const height =
      connection.inlineNetLabelHeight ?? DEFAULT_INLINE_NET_LABEL_HEIGHT
    const width =
      connection.inlineNetLabelWidth ??
      connection.netLabelWidth ??
      estimateInlineNetLabelWidth(connection.netId, height)

    // Leave a small wire tail at both ends of the text so it unmistakably
    // reads as a label on a trace rather than free-standing text.
    const stubLength = Math.max(width + 0.2, 0.6)
    const start = inputPin
      ? { x: inputPin.x, y: inputPin.y }
      : anchoredPlacement.anchorPoint
    const direction =
      inputPin && inputChip
        ? (inputPin._facingDirection ?? getPinDirection(inputPin, inputChip))
        : anchoredPlacement.orientation
    const end: Point =
      direction === "x+"
        ? { x: start.x + stubLength, y: start.y }
        : direction === "x-"
          ? { x: start.x - stubLength, y: start.y }
          : direction === "y+"
            ? { x: start.x, y: start.y + stubLength }
            : { x: start.x, y: start.y - stubLength }

    const axis: InlineNetLabelPlacement["axis"] =
      direction === "x+" || direction === "x-" ? "x" : "y"
    const side: InlineNetLabelPlacement["side"] = axis === "x" ? "y+" : "x-"
    const anchorPoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    }
    const offset = height / 2 + INLINE_NET_LABEL_TRACE_MARGIN
    const center: Point =
      side === "y+"
        ? { x: anchorPoint.x, y: anchorPoint.y + offset }
        : { x: anchorPoint.x - offset, y: anchorPoint.y }

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
        ownGlobalConnNetId: anchoredPlacement.globalConnNetId,
      })
    ) {
      return null
    }

    return {
      globalConnNetId: anchoredPlacement.globalConnNetId,
      netId: connection.netId,
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

  private computeInlinePlacement(
    connection: InlineEligibleConnection,
  ): InlineNetLabelPlacement | null {
    // Only connections the router actually drew a trace for can carry an inline
    // label - there's nothing to run parallel to otherwise.
    const traces =
      this.tracesByPinPairKey.get(getPinPairKey(connection.pinIds)) ?? []
    if (traces.length === 0) return null

    const trace = traces[0]!
    const segments = getAxisAlignedSegments(trace.tracePath)
    if (segments.length === 0) return null

    const height =
      connection.inlineNetLabelHeight ?? DEFAULT_INLINE_NET_LABEL_HEIGHT
    const width =
      connection.inlineNetLabelWidth ??
      connection.netLabelWidth ??
      estimateInlineNetLabelWidth(connection.netId!, height)

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
            })
          )
            continue

          return {
            globalConnNetId: trace.globalConnNetId,
            netId: connection.netId,
            mspPairId: trace.mspPairId,
            pinIds: [...connection.pinIds],
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

    // Second choice: no single run fits, but a route that is straight except
    // for small jogs still reads as one wire - center the label over the
    // route's overall span, bridging the jogs, without extending past its
    // endpoints.
    const spanPlacement = this.computeSpanPlacement({
      trace,
      connection,
      width,
      height,
      offset,
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
    width,
    height,
    offset,
  }: {
    trace: SolvedTracePath
    connection: InlineEligibleConnection
    width: number
    height: number
    offset: number
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
          mspPairId: trace.mspPairId,
          pinIds: [...connection.pinIds],
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
    }: {
      ownTrace?: SolvedTracePath
      ownGlobalConnNetId: string
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

    for (const trace of this.traces) {
      if (ownTrace && trace.mspPairId === ownTrace.mspPairId) continue
      if (trace.globalConnNetId === ownGlobalConnNetId) continue
      if (doesPathIntersectBounds(trace.tracePath, bounds)) return true
    }

    return false
  }

  /**
   * Net label placements superseded by an inline label. A net gets one label or
   * the other, never both.
   */
  private getSupersededNetLabelKeys(): Set<string> {
    const keys = new Set<string>()
    for (const placement of this.inlineNetLabelPlacements) {
      keys.add(placement.globalConnNetId)
    }
    return keys
  }

  private getOutputTraces(supersededNetLabelKeys: Set<string>) {
    return this.traces.filter(
      (trace) =>
        !(
          supersededNetLabelKeys.has(trace.globalConnNetId) &&
          trace.mspPairId.startsWith("available-net-orientation-")
        ),
    )
  }

  private buildPostProcessedOutput() {
    const superseded = this.getSupersededNetLabelKeys()
    const retainedNetLabelPlacements = this.inputNetLabelPlacements.filter(
      (placement) => !superseded.has(placement.globalConnNetId),
    )
    const outputTraces = this.getOutputTraces(superseded)
    const pushed = pushAnchoredNetLabelsAwayFromInlineLabels({
      inputProblem: this.inputProblem,
      traces: outputTraces,
      netLabelPlacements: retainedNetLabelPlacements,
      inlineNetLabelPlacements: this.inlineNetLabelPlacements,
    })
    this.stats.pushedAnchoredNetLabelCount = pushed.movedLabelCount
    return {
      traces: pushed.traces,
      netLabelPlacements: pushed.netLabelPlacements,
      inlineNetLabelPlacements: this.inlineNetLabelPlacements,
    }
  }

  getOutput() {
    if (this.postProcessedOutput) return this.postProcessedOutput
    return this.buildPostProcessedOutput()
  }

  override visualize(): GraphicsObject {
    // Mirrors the previous pipeline stage's visualization so that a problem
    // with no inline labels renders identically, then layers the inline labels
    // on top.
    const graphics = visualizeInputProblem(this.inputProblem)
    graphics.lines ??= []
    graphics.rects ??= []
    graphics.points ??= []
    graphics.texts ??= []

    const output = this.getOutput()
    for (const trace of output.traces) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    const { netLabelPlacements } = this.getOutput()
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

    for (const inlineLabel of this.inlineNetLabelPlacements) {
      if (inlineLabel.stubTracePath) {
        graphics.lines.push({
          points: inlineLabel.stubTracePath,
          strokeColor: "purple",
        })
      }
      const isHorizontal = inlineLabel.axis === "x"
      graphics.rects.push({
        center: inlineLabel.center,
        width: isHorizontal ? inlineLabel.width : inlineLabel.height,
        height: isHorizontal ? inlineLabel.height : inlineLabel.width,
        fill: getColorFromString(inlineLabel.globalConnNetId, 0.35),
        strokeColor: "green",
        label: [
          `INLINE netId: ${inlineLabel.netId}`,
          `axis: ${inlineLabel.axis}`,
          `side: ${inlineLabel.side}`,
        ].join("\n"),
      } as Rect & { strokeColor: string })
      graphics.texts.push({
        x:
          inlineLabel.stubTracePath && inlineLabel.axis === "x"
            ? inlineLabel.center.x +
              (inlineLabel.stubTracePath[1].x > inlineLabel.stubTracePath[0].x
                ? -inlineLabel.width / 2
                : inlineLabel.width / 2)
            : inlineLabel.center.x,
        y:
          inlineLabel.stubTracePath && inlineLabel.axis === "y"
            ? inlineLabel.center.y +
              (inlineLabel.stubTracePath[1].y > inlineLabel.stubTracePath[0].y
                ? -inlineLabel.width / 2
                : inlineLabel.width / 2)
            : inlineLabel.center.y,
        text: inlineLabel.netId ?? "",
        color: "green",
        fontSize: inlineLabel.height,
        anchorSide: inlineLabel.stubTracePath
          ? inlineLabel.stubTracePath[1][inlineLabel.axis] >
            inlineLabel.stubTracePath[0][inlineLabel.axis]
            ? "center_left"
            : "center_right"
          : "center",
        // Vertical labels read bottom-to-top, alongside the wire they name.
        rotation: inlineLabel.axis === "y" ? 90 : undefined,
      })
      graphics.points.push({
        x: inlineLabel.anchorPoint.x,
        y: inlineLabel.anchorPoint.y,
        color: "green",
        label: `inline anchor\n${inlineLabel.netId}`,
      })
    }

    return graphics
  }
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
