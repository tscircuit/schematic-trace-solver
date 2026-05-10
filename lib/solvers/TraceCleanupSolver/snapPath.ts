import type { Point } from "graphics-debug"

/**
 * Snaps points in a path to common X or Y coordinates if they are within a threshold.
 * This helps eliminate tiny "stair-step" jogs and ensures segments are perfectly orthogonal.
 */
export const snapPath = (path: Point[], threshold = 0.01): Point[] => {
  if (path.length < 2) return path
  
  const snappedPath: Point[] = [{ ...path[0] }]
  
  for (let i = 1; i < path.length; i++) {
    const prev = snappedPath[snappedPath.length - 1]
    const current = { ...path[i] }
    
    if (Math.abs(current.x - prev.x) < threshold) {
      current.x = prev.x
    }
    
    if (Math.abs(current.y - prev.y) < threshold) {
      current.y = prev.y
    }
    
    snappedPath.push(current)
  }
  
  return snappedPath
}
