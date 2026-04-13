import { mergeCollinearTraces } from "../utils/mergeCollinearTraces"

interface Point { x: number; y: number }
interface TracePath { points: Point[]; globalConnNetId?: string; [key: string]: any }

export class SameNetTraceMergeSolver {
  inputTraces:  TracePath[]
  outputTraces: TracePath[] = []
  solved = false

  constructor({ traces }: { traces: TracePath[] }) {
    this.inputTraces = traces
  }

  solve() {
    const byNet = new Map<string, TracePath[]>()
    const noNet: TracePath[] = []

    for (const trace of this.inputTraces) {
      const netId = trace.globalConnNetId
      if (!netId) { noNet.push(trace); continue }
      if (!byNet.has(netId)) byNet.set(netId, [])
      byNet.get(netId)!.push(trace)
    }

    const merged: TracePath[] = []

    for (const [netId, netTraces] of byNet.entries()) {
      const segments = netTraces.flatMap((trace) => {
        const pts = trace.points ?? []
        const lines = []
        for (let i = 0; i < pts.length - 1; i++) {
          lines.push({
            x1: pts[i].x,   y1: pts[i].y,
            x2: pts[i+1].x, y2: pts[i+1].y,
            netId,
          })
        }
        return lines
      })

      const mergedSegs = mergeCollinearTraces(segments)
      const proto = netTraces[0]
      for (const seg of mergedSegs) {
        merged.push({
          ...proto,
          globalConnNetId: netId,
          points: [
            { x: seg.x1, y: seg.y1 },
            { x: seg.x2, y: seg.y2 },
          ],
        })
      }
    }

    this.outputTraces = [...merged, ...noNet]
    this.solved = true
  }
}
