import { BaseSolver } from "../BaseSolver/BaseSolver"
import { detectTraceLabelOverlap } from "./detectTraceLabelOverlap"
import {
  hasCollisions,
  rerouteCollidingTrace,
  simplifyPath,
} from "./rerouteCollidingTrace"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { GraphicsObject, Point } from "graphics-debug"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { getRectBounds } from "../NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { getColorFromString } from "lib/utils/getColorFromString"
import type { InputProblem } from "lib/types/InputProblem"
import { getObstacleRects } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { segmentIntersectsRect } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

interface TraceLabelOverlapAvoidanceSolverParams {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

const countTurns = (points: Point[]): number => {
  let turns = 0
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]

    const prevVertical = prev.x === curr.x
    const nextVertical = curr.x === next.x

    if (prevVertical !== nextVertical) {
      turns++
    }
  }
  return turns
}

const minimizeTurns = (
  path: Point[],
  obstacles: any[],
  labelBounds: any[],
): Point[] => {
  if (path.length <= 2) {
    return path
  }

  const hasCollisionsWithLabels = (
    pathSegments: Point[],
    labels: any[],
  ): boolean => {
    for (let i = 0; i < pathSegments.length - 1; i++) {
      const p1 = pathSegments[i]
      const p2 = pathSegments[i + 1]

      for (const label of labels) {
        if (segmentIntersectsRect(p1, p2, label)) {
          return true
        }
      }
    }
    return false
  }

  const tryConnectPoints = (start: Point, end: Point): Point[][] => {
    const candidates: Point[][] = []

    if (start.x === end.x || start.y === end.y) {
      candidates.push([start, end])
    } else {
      candidates.push([start, { x: end.x, y: start.y }, end])
      candidates.push([start, { x: start.x, y: end.y }, end])
    }

    return candidates
  }

  const recognizeStairStepPattern = (
    pathToCheck: Point[],
    startIdx: number,
  ): number => {
    if (startIdx >= pathToCheck.length - 3) return -1

    let endIdx = startIdx
    let isStairStep = true

    for (
      let i = startIdx;
      i < pathToCheck.length - 2 && i < startIdx + 10;
      i++
    ) {
      if (i + 2 >= pathToCheck.length) break

      const p1 = pathToCheck[i]
      const p2 = pathToCheck[i + 1]
      const p3 = pathToCheck[i + 2]

      const seg1Vertical = p1.x === p2.x
      const seg2Vertical = p2.x === p3.x

      if (seg1Vertical === seg2Vertical) {
        break
      }

      const seg1Direction = seg1Vertical
        ? Math.sign(p2.y - p1.y)
        : Math.sign(p2.x - p1.x)

      if (i > startIdx) {
        const prevP = pathToCheck[i - 1]
        const prevSegVertical = prevP.x === p1.x
        const prevDirection = prevSegVertical
          ? Math.sign(p1.y - prevP.y)
          : Math.sign(p1.x - prevP.x)

        if (
          (seg1Vertical &&
            prevSegVertical &&
            seg1Direction !== prevDirection) ||
          (!seg1Vertical && !prevSegVertical && seg1Direction !== prevDirection)
        ) {
          isStairStep = false
          break
        }
      }

      endIdx = i + 2
    }

    return isStairStep && endIdx - startIdx >= 3 ? endIdx : -1
  }

  let optimizedPath = [...path]
  let currentTurns = countTurns(optimizedPath)
  let improved = true

  while (improved) {
    improved = false

    // First try to identify and replace stair-step patterns
    for (let startIdx = 0; startIdx < optimizedPath.length - 3; startIdx++) {
      const stairEndIdx = recognizeStairStepPattern(optimizedPath, startIdx)

      if (stairEndIdx > 0) {
        const startPoint = optimizedPath[startIdx]
        const endPoint = optimizedPath[stairEndIdx]

        const connectionOptions = tryConnectPoints(startPoint, endPoint)

        for (const connection of connectionOptions) {
          const testPath = [
            ...optimizedPath.slice(0, startIdx + 1),
            ...connection.slice(1, -1),
            ...optimizedPath.slice(stairEndIdx),
          ]

          const collidesWithObstacles = hasCollisions(connection, obstacles)
          const collidesWithLabels = hasCollisionsWithLabels(
            connection,
            labelBounds,
          )

          if (!collidesWithObstacles && !collidesWithLabels) {
            const newTurns = countTurns(testPath)
            const turnsRemoved = stairEndIdx - startIdx - 1

            optimizedPath = testPath
            currentTurns = newTurns
            improved = true
            break
          }
        }

        if (improved) break
      }
    }

    // If no stair-step optimization worked, try regular point removal
    if (!improved) {
      for (let startIdx = 0; startIdx < optimizedPath.length - 2; startIdx++) {
        const maxRemove = Math.min(
          optimizedPath.length - startIdx - 2,
          optimizedPath.length - 2,
        )

        for (let removeCount = 1; removeCount <= maxRemove; removeCount++) {
          const endIdx = startIdx + removeCount + 1

          if (endIdx >= optimizedPath.length) continue

          const startPoint = optimizedPath[startIdx]
          const endPoint = optimizedPath[endIdx]

          const connectionOptions = tryConnectPoints(startPoint, endPoint)

          for (const connection of connectionOptions) {
            const testPath = [
              ...optimizedPath.slice(0, startIdx + 1),
              ...connection.slice(1, -1),
              ...optimizedPath.slice(endIdx),
            ]

            const connectionSegments = connection
            const collidesWithObstacles = hasCollisions(
              connectionSegments,
              obstacles,
            )
            const collidesWithLabels = hasCollisionsWithLabels(
              connectionSegments,
              labelBounds,
            )

            if (!collidesWithObstacles && !collidesWithLabels) {
              const newTurns = countTurns(testPath)

              if (
                newTurns < currentTurns ||
                (newTurns === currentTurns &&
                  testPath.length < optimizedPath.length)
              ) {
                optimizedPath = testPath
                currentTurns = newTurns
                improved = true
                break
              }
            }
          }

          if (improved) break
        }
        if (improved) break
      }
    }

    if (!improved) {
      for (let i = 0; i < optimizedPath.length - 2; i++) {
        const p1 = optimizedPath[i]
        const p2 = optimizedPath[i + 1]
        const p3 = optimizedPath[i + 2]

        const allVertical = p1.x === p2.x && p2.x === p3.x
        const allHorizontal = p1.y === p2.y && p2.y === p3.y

        if (allVertical || allHorizontal) {
          const testPath = [
            ...optimizedPath.slice(0, i + 1),
            ...optimizedPath.slice(i + 2),
          ]

          const collidesWithObstacles = hasCollisions([p1, p3], obstacles)
          const collidesWithLabels = hasCollisionsWithLabels(
            [p1, p3],
            labelBounds,
          )

          if (!collidesWithObstacles && !collidesWithLabels) {
            optimizedPath = testPath
            improved = true
            break
          }
        }
      }
    }
  }

  const finalSimplifiedPath = simplifyPath(optimizedPath)
  return finalSimplifiedPath
}

const minimizeTurnsWithFilteredLabels = (
  traces: SolvedTracePath[],
  problem: InputProblem,
  allLabelPlacements: NetLabelPlacement[],
  mergedLabelNetIdMap: Map<string, Set<string>>,
  paddingBuffer: number,
): SolvedTracePath[] | null => {
  let changesMade = false
  const obstacles = getObstacleRects(problem)

  const newTraces = traces.map((trace) => {
    const originalPath = trace.tracePath
    const filteredLabels = allLabelPlacements.filter((label) => {
      const originalNetIds = mergedLabelNetIdMap.get(label.globalConnNetId)
      if (originalNetIds) {
        return !originalNetIds.has(trace.globalConnNetId)
      }
      return label.globalConnNetId !== trace.globalConnNetId
    })

    const labelBounds = filteredLabels.map((nl) => ({
      minX: nl.center.x - nl.width / 2 - paddingBuffer,
      maxX: nl.center.x + nl.width / 2 + paddingBuffer,
      minY: nl.center.y - nl.height / 2 - paddingBuffer,
      maxY: nl.center.y + nl.height / 2 + paddingBuffer,
    }))

    const newPath = minimizeTurns(originalPath, obstacles, labelBounds)

    if (
      newPath.length !== originalPath.length ||
      newPath.some(
        (p, i) => p.x !== originalPath[i].x || p.y !== originalPath[i].y,
      )
    ) {
      changesMade = true
    }

    return {
      ...trace,
      tracePath: newPath,
    }
  })

  if (changesMade) {
    return newTraces
  } else {
    return null
  }
}

const balanceLShapes = (
  traces: SolvedTracePath[],
  problem: InputProblem,
  allLabelPlacements: NetLabelPlacement[],
): SolvedTracePath[] | null => {
  const TOLERANCE = 1e-5
  console.log(
    `[balanceLShapes] Starting Z-shape balancing pass (v6) with tolerance: ${TOLERANCE}`,
  )
  let changesMade = false

  const obstacles = getObstacleRects(problem).map((obs) => ({
    ...obs,
    minX: obs.minX + TOLERANCE,
    maxX: obs.maxX - TOLERANCE,
    minY: obs.minY + TOLERANCE,
    maxY: obs.maxY - TOLERANCE,
  }))

  const segmentIntersectsAnyRect = (
    p1: Point,
    p2: Point,
    rects: any[],
  ): boolean => {
    for (const rect of rects) {
      if (segmentIntersectsRect(p1, p2, rect)) {
        return true
      }
    }
    return false
  }

  const getLabelBounds = (labels: NetLabelPlacement[], traceNetId: string) => {
    const filteredLabels = labels.filter(
      (label) => label.globalConnNetId !== traceNetId,
    )

    return filteredLabels.map((nl) => ({
      minX: nl.center.x - nl.width / 2 + TOLERANCE,
      maxX: nl.center.x + nl.width / 2 - TOLERANCE,
      minY: nl.center.y - nl.height / 2 + TOLERANCE,
      maxY: nl.center.y + nl.height / 2 - TOLERANCE,
    }))
  }

  const newTraces = traces.map((trace) => {
    console.log(`[balanceLShapes] Processing trace: ${trace.mspPairId}`)
    const newPath = [...trace.tracePath]

    if (newPath.length < 6) {
      console.log(
        `[balanceLShapes] Path too short to have non-anchor Z-shapes. Skipping.`,
      )
      return { ...trace }
    }

    const labelBounds = getLabelBounds(
      allLabelPlacements,
      trace.globalConnNetId,
    )

    for (let i = 1; i < newPath.length - 4; i++) {
      const p1 = newPath[i]
      const p2 = newPath[i + 1]
      const p3 = newPath[i + 2]
      const p4 = newPath[i + 3]

      const is_H_V_H_Z_shape = p1.y === p2.y && p2.x === p3.x && p3.y === p4.y
      const is_V_H_V_Z_shape = p1.x === p2.x && p2.y === p3.y && p3.x === p4.x

      if (!is_H_V_H_Z_shape && !is_V_H_V_Z_shape) {
        continue
      }

      console.log(
        `[balanceLShapes] Found Z-shape at index ${i}:`,
        JSON.stringify([p1, p2, p3, p4]),
      )

      let p2_new: Point, p3_new: Point
      const len1_original = is_H_V_H_Z_shape
        ? Math.abs(p1.x - p2.x)
        : Math.abs(p1.y - p2.y)
      const len2_original = is_H_V_H_Z_shape
        ? Math.abs(p3.x - p4.x)
        : Math.abs(p3.y - p4.y)

      if (Math.abs(len1_original - len2_original) < 0.001) {
        console.log(`[balanceLShapes] Z-shape is already balanced. Skipping.`)
        continue
      }

      if (is_H_V_H_Z_shape) {
        const ideal_x = (p1.x + p4.x) / 2
        p2_new = { x: ideal_x, y: p2.y }
        p3_new = { x: ideal_x, y: p3.y }
      } else {
        const ideal_y = (p1.y + p4.y) / 2
        p2_new = { x: p2.x, y: ideal_y }
        p3_new = { x: p3.x, y: ideal_y }
      }

      console.log(
        `[balanceLShapes] Proposing new points: p2_new=${JSON.stringify(p2_new)}, p3_new=${JSON.stringify(p3_new)}`,
      )

      const collides =
        segmentIntersectsAnyRect(p1, p2_new, obstacles) ||
        segmentIntersectsAnyRect(p2_new, p3_new, obstacles) ||
        segmentIntersectsAnyRect(p3_new, p4, obstacles) ||
        segmentIntersectsAnyRect(p1, p2_new, labelBounds) ||
        segmentIntersectsAnyRect(p2_new, p3_new, labelBounds) ||
        segmentIntersectsAnyRect(p3_new, p4, labelBounds)

      if (!collides) {
        console.log(
          `[balanceLShapes] No collisions found. Applying new points.`,
        )
        newPath[i + 1] = p2_new
        newPath[i + 2] = p3_new
        changesMade = true
        i = 0
      } else {
        console.log(
          `[balanceLShapes] Collision detected. Cannot apply new points.`,
        )
      }
    }

    const finalSimplifiedPath = simplifyPath(newPath)
    console.log(
      `[balanceLShapes] Final simplified path for trace ${trace.mspPairId}:`,
      JSON.stringify(finalSimplifiedPath),
    )

    return {
      ...trace,
      tracePath: finalSimplifiedPath,
    }
  })

  if (changesMade) {
    console.log(
      "[balanceLShapes] Z-shape balancing pass finished. Changes were made.",
    )
    return newTraces
  } else {
    console.log(
      "[balanceLShapes] Z-shape balancing pass finished. No changes were made.",
    )
    return null
  }
}

export class TraceLabelOverlapAvoidanceSolver extends BaseSolver {
  private problem: InputProblem
  private traces: SolvedTracePath[]
  private netTempLabelPlacements: NetLabelPlacement[]
  private netLabelPlacements: NetLabelPlacement[]
  public updatedTraces: SolvedTracePath[]
  private mergedLabelNetIdMap: Map<string, Set<string>>
  private detourCountByLabel: Map<string, number>
  private readonly PADDING_BUFFER = 0.1

  constructor(params: TraceLabelOverlapAvoidanceSolverParams) {
    super()
    this.problem = params.inputProblem
    this.traces = params.traces
    this.updatedTraces = [...params.traces]
    this.mergedLabelNetIdMap = new Map()
    this.detourCountByLabel = new Map()

    const originalLabels = params.netLabelPlacements
    this.netLabelPlacements = originalLabels
    if (!originalLabels || originalLabels.length === 0) {
      this.netTempLabelPlacements = []
      return
    }

    const labelGroups = new Map<string, NetLabelPlacement[]>()

    for (const p of originalLabels) {
      if (p.pinIds.length === 0) continue
      const chipId = p.pinIds[0].split(".")[0]
      if (!chipId) continue
      const key = `${chipId}-${p.orientation}`
      if (!labelGroups.has(key)) {
        labelGroups.set(key, [])
      }
      labelGroups.get(key)!.push(p)
    }

    const finalPlacements: NetLabelPlacement[] = []
    for (const [key, group] of labelGroups.entries()) {
      if (group.length <= 1) {
        finalPlacements.push(...group)
        continue
      }

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
      for (const p of group) {
        const bounds = getRectBounds(p.center, p.width, p.height)
        minX = Math.min(minX, bounds.minX)
        minY = Math.min(minY, bounds.minY)
        maxX = Math.max(maxX, bounds.maxX)
        maxY = Math.max(maxY, bounds.maxY)
      }

      const newWidth = maxX - minX
      const newHeight = maxY - minY
      const template = group[0]!
      const syntheticId = `merged-group-${key}`
      const originalNetIds = new Set(group.map((p) => p.globalConnNetId))
      this.mergedLabelNetIdMap.set(syntheticId, originalNetIds)

      finalPlacements.push({
        ...template,
        globalConnNetId: syntheticId,
        width: newWidth,
        height: newHeight,
        center: { x: minX + newWidth / 2, y: minY + newHeight / 2 },
        pinIds: [...new Set(group.flatMap((p) => p.pinIds))],
        mspConnectionPairIds: [
          ...new Set(group.flatMap((p) => p.mspConnectionPairIds)),
        ],
      })
    }

    this.netTempLabelPlacements = finalPlacements
  }

  override _step() {
    if (
      !this.traces ||
      this.traces.length === 0 ||
      !this.netTempLabelPlacements ||
      this.netTempLabelPlacements.length === 0
    ) {
      this.solved = true
      return
    }

    this.detourCountByLabel.clear()

    const overlaps = detectTraceLabelOverlap(
      this.traces,
      this.netTempLabelPlacements,
    )

    if (overlaps.length === 0) {
      this.solved = true
      return
    }

    const unfriendlyOverlaps = overlaps.filter((o) => {
      const originalNetIds = this.mergedLabelNetIdMap.get(
        o.label.globalConnNetId,
      )
      if (originalNetIds) {
        return !originalNetIds.has(o.trace.globalConnNetId)
      }
      return o.trace.globalConnNetId !== o.label.globalConnNetId
    })

    if (unfriendlyOverlaps.length === 0) {
      this.solved = true
      return
    }

    const updatedTracesMap = new Map<string, SolvedTracePath>()
    for (const trace of this.traces) {
      updatedTracesMap.set(trace.mspPairId, trace)
    }

    const processedTraceIds = new Set<string>()

    for (const overlap of unfriendlyOverlaps) {
      if (processedTraceIds.has(overlap.trace.mspPairId)) {
        continue
      }

      const currentTraceState = updatedTracesMap.get(overlap.trace.mspPairId)!
      const labelId = overlap.label.globalConnNetId
      const detourCount = this.detourCountByLabel.get(labelId) || 0

      const newTrace = rerouteCollidingTrace(
        currentTraceState,
        overlap.label,
        this.problem,
        this.PADDING_BUFFER,
        detourCount,
      )

      if (newTrace.tracePath !== currentTraceState.tracePath) {
        this.detourCountByLabel.set(labelId, detourCount + 1)
      }

      updatedTracesMap.set(currentTraceState.mspPairId, newTrace)
      processedTraceIds.add(currentTraceState.mspPairId)
    }

    this.updatedTraces = Array.from(updatedTracesMap.values())

    const minimizedTraces = minimizeTurnsWithFilteredLabels(
      this.updatedTraces,
      this.problem,
      this.netTempLabelPlacements, // Use temp labels which include merged ones
      this.mergedLabelNetIdMap,
      this.PADDING_BUFFER,
    )
    if (minimizedTraces) {
      this.updatedTraces = minimizedTraces
    }

    const balancedTraces = balanceLShapes(
      this.updatedTraces,
      this.problem,
      this.netLabelPlacements,
    )
    if (balancedTraces) {
      this.updatedTraces = balancedTraces
    }

    this.solved = true
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.problem)

    if (!graphics.lines) graphics.lines = []
    if (!graphics.circles) graphics.circles = []
    if (!graphics.texts) graphics.texts = []
    if (!graphics.rects) graphics.rects = []

    for (const trace of Object.values(this.updatedTraces)) {
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
      })
      graphics.points!.push({
        x: p.anchorPoint.x,
        y: p.anchorPoint.y,
        color: getColorFromString(p.globalConnNetId, 0.9),
      })
    }

    return graphics
  }
}
