import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"

/**
 * Simple Union-Find data structure for graph contraction
 */
class UnionFind {
  private parent: Map<string, string> = new Map()
  private rank: Map<string, number> = new Map()

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x)
      this.rank.set(x, 0)
      return x
    }
    const p = this.parent.get(x)!
    if (p !== x) {
      this.parent.set(x, this.find(p))
    }
    return this.parent.get(x)!
  }

  union(x: string, y: string): void {
    const rootX = this.find(x)
    const rootY = this.find(y)
    if (rootX === rootY) return

    const rankX = this.rank.get(rootX) ?? 0
    const rankY = this.rank.get(rootY) ?? 0

    if (rankX < rankY) {
      this.parent.set(rootX, rootY)
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX)
    } else {
      this.parent.set(rootY, rootX)
      this.rank.set(rootX, rankX + 1)
    }
  }
}

interface Point {
  x: number
  y: number
}

interface GraphNode {
  id: string
  point: Point
  isPinEndpoint: boolean
  pinId?: string
}

interface GraphEdge {
  from: string
  to: string
  netId: string
}

export interface CombineSameNetTraceSegmentsPhaseParams {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  mergeThreshold?: number
}

/**
 * Graph-based trace consolidation phase that combines same-net trace segments
 * that are close together using spatial clustering and graph contraction.
 *
 * Algorithm:
 * 1. Build a graph from trace segments - nodes are points, edges are segments
 * 2. Spatial clustering using distance threshold to find mergeable nodes
 * 3. Graph contraction using union-find to merge equivalent nodes
 * 4. Edge deduplication to remove redundant parallel edges
 * 5. Path reconstruction to generate minimal SolvedTracePath objects
 */
export class CombineSameNetTraceSegmentsPhase extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[] = []
  mergeThreshold: number

  constructor(params: CombineSameNetTraceSegmentsPhaseParams) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.traces
    this.mergeThreshold = params.mergeThreshold ?? 0.1
  }

  override getConstructorParams(): CombineSameNetTraceSegmentsPhaseParams {
    return {
      inputProblem: this.inputProblem,
      traces: this.inputTraces,
      mergeThreshold: this.mergeThreshold,
    }
  }

  private pointToKey(p: Point): string {
    return `${p.x.toFixed(6)},${p.y.toFixed(6)}`
  }

  private distance(p1: Point, p2: Point): number {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
  }

  /**
   * Build graph from traces, grouping by net
   */
  private buildGraphByNet(): Map<
    string,
    { nodes: Map<string, GraphNode>; edges: GraphEdge[] }
  > {
    const netGraphs = new Map<
      string,
      { nodes: Map<string, GraphNode>; edges: GraphEdge[] }
    >()

    for (const trace of this.inputTraces) {
      const netId = trace.globalConnNetId
      if (!netGraphs.has(netId)) {
        netGraphs.set(netId, { nodes: new Map(), edges: [] })
      }
      const graph = netGraphs.get(netId)!

      // Add nodes and edges from this trace
      for (let i = 0; i < trace.tracePath.length; i++) {
        const point = trace.tracePath[i]
        const key = this.pointToKey(point)

        if (!graph.nodes.has(key)) {
          const isPinEndpoint = i === 0 || i === trace.tracePath.length - 1
          graph.nodes.set(key, {
            id: key,
            point: { x: point.x, y: point.y },
            isPinEndpoint,
            pinId: isPinEndpoint ? trace.pinIds[i === 0 ? 0 : 1] : undefined,
          })
        }

        // Add edge to next point
        if (i < trace.tracePath.length - 1) {
          const nextPoint = trace.tracePath[i + 1]
          const nextKey = this.pointToKey(nextPoint)
          graph.edges.push({
            from: key,
            to: nextKey,
            netId,
          })
        }
      }
    }

    return netGraphs
  }

  /**
   * Perform spatial clustering and merge close nodes using union-find
   */
  private clusterAndMergeNodes(
    nodes: Map<string, GraphNode>,
    threshold: number,
  ): Map<string, string> {
    const uf = new UnionFind()
    const nodeList = Array.from(nodes.values())

    // Initialize all nodes in union-find
    for (const node of nodeList) {
      uf.find(node.id)
    }

    // Find pairs of nodes within threshold distance
    for (let i = 0; i < nodeList.length; i++) {
      for (let j = i + 1; j < nodeList.length; j++) {
        const n1 = nodeList[i]
        const n2 = nodeList[j]

        // Don't merge pin endpoints with other pin endpoints
        if (n1.isPinEndpoint && n2.isPinEndpoint) {
          continue
        }

        if (this.distance(n1.point, n2.point) <= threshold) {
          uf.union(n1.id, n2.id)
        }
      }
    }

    // Build mapping from old node ID to representative node ID
    const nodeMapping = new Map<string, string>()
    for (const node of nodeList) {
      nodeMapping.set(node.id, uf.find(node.id))
    }

    return nodeMapping
  }

  /**
   * Deduplicate edges after node merging
   */
  private deduplicateEdges(
    edges: GraphEdge[],
    nodeMapping: Map<string, string>,
  ): GraphEdge[] {
    const edgeSet = new Set<string>()
    const uniqueEdges: GraphEdge[] = []

    for (const edge of edges) {
      const from = nodeMapping.get(edge.from) ?? edge.from
      const to = nodeMapping.get(edge.to) ?? edge.to

      // Skip self-loops
      if (from === to) continue

      // Create canonical edge key (sorted to handle bidirectional)
      const edgeKey = from < to ? `${from}->${to}` : `${to}->${from}`

      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey)
        uniqueEdges.push({ from, to, netId: edge.netId })
      }
    }

    return uniqueEdges
  }

  /**
   * Get the representative point for a merged node cluster
   */
  private getRepresentativePoint(
    nodeId: string,
    nodes: Map<string, GraphNode>,
    nodeMapping: Map<string, string>,
  ): Point {
    // Find all nodes that map to this representative
    const clusterNodes: GraphNode[] = []
    for (const [originalId, repId] of nodeMapping.entries()) {
      if (repId === nodeId) {
        const node = nodes.get(originalId)
        if (node) clusterNodes.push(node)
      }
    }

    if (clusterNodes.length === 0) {
      // Fallback to the node itself
      const node = nodes.get(nodeId)
      return node ? node.point : { x: 0, y: 0 }
    }

    // Prefer pin endpoints
    const pinNode = clusterNodes.find((n) => n.isPinEndpoint)
    if (pinNode) return pinNode.point

    // Otherwise, use centroid
    const sumX = clusterNodes.reduce((sum, n) => sum + n.point.x, 0)
    const sumY = clusterNodes.reduce((sum, n) => sum + n.point.y, 0)
    return {
      x: sumX / clusterNodes.length,
      y: sumY / clusterNodes.length,
    }
  }

  /**
   * Reconstruct paths from the contracted graph
   */
  private reconstructPaths(
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[],
    nodeMapping: Map<string, string>,
    netId: string,
  ): SolvedTracePath[] {
    // Build adjacency list
    const adjacency = new Map<string, Set<string>>()
    for (const edge of edges) {
      const from = nodeMapping.get(edge.from) ?? edge.from
      const to = nodeMapping.get(edge.to) ?? edge.to

      if (!adjacency.has(from)) adjacency.set(from, new Set())
      if (!adjacency.has(to)) adjacency.set(to, new Set())
      adjacency.get(from)!.add(to)
      adjacency.get(to)!.add(from)
    }

    // Find all pin endpoints for this net
    const pinEndpoints: GraphNode[] = []
    for (const node of nodes.values()) {
      if (node.isPinEndpoint) {
        const repId = nodeMapping.get(node.id) ?? node.id
        // Check if this representative is in the graph
        if (adjacency.has(repId)) {
          pinEndpoints.push(node)
        }
      }
    }

    if (pinEndpoints.length < 2) {
      // Not enough endpoints to form a path
      return []
    }

    const paths: SolvedTracePath[] = []
    const visited = new Set<string>()

    // Create paths between pin endpoints using BFS
    for (let i = 0; i < pinEndpoints.length; i++) {
      for (let j = i + 1; j < pinEndpoints.length; j++) {
        const start = pinEndpoints[i]
        const end = pinEndpoints[j]
        const startRep = nodeMapping.get(start.id) ?? start.id
        const endRep = nodeMapping.get(end.id) ?? end.id

        // BFS to find path
        const path = this.findPath(startRep, endRep, adjacency, visited)
        if (path.length > 0) {
          const tracePath = path.map((nodeId) =>
            this.getRepresentativePoint(nodeId, nodes, nodeMapping),
          )

          paths.push({
            mspPairId: `${netId}_${i}_${j}`,
            dcConnNetId: netId,
            globalConnNetId: netId,
            pins: [
              {
                pinId: start.pinId!,
                x: start.point.x,
                y: start.point.y,
                chipId: "",
              },
              { pinId: end.pinId!, x: end.point.x, y: end.point.y, chipId: "" },
            ],
            tracePath,
            mspConnectionPairIds: [`${netId}_${i}_${j}`],
            pinIds: [start.pinId!, end.pinId!],
          })

          // Mark edges as visited
          for (let k = 0; k < path.length - 1; k++) {
            const edgeKey =
              path[k] < path[k + 1]
                ? `${path[k]}-${path[k + 1]}`
                : `${path[k + 1]}-${path[k]}`
            visited.add(edgeKey)
          }
        }
      }
    }

    return paths
  }

  /**
   * Find path between two nodes using BFS, avoiding visited edges
   */
  private findPath(
    start: string,
    end: string,
    adjacency: Map<string, Set<string>>,
    visitedEdges: Set<string>,
  ): string[] {
    const queue: { node: string; path: string[] }[] = [
      { node: start, path: [start] },
    ]
    const visited = new Set<string>([start])

    while (queue.length > 0) {
      const { node, path } = queue.shift()!

      if (node === end) {
        return path
      }

      const neighbors = adjacency.get(node) ?? new Set()
      for (const neighbor of neighbors) {
        const edgeKey =
          node < neighbor ? `${node}-${neighbor}` : `${neighbor}-${node}`

        if (!visited.has(neighbor) && !visitedEdges.has(edgeKey)) {
          visited.add(neighbor)
          queue.push({ node: neighbor, path: [...path, neighbor] })
        }
      }
    }

    return []
  }

  override _step(): void {
    // Build graph by net
    const netGraphs = this.buildGraphByNet()

    // Process each net independently
    for (const [netId, graph] of netGraphs.entries()) {
      // Cluster and merge nodes
      const nodeMapping = this.clusterAndMergeNodes(
        graph.nodes,
        this.mergeThreshold,
      )

      // Deduplicate edges
      const uniqueEdges = this.deduplicateEdges(graph.edges, nodeMapping)

      // Reconstruct paths
      const paths = this.reconstructPaths(
        graph.nodes,
        uniqueEdges,
        nodeMapping,
        netId,
      )
      this.outputTraces.push(...paths)
    }

    this.solved = true
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem)
    graphics.lines = graphics.lines || []
    graphics.circles = graphics.circles || []

    // Draw output traces
    for (const trace of this.outputTraces) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "green",
        strokeWidth: 0.02,
      })

      // Mark endpoints
      for (const point of [
        trace.tracePath[0],
        trace.tracePath[trace.tracePath.length - 1],
      ]) {
        graphics.circles.push({
          center: point,
          radius: 0.05,
          fill: "green",
        })
      }
    }

    return graphics
  }
}
