import type { InputProblem } from "lib/types/InputProblem"
import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"

/**
 * REPRO: CROSSING TRACES
 * 
 * This test reproduces a situation where two traces cross each other.
 * 
 * U1 (Left)              U2 (Right)
 * pin1 (y=1)  ---------> pin2 (y=-1)
 * pin2 (y=-1) ---------> pin1 (y=1)
 */
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: -2, y: 0 },
      width: 1,
      height: 3,
      pins: [
        { pinId: "U1.1", x: -1.5, y: 1 },
        { pinId: "U1.2", x: -1.5, y: -1 }
      ]
    },
    {
      chipId: "U2",
      center: { x: 2, y: 0 },
      width: 1,
      height: 3,
      pins: [
        { pinId: "U2.1", x: 1.5, y: 1 },
        { pinId: "U2.2", x: 1.5, y: -1 }
      ]
    }
  ],
  directConnections: [
    { pinIds: ["U1.1", "U2.2"], netId: "net1" },
    { pinIds: ["U1.2", "U2.1"], netId: "net2" }
  ],
  netConnections: []
}

test("Reproduction of crossing traces in schematic", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  
  const output = solver.getOutput()
  const traces = output.traces
  
  // Identify crossings
  let crossings = 0
  for (let i = 0; i < traces.length; i++) {
    for (let j = i + 1; j < traces.length; j++) {
      const pathA = traces[i].tracePath
      const pathB = traces[j].tracePath
      for (let sa = 0; sa < pathA.length - 1; sa++) {
        for (let sb = 0; sb < pathB.length - 1; sb++) {
          const p1 = pathA[sa]
          const p2 = pathA[sa+1]
          const o1 = pathB[sb]
          const o2 = pathB[sb+1]
          
          const aVert = Math.abs(p1.x - p2.x) < 1e-6
          const bHorz = Math.abs(o1.y - o2.y) < 1e-6
          
          if (aVert && bHorz) {
            const minX = Math.min(o1.x, o2.x)
            const maxX = Math.max(o1.x, o2.x)
            const minY = Math.min(p1.y, p2.y)
            const maxY = Math.max(p1.y, p2.y)
            if (p1.x > minX && p1.x < maxX && o1.y > minY && o1.y < maxY) {
              crossings++
            }
          }
          
          const aHorz = Math.abs(p1.y - p2.y) < 1e-6
          const bVert = Math.abs(o1.x - o2.x) < 1e-6
          
          if (aHorz && bVert) {
            const minX = Math.min(p1.x, p2.x)
            const maxX = Math.max(p1.x, p2.x)
            const minY = Math.min(o1.y, o2.y)
            const maxY = Math.max(o1.y, o2.y)
            if (o1.x > minX && o1.x < maxX && p1.y > minY && p1.y < maxY) {
              crossings++
            }
          }
        }
      }
    }
  }
  
  console.log(`Crossings detected: ${crossings}`)
  // The goal is to make this 0 or lower it.
  // expect(crossings).toBe(0)
})
