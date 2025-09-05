import type { InputChip, InputPin } from "lib/types/InputProblem"

function crossesChip(
  chip: InputChip | undefined,
  pin: InputPin & { _facingDirection?: string },
  other: InputPin,
): boolean {
  const f = (pin as any)._facingDirection as string | undefined
  if (!chip || !f) return false
  const { center, width, height } = chip
  const left = center.x - width / 2
  const right = center.x + width / 2
  const top = center.y + height / 2
  const bottom = center.y - height / 2
  switch (f) {
    case "x-":
      return other.x >= right
    case "x+":
      return other.x <= left
    case "y-":
      return other.y >= top
    case "y+":
      return other.y <= bottom
  }
  return false
}

export function checkIfMspPairCanConnectDirectly(
  chipMap: Record<string, InputChip>,
  p1: InputPin & { chipId: string; _facingDirection?: string },
  p2: InputPin & { chipId: string; _facingDirection?: string },
): boolean {
  if (crossesChip(chipMap[p1.chipId], p1, p2)) return false
  if (crossesChip(chipMap[p2.chipId], p2, p1)) return false
  return true
}
