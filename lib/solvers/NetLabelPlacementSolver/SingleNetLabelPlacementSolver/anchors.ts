export function anchorsForSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
  const step = 0.1
  const intervalCount = Math.max(1, Math.ceil(length / step))
  const anchors: Array<{ x: number; y: number }> = []

  for (let i = 0; i <= intervalCount; i++) {
    const t = i / intervalCount
    anchors.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    })
  }

  return anchors
}
