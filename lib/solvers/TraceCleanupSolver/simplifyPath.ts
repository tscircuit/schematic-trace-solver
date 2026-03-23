import type { Point } from "graphics-debug"

const isCollinear = (a: Point, b: Point, c: Point) => {
  const area = Math.abs(a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  return area < 0.01; 
}

export const simplifyPath = (path: Point[]): Point[] => {
  if (path.length < 3) return path

  const finalPath: Point[] = [path[0]]

  for (let i = 1; i < path.length - 1; i++) {
    const p1 = finalPath[finalPath.length - 1]
    const p2 = path[i]
    const p3 = path[i + 1]

    if (isCollinear(p1, p2, p3)) {
      continue
    }
    
    finalPath.push(p2)
  }

  finalPath.push(path[path.length - 1])
  
  return finalPath
}

