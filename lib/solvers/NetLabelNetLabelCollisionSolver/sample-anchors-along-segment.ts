const CANDIDATE_STEP = 0.1

export const sampleAnchorsAlongSegment = (
  a: { x: number; y: number },
  b: { x: number; y: number },
): Array<{ x: number; y: number }> => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.sqrt(dx * dx + dy * dy)
  const steps = Math.max(1, Math.round(len / CANDIDATE_STEP))
  const anchors: Array<{ x: number; y: number }> = []
  for (let k = 0; k <= steps; k++) {
    const t = k / steps
    anchors.push({ x: a.x + t * dx, y: a.y + t * dy })
  }
  return anchors
}
