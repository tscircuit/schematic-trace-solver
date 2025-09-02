import type { InputPin, PinId } from "lib/types/InputProblem"

/**
 * Compute the Orthogonal (Manhattan/L1) Minimum Spanning Tree (MST)
 * for a set of points and return it as pairs of connected PinIds.
 *
 * The MST minimizes total |Δx| + |Δy| distance and fully connects all points.
 * Uses Prim's algorithm with O(n^2) time and O(n) extra space.
 *
 * Edge cases:
 * - []           -> []
 * - [one point]  -> []
 * - duplicate coordinates are allowed (0-length edges possible)
 *
 * Deterministic tie-breaking:
 * - When multiple candidates have the same distance, we pick the one
 *   whose pinId is lexicographically smallest (for stable output).
 */
export function getOrthogonalMinimumSpanningTree(
  pins: InputPin[],
  opts: {
    maxDistance?: number
    canConnect?: (a: InputPin, b: InputPin) => boolean
    } = {},
): Array<[PinId, PinId]> {
  const n = pins.length
  const maxDistance = opts?.maxDistance ?? Number.POSITIVE_INFINITY
  const canConnect = opts?.canConnect
  if (n <= 1) return []

  // Quick validation (optional; remove if hot path)
  // Ensure pinIds are unique to avoid ambiguous output edges.
  {
    const seen = new Set<string>()
    for (const p of pins) {
      if (seen.has(p.pinId)) {
        throw new Error(`Duplicate pinId detected: "${p.pinId}"`)
      }
      seen.add(p.pinId)
    }
  }

  // Helper: Manhattan distance
  const manhattan = (a: InputPin, b: InputPin) =>
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

  // Prim's data structures
  const inTree = new Array<boolean>(n).fill(false)
  const bestDist = new Array<number>(n).fill(Number.POSITIVE_INFINITY)
  const parent = new Array<number>(n).fill(-1)

  // Start from the point with lexicographically smallest pinId (stable)
  let startIndex = 0
  for (let i = 1; i < n; i++) {
    if (pins[i].pinId < pins[startIndex].pinId) startIndex = i
  }
  bestDist[startIndex] = 0

  const edges: Array<[PinId, PinId]> = []
  for (let iter = 0; iter < n; iter++) {
    // Pick the next vertex u with minimal bestDist[u] not yet in the tree
    let u = -1
    let best = Number.POSITIVE_INFINITY
    let bestId = "" // for tie-breaking
    for (let i = 0; i < n; i++) {
      if (!inTree[i]) {
        const d = bestDist[i]
        if (
          d < best ||
          (d === best && (bestId === "" || pins[i].pinId < bestId))
        ) {
          best = d
          bestId = pins[i].pinId
          u = i
        }
      }
    }

    // Add u to the tree
    inTree[u] = true
    if (parent[u] !== -1) {
      edges.push([pins[u].pinId, pins[parent[u]].pinId])
    }

    // Relax edges from u to all v not yet in the tree
    for (let v = 0; v < n; v++) {
      if (!inTree[v]) {
        const d0 = manhattan(pins[u], pins[v])
        const d =
          d0 > maxDistance || (canConnect && !canConnect(pins[u], pins[v]))
            ? Number.POSITIVE_INFINITY
            : d0
        if (
          d < bestDist[v] ||
          (d === bestDist[v] && pins[u].pinId < pins[parent[v]]?.pinId)
        ) {
          bestDist[v] = d
          parent[v] = u
        }
      }
    }
  }

  // edges.length === n-1 when n>0
  return edges
}
