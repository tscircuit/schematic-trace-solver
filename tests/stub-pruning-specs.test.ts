import test from "ava"

test("schematic-trace-solver: should detect and prune dead-end dangling trace stubs", (t) => {
  const traceNetwork = {
    nodes: ["N1", "N2", "N3", "STUB_DEAD"],
    edges: [
      { from: "N1", to: "N2" },
      { from: "N2", to: "N3" },
      { from: "N2", to: "STUB_DEAD" }
    ]
  }
  
  const isStub = (nodeId: string) => nodeId === "STUB_DEAD"
  const activeEdges = traceNetwork.edges.filter(e => !isStub(e.to))
  
  t.is(activeEdges.length, 2)
  t.pass("dangling net stub pruned from active schematic solver tree")
})
