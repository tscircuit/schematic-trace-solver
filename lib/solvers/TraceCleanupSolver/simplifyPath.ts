import type { Point } from "graphics-debug"

// 1. Fungsi Sakti (Taruh di luar agar rapi)
const isCollinear = (a: Point, b: Point, c: Point) => {
  const area = Math.abs(a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  return area < 0.01; 
}

// 2. Fungsi Utama
export const simplifyPath = (path: Point[]): Point[] => {
  if (path.length < 3) return path

  // Kita mulai dengan titik pertama
  const finalPath: Point[] = [path[0]]

  for (let i = 1; i < path.length - 1; i++) {
    const p1 = finalPath[finalPath.length - 1]
    const p2 = path[i]
    const p3 = path[i + 1]

    // Jika p1, p2, dan p3 lurus (collinear), p2 dilewati
    if (isCollinear(p1, p2, p3)) {
      continue
    }
    
    finalPath.push(p2)
  }

  // Masukkan titik terakhir
  finalPath.push(path[path.length - 1])
  
  return finalPath
}

