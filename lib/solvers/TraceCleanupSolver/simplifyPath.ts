/**
 * Simplifies a path by removing redundant collinear points and filtering out
 * any undefined or invalid entries.
 */
export function simplifyPath(
  path: { x: number; y: number }[],
): { x: number; y: number }[] {
  // First, filter out any null/undefined entries
  const cleanPath = path.filter(
    (p): p is { x: number; y: number } =>
      p != null && typeof p.x === "number" && typeof p.y === "number",
  )

  if (cleanPath.length <= 2) return cleanPath

  const result: { x: number; y: number }[] = [cleanPath[0]]

  for (let i = 1; i < cleanPath.length - 1; i++) {
    const prev = result[result.length - 1]
    const curr = cleanPath[i]
    const next = cleanPath[i + 1]

    // Check if prev, curr, next are collinear
    const dx1 = curr.x - prev.x
    const dy1 = curr.y - prev.y
    const dx2 = next.x - curr.x
    const dy2 = next.y - curr.y

    // Cross product to check collinearity
    const cross = dx1 * dy2 - dy1 * dx2

    if (Math.abs(cross) > 1e-9) {
      // Not collinear, keep this point
      result.push(curr)
    }
  }

  result.push(cleanPath[cleanPath.length - 1])

  return result
}
