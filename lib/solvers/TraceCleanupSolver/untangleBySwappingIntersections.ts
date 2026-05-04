import type { Point } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

interface Intersection {
  point: Point
  segmentAIndex: number
  segmentBIndex: number
}

function isPointClose(p1: Point, p2: Point): boolean {
  return Math.abs(p1.x - p2.x) < 1e-6 && Math.abs(p1.y - p2.y) < 1e-6
}

function getIntersections(pathA: Point[], pathB: Point[]): Intersection[] {
  const intersections: Intersection[] = []
  for (let i = 0; i < pathA.length - 1; i++) {
    for (let j = 0; j < pathB.length - 1; j++) {
      const p1 = pathA[i]
      const p2 = pathA[i + 1]
      const o1 = pathB[j]
      const o2 = pathB[j + 1]
      
      const intersect = getSegmentIntersection(p1, p2, o1, o2)
      if (intersect) {
        // IGNORE intersections at endpoints to prevent infinite swapping back and forth
        // If it touches at an endpoint, it's "untangled" enough.
        if (isPointClose(intersect, p1) || isPointClose(intersect, p2) || 
            isPointClose(intersect, o1) || isPointClose(intersect, o2)) {
          continue
        }

        if (intersections.some(int => isPointClose(int.point, intersect))) {
          continue
        }
        intersections.push({
          point: intersect,
          segmentAIndex: i,
          segmentBIndex: j
        })
      }
    }
  }
  return intersections
}

function getSubPath(path: Point[], startInt: Intersection, endInt: Intersection, isPathA: boolean): Point[] {
  const startIdx = isPathA ? startInt.segmentAIndex : startInt.segmentBIndex
  const endIdx = isPathA ? endInt.segmentAIndex : endInt.segmentBIndex
  
  const result: Point[] = [startInt.point]
  
  if (startIdx < endIdx) {
    for (let k = startIdx + 1; k <= endIdx; k++) {
      result.push(path[k])
    }
  } else if (startIdx > endIdx) {
    for (let k = startIdx; k > endIdx; k--) {
      result.push(path[k])
    }
  }
  
  result.push(endInt.point)
  return result
}

function deduplicatePoints(path: Point[]): Point[] {
  return path.filter((p, i, arr) => {
    if (i === 0) return true
    return !isPointClose(p, arr[i - 1])
  })
}

export function untangleBySwappingIntersections(traces: SolvedTracePath[]): SolvedTracePath[] {
  let currentTraces = [...traces]
  let globalChanged = true
  let iterations = 0

  while (globalChanged && iterations < 20) {
    globalChanged = false
    iterations++
    
    let foundPair = false
    for (let i = 0; i < currentTraces.length; i++) {
      for (let j = i + 1; j < currentTraces.length; j++) {
        const pathA = currentTraces[i].tracePath
        const pathB = currentTraces[j].tracePath
        const intersections = getIntersections(pathA, pathB)
        
        if (intersections.length >= 2) {
          intersections.sort((a, b) => a.segmentAIndex - b.segmentAIndex)
          
          const int1 = intersections[0]
          const int2 = intersections[intersections.length - 1]

          const subPathForA = getSubPath(pathB, int1, int2, false)
          const finalPathA = deduplicatePoints([
            ...pathA.slice(0, int1.segmentAIndex + 1),
            ...subPathForA,
            ...pathA.slice(int2.segmentAIndex + 1)
          ])

          const sortedOnB = [...intersections].sort((a, b) => a.segmentBIndex - b.segmentBIndex)
          const bIntStart = sortedOnB[0]
          const bIntEnd = sortedOnB[sortedOnB.length - 1]

          const finalPathB = deduplicatePoints([
            ...pathB.slice(0, bIntStart.segmentBIndex + 1),
            ...getSubPath(pathA, bIntStart, bIntEnd, true),
            ...pathB.slice(bIntEnd.segmentBIndex + 1)
          ])

          currentTraces[i] = { ...currentTraces[i], mspPairId: currentTraces[i].mspPairId, tracePath: finalPathA }
          currentTraces[j] = { ...currentTraces[j], mspPairId: currentTraces[j].mspPairId, tracePath: finalPathB }
          
          globalChanged = true
          foundPair = true
          break
        }
      }
      if (foundPair) break
    }
  }
  
  return currentTraces
}
