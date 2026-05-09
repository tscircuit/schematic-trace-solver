import { test, expect } from "bun:test"
import { getGeneratorForAllChipPairs } from "lib/solvers/GuidelinesSolver/getGeneratorForAllChipPairs"

test("getGeneratorForAllChipPairs returns generator", () => {
  const chips = [
    { chipId: "1", center: { x: 0, y: 0 }, width: 10, height: 10, pins: [] },
    { chipId: "2", center: { x: 20, y: 0 }, width: 10, height: 10, pins: [] },
  ] as any[]
  const generator = getGeneratorForAllChipPairs(chips)
  const pairs = [...generator]
  expect(pairs).toHaveLength(2) // 2 chips = 1 pair
})

test("getGeneratorForAllChipPairs returns empty for single chip", () => {
  const chips = [
    { chipId: "1", center: { x: 0, y: 0 }, width: 10, height: 10, pins: [] },
  ] as any[]
  const generator = getGeneratorForAllChipPairs(chips)
  const pairs = [...generator]
  expect(pairs).toHaveLength(0)
})
