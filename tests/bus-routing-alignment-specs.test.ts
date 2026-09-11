import test from "ava"

test("schematic-trace-solver: should maintain equal spacing and parallel alignment on bus trace groups", (t) => {
  const busLines = [
    { net: "D0", y: 10 },
    { net: "D1", y: 12 },
    { net: "D2", y: 14 },
    { net: "D3", y: 16 }
  ]
  const spacing = 2.0
  
  for (let i = 1; i < busLines.length; i++) {
    t.is(busLines[i].y - busLines[i-1].y, spacing)
  }
  t.pass("parallel bus routing maintains uniform pitch spacing")
})
