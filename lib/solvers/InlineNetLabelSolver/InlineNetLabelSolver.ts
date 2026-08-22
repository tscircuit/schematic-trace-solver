import type { Bounds, Point } from "@tscircuit/math-utils"
import type { GraphicsObject, Rect } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type {
  InputDirectConnection,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { boundsOverlap, getTextBoxBounds } from "lib/utils/textBoxBounds"
import {
  type AxisAlignedSegment,
  getAxisAlignedSegments,
} from "./getAxisAlignedSegments"

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
  mspPairId: string
  pinIds: PinId[]

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

const getPinPairKey = (pinIds: readonly string[]) =>
  [...pinIds].sort().join("::")

/**
 * Places "inline net labels" - net names drawn alongside the trace they belong
 * to - for direct connections that opted in via `allowInlineNetLabel`.
 *
 * Any regular (anchored) net label placement for the same net is dropped, so a
 * net is never labeled twice.
 */
export class InlineNetLabelSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  inputNetLabelPlacements: NetLabelPlacement[]

  inlineNetLabelPlacements: InlineNetLabelPlacement[] = []

  /** Direct connections that opted in, still waiting to be processed */
  queuedDirectConnections: InputDirectConnection[]

  private tracesByPinPairKey: Map<string, SolvedTracePath[]>

  constructor(input: InlineNetLabelSolverInput) {
    super()
    this.inputProblem = input.inputProblem
    this.traces = input.traces
    this.inputNetLabelPlacements = input.netLabelPlacements

    this.queuedDirectConnections = this.inputProblem.directConnections.filter(
      (dc) => dc.allowInlineNetLabel && dc.netId,
    )

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
    const directConnection = this.queuedDirectConnections.shift()
    if (!directConnection) {
      this.solved = true
      this.stats.inlineNetLabelCount = this.inlineNetLabelPlacements.length
      return
    }

    const placement = this.computeInlinePlacement(directConnection)
    if (placement) {
      this.inlineNetLabelPlacements.push(placement)
    }
  }

  private computeInlinePlacement(
    directConnection: InputDirectConnection,
  ): InlineNetLabelPlacement | null {
    // Only connections the router actually drew a trace for can carry an inline
    // label - there's nothing to run parallel to otherwise.
    const traces =
      this.tracesByPinPairKey.get(getPinPairKey(directConnection.pinIds)) ?? []
    if (traces.length === 0) return null

    const trace = traces[0]!
    const segments = getAxisAlignedSegments(trace.tracePath)
    if (segments.length === 0) return null

    const height =
      directConnection.inlineNetLabelHeight ?? DEFAULT_INLINE_NET_LABEL_HEIGHT
    const width =
      directConnection.inlineNetLabelWidth ??
      directConnection.netLabelWidth ??
      estimateInlineNetLabelWidth(directConnection.netId!, height)

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

          if (this.isObstructed(bounds, trace)) continue

          return {
            globalConnNetId: trace.globalConnNetId,
            netId: directConnection.netId,
            mspPairId: trace.mspPairId,
            pinIds: [...directConnection.pinIds],
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
      directConnection,
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
    directConnection,
    width,
    height,
    offset,
  }: {
    trace: SolvedTracePath
    directConnection: InputDirectConnection
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

        if (this.isObstructed(bounds, trace)) continue

        const anchorPoint: Point =
          axis === "x"
            ? { x: along, y: side === "y+" ? maxY : minY }
            : { x: side === "x-" ? minX : maxX, y: along }

        return {
          globalConnNetId: trace.globalConnNetId,
          netId: directConnection.netId,
          mspPairId: trace.mspPairId,
          pinIds: [...directConnection.pinIds],
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
  private isObstructed(bounds: Bounds, ownTrace: SolvedTracePath): boolean {
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
      if (trace.mspPairId === ownTrace.mspPairId) continue
      if (trace.globalConnNetId === ownTrace.globalConnNetId) continue
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

  getOutput() {
    const superseded = this.getSupersededNetLabelKeys()
    return {
      traces: this.traces,
      netLabelPlacements: this.inputNetLabelPlacements.filter(
        (placement) => !superseded.has(placement.globalConnNetId),
      ),
      inlineNetLabelPlacements: this.inlineNetLabelPlacements,
    }
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

    for (const trace of this.traces) {
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
        x: inlineLabel.center.x,
        y: inlineLabel.center.y,
        text: inlineLabel.netId ?? "",
        color: "green",
        fontSize: inlineLabel.height,
        anchorSide: "center",
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
