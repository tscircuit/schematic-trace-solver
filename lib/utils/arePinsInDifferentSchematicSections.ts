import type { InputProblem, InputPin } from "lib/types/InputProblem"

const getSectionNameForPin = (
  sectionByChipId: Map<string, string>,
  sectionByPinId: Map<string, string>,
  pin: InputPin & { chipId?: string },
) => {
  if (pin.chipId) {
    const chipSection = sectionByChipId.get(pin.chipId)
    if (chipSection) return chipSection
  }

  return sectionByPinId.get(pin.pinId)
}

export const arePinsInDifferentSchematicSections = (
  inputProblem: InputProblem,
  p1: InputPin & { chipId?: string },
  p2: InputPin & { chipId?: string },
) => {
  const sectionByChipId = new Map<string, string>()
  const sectionByPinId = new Map<string, string>()

  for (const chip of inputProblem.chips) {
    if (!chip.sectionId) continue

    sectionByChipId.set(chip.chipId, chip.sectionId)
    for (const pin of chip.pins) {
      sectionByPinId.set(pin.pinId, chip.sectionId)
    }
  }

  if (sectionByChipId.size === 0) return false

  // Pins without an explicit section belong to an implicit "no-section"
  // section. Traces must not cross between sections, so a sectioned pin and an
  // unsectioned pin (or two differently-named sections) count as different.
  // `undefined !== undefined` is false, so two unsectioned pins compare equal.
  const s1 = getSectionNameForPin(sectionByChipId, sectionByPinId, p1)
  const s2 = getSectionNameForPin(sectionByChipId, sectionByPinId, p2)

  return s1 !== s2
}
