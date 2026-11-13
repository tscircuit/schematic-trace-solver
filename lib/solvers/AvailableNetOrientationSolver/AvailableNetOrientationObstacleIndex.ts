import type { Bounds, Point } from "@tscircuit/math-utils"
import Flatbush from "flatbush"
import type { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputPin } from "lib/types/InputProblem"
import { EPS } from "./constants"
import { segmentCrossesBoundsInterior } from "./geometry"

export type IndexedTraceSegment = {
  trace: SolvedTracePath
  start: Point
  end: Point
}

export class AvailableNetOrientationObstacleIndex {
  private chipObstacleSpatialIndex: ChipObstacleSpatialIndex
  private labelIndex: Flatbush | null = null
  private traceSegmentIndex: Flatbush | null = null
  private traceSegments: IndexedTraceSegment[] = []
  private pinIndex: Flatbush | null = null
  private pins: InputPin[] = []

  constructor(params: {
    chipObstacleSpatialIndex: ChipObstacleSpatialIndex
    netLabelPlacements: NetLabelPlacement[]
    traces: SolvedTracePath[]
    pins?: InputPin[]
  }) {
    this.chipObstacleSpatialIndex = params.chipObstacleSpatialIndex
    this.pins = params.pins ?? []
    this.pinIndex = this.buildPinIndex(this.pins)
    this.rebuild(params)
  }

  /** Pins lying on any segment of the trace path, including its endpoints. */
  getPinsOnTracePath(tracePath: Point[]) {
    const pinsOnPath: InputPin[] = []
    if (!this.pinIndex) return pinsOnPath
    for (let pointIndex = 0; pointIndex < tracePath.length - 1; pointIndex++) {
      const start = tracePath[pointIndex]!
      const end = tracePath[pointIndex + 1]!
      const searchBounds = getPaddedBounds(getSegmentBounds(start, end), EPS)
      for (const pinIndex of this.pinIndex.search(
        searchBounds.minX,
        searchBounds.minY,
        searchBounds.maxX,
        searchBounds.maxY,
      )) {
        const pin = this.pins[pinIndex]!
        if (isPointOnAxisAlignedSegment(pin, start, end)) pinsOnPath.push(pin)
      }
    }
    return pinsOnPath
  }

  rebuild(params: {
    netLabelPlacements: NetLabelPlacement[]
    traces: SolvedTracePath[]
  }) {
    this.labelIndex = this.buildLabelIndex(params.netLabelPlacements)
    this.traceSegments = this.getTraceSegments(params.traces)
    this.traceSegmentIndex = this.buildTraceSegmentIndex(this.traceSegments)
  }

  getLabelIndicesInBounds(bounds: Bounds) {
    if (!this.labelIndex) return []
    return this.labelIndex.search(
      bounds.minX,
      bounds.minY,
      bounds.maxX,
      bounds.maxY,
    )
  }

  getTraceSegmentsInBounds(bounds: Bounds) {
    if (!this.traceSegmentIndex) return []
    const searchBounds = getPaddedBounds(bounds, EPS)
    return this.traceSegmentIndex
      .search(
        searchBounds.minX,
        searchBounds.minY,
        searchBounds.maxX,
        searchBounds.maxY,
      )
      .map((segmentIndex) => this.traceSegments[segmentIndex]!)
  }

  getLabelIndicesNearTracePath(tracePath: Point[]) {
    const labelIndices = new Set<number>()
    for (let pointIndex = 0; pointIndex < tracePath.length - 1; pointIndex++) {
      const segmentBounds = getPaddedBounds(
        getSegmentBounds(tracePath[pointIndex]!, tracePath[pointIndex + 1]!),
        EPS,
      )
      for (const labelIndex of this.getLabelIndicesInBounds(segmentBounds)) {
        labelIndices.add(labelIndex)
      }
    }
    return [...labelIndices].sort((a, b) => a - b)
  }

  doesTracePathCrossChip(tracePath: Point[]) {
    for (let pointIndex = 0; pointIndex < tracePath.length - 1; pointIndex++) {
      const start = tracePath[pointIndex]!
      const end = tracePath[pointIndex + 1]!
      const nearbyChips = this.chipObstacleSpatialIndex.getChipsInBounds(
        getPaddedBounds(getSegmentBounds(start, end), EPS),
      )
      for (const chip of nearbyChips) {
        if (segmentCrossesBoundsInterior(start, end, chip.bounds)) return true
      }
    }
    return false
  }

  doesTraceCrossBoundsInterior(bounds: Bounds) {
    for (const segment of this.getTraceSegmentsInBounds(bounds)) {
      if (segmentCrossesBoundsInterior(segment.start, segment.end, bounds)) {
        return true
      }
    }
    return false
  }

  doesTraceIntersectBounds(params: {
    bounds: Bounds
    excludedGlobalConnNetId: string
  }) {
    for (const segment of this.getTraceSegmentsInBounds(params.bounds)) {
      if (segment.trace.globalConnNetId === params.excludedGlobalConnNetId) {
        continue
      }
      if (segmentIntersectsRect(segment.start, segment.end, params.bounds)) {
        return true
      }
    }
    return false
  }

  private buildLabelIndex(netLabelPlacements: NetLabelPlacement[]) {
    if (netLabelPlacements.length === 0) return null

    const labelIndex = new Flatbush(netLabelPlacements.length)
    for (const label of netLabelPlacements) {
      labelIndex.add(
        label.center.x - label.width / 2,
        label.center.y - label.height / 2,
        label.center.x + label.width / 2,
        label.center.y + label.height / 2,
      )
    }
    labelIndex.finish()
    return labelIndex
  }

  private getTraceSegments(traces: SolvedTracePath[]) {
    const traceSegments: IndexedTraceSegment[] = []
    for (const trace of traces) {
      for (
        let pointIndex = 0;
        pointIndex < trace.tracePath.length - 1;
        pointIndex++
      ) {
        traceSegments.push({
          trace,
          start: trace.tracePath[pointIndex]!,
          end: trace.tracePath[pointIndex + 1]!,
        })
      }
    }
    return traceSegments
  }

  private buildPinIndex(pins: InputPin[]) {
    if (pins.length === 0) return null

    const pinIndex = new Flatbush(pins.length)
    for (const pin of pins) {
      pinIndex.add(pin.x, pin.y, pin.x, pin.y)
    }
    pinIndex.finish()
    return pinIndex
  }

  private buildTraceSegmentIndex(traceSegments: IndexedTraceSegment[]) {
    if (traceSegments.length === 0) return null

    const traceSegmentIndex = new Flatbush(traceSegments.length)
    for (const segment of traceSegments) {
      traceSegmentIndex.add(
        Math.min(segment.start.x, segment.end.x),
        Math.min(segment.start.y, segment.end.y),
        Math.max(segment.start.x, segment.end.x),
        Math.max(segment.start.y, segment.end.y),
      )
    }
    traceSegmentIndex.finish()
    return traceSegmentIndex
  }
}

function getSegmentBounds(start: Point, end: Point): Bounds {
  return {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y),
  }
}

function isPointOnAxisAlignedSegment(point: Point, start: Point, end: Point) {
  const isHorizontal = Math.abs(start.y - end.y) < EPS
  const isVertical = Math.abs(start.x - end.x) < EPS
  if (isHorizontal && Math.abs(point.y - start.y) < EPS) {
    return (
      point.x >= Math.min(start.x, end.x) - EPS &&
      point.x <= Math.max(start.x, end.x) + EPS
    )
  }
  if (isVertical && Math.abs(point.x - start.x) < EPS) {
    return (
      point.y >= Math.min(start.y, end.y) - EPS &&
      point.y <= Math.max(start.y, end.y) + EPS
    )
  }
  return false
}

function getPaddedBounds(bounds: Bounds, padding: number): Bounds {
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
  }
}
