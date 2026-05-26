import type { Point } from "graphics-debug"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

// Do points ke beech ka distance calculate karne ke liye chota helper
const getDistance = (p1: Point, p2: Point): number => {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
}

export const simplifyPath = (path: Point[]): Point[] => {
  if (path.length < 2) return path

  // STEP 1: Pehle basic straight lines ko merge karo (Jo unka purana code kar raha tha)
  const simplified: Point[] = [path[0]]
  for (let i = 1; i < path.length - 1; i++) {
    const p1 = simplified[simplified.length - 1]
    const p2 = path[i]
    const p3 = path[i + 1]

    if (
      (isVertical(p1, p2) && isVertical(p2, p3)) ||
      (isHorizontal(p1, p2) && isHorizontal(p2, p3))
    ) {
      continue // Beech ka point hata do agar bilkul straight line hai
    }
    simplified.push(p2)
  }
  simplified.push(path[path.length - 1])

  // STEP 2: [ISSUE #34 FIX] Paas-paas chalne waali collinear/overlapping lines ko merge karna
  // Threshold (0.1 ya 0.5) set karte hain taaki bohot paas waali lines pakad mein aayein
  const THRESHOLD = 0.2 
  const finalPath: Point[] = [simplified[0]]

  for (let i = 1; i < simplified.length; i++) {
    const lastPoint = finalPath[finalPath.length - 1]
    const currentPoint = simplified[i]

    // Agar X-axis lagbhag same hai aur points bohot paas hain (Vertical alignment check)
    if (Math.abs(lastPoint.x - currentPoint.x) < THRESHOLD && Math.abs(lastPoint.y - currentPoint.y) > THRESHOLD) {
      // Dono ka X coordinate ek barabar (snap) kar do taaki trace ekdum seedhi ho jaye
      currentPoint.x = lastPoint.x
    }
    // Agar Y-axis lagbhag same hai (Horizontal alignment check)
    else if (Math.abs(lastPoint.y - currentPoint.y) < THRESHOLD && Math.abs(lastPoint.x - currentPoint.x) > THRESHOLD) {
      // Dono ka Y coordinate snap kar do
      currentPoint.y = lastPoint.y
    }

    // Agar dono points snap hone ke baad bilkul ek hi jagah par aa gaye hain, toh duplicate point mat add karo
    if (getDistance(lastPoint, currentPoint) < THRESHOLD) {
      continue
    }

    finalPath.push(currentPoint)
  }

  // STEP 3: Ek aakhri baar filter run karo taaki clean array mile
  const ultraCleanPath: Point[] = [finalPath[0]]
  for (let i = 1; i < finalPath.length - 1; i++) {
    const p1 = ultraCleanPath[ultraCleanPath.length - 1]
    const p2 = finalPath[i]
    const p3 = finalPath[i + 1]
    if (
      (isVertical(p1, p2) && isVertical(p2, p3)) ||
      (isHorizontal(p1, p2) && isHorizontal(p2, p3))
    ) {
      continue
    }
    ultraCleanPath.push(p2)
  }
  if (finalPath.length > 1) {
    ultraCleanPath.push(finalPath[finalPath.length - 1])
  }

  return ultraCleanPath
}