const MERGE_THRESHOLD = 0.001

interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
  netId?: string
}

function mergeSegments(
  segments: Segment[],
  axis: "horizontal" | "vertical",
): Segment[] {
  if (segments.length === 0) return []

  const coordKey = axis === "horizontal" ? "y1" : "x1"
  const minKey = axis === "horizontal" ? "x1" : "y1"
  const maxKey = axis === "horizontal" ? "x2" : "y2"

  const grouped = new Map<number, Segment[]>()
  for (const seg of segments) {
    const coord = seg[coordKey]
    let found = false
    for (const [key, group] of grouped.entries()) {
      if (Math.abs(key - coord) <= MERGE_THRESHOLD) {
        group.push(seg)
        found = true
        break
      }
    }
    if (!found) grouped.set(coord, [seg])
  }

  const result: Segment[] = []
  for (const [coord, group] of grouped.entries()) {
    const sorted = [...group].sort((a, b) => a[minKey] - b[minKey])
    let curMin = sorted[0][minKey]
    let curMax = sorted[0][maxKey]
    const netId = sorted[0].netId

    for (let i = 1; i < sorted.length; i++) {
      const seg = sorted[i]
      if (seg[minKey] <= curMax + MERGE_THRESHOLD) {
        curMax = Math.max(curMax, seg[maxKey])
      } else {
        result.push(
          axis === "horizontal"
            ? { x1: curMin, y1: coord, x2: curMax, y2: coord, netId }
            : { x1: coord, y1: curMin, x2: coord, y2: curMax, netId },
        )
        curMin = seg[minKey]
        curMax = seg[maxKey]
      }
    }
    result.push(
      axis === "horizontal"
        ? { x1: curMin, y1: coord, x2: curMax, y2: coord, netId }
        : { x1: coord, y1: curMin, x2: coord, y2: curMax, netId },
    )
  }
  return result
}

export function mergeCollinearTraces(traces: Segment[]): Segment[] {
  const horizontal: Segment[] = []
  const vertical: Segment[] = []
  const diagonal: Segment[] = []

  for (const t of traces) {
    const norm: Segment = {
      x1: Math.min(t.x1, t.x2),
      y1: Math.min(t.y1, t.y2),
      x2: Math.max(t.x1, t.x2),
      y2: Math.max(t.y1, t.y2),
      netId: t.netId,
    }
    if (Math.abs(norm.y1 - norm.y2) <= MERGE_THRESHOLD) {
      horizontal.push({ ...norm, y2: norm.y1 })
    } else if (Math.abs(norm.x1 - norm.x2) <= MERGE_THRESHOLD) {
      vertical.push({ ...norm, x2: norm.x1 })
    } else {
      diagonal.push(t)
    }
  }

  return [
    ...mergeSegments(horizontal, "horizontal"),
    ...mergeSegments(vertical, "vertical"),
    ...diagonal,
  ]
}
