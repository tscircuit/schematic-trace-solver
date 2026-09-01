export function anchorsForSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  // Start, midpoint, end
  return [
    { x: a.x, y: a.y },
    { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    { x: b.x, y: b.y },
  ]
}
