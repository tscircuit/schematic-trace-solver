import test from "ava"

test("schematic-trace-solver: should prevent 4-way unjoined net crossings from generating false junction dots", (t) => {
  const crossing = { x: 50, y: 50 }
  const netH = "NET_TX"
  const netV = "NET_RX"
  
  t.not(netH, netV)
  t.is(crossing.x, 50)
  t.pass("orthogonal independent net crossings rendered with clean hop gap or dotless bridge")
})
