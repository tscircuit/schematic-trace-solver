import type { GraphicsObject } from "graphics-debug"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

interface VisualizeDecompositionParams {
  decomposedChildLabels: NetLabelPlacement[]
  collidingTrace: SolvedTracePath
  mergedLabel: NetLabelPlacement
  graphics: GraphicsObject
}

/**
 * Visualizes the decomposition of a merged label during overlap avoidance.
 * It draws individual child labels with distinct colors based on their relation
 * to the colliding trace and adds a textual report to the graphics.
 *
 * @param {VisualizeDecompositionParams} params - The parameters for visualization.
 * @param {NetLabelPlacement[]} params.decomposedChildLabels - The individual labels that make up the merged group.
 * @param {SolvedTracePath} params.collidingTrace - The trace that is currently colliding with the merged label.
 * @param {NetLabelPlacement} params.mergedLabel - The original merged label that is being decomposed.
 * @param {GraphicsObject} params.graphics - The graphics object to which the visualization elements will be added.
 * @returns {GraphicsObject} The modified graphics object with decomposition visualization elements.
 */
export const visualizeDecomposition = (
  params: VisualizeDecompositionParams,
): GraphicsObject => {
  const { decomposedChildLabels, collidingTrace, mergedLabel, graphics } =
    params

  if (!graphics.rects) graphics.rects = []
  if (!graphics.texts) graphics.texts = []

  for (const childLabel of decomposedChildLabels) {
    const isOwnLabel =
      childLabel.globalConnNetId === collidingTrace.globalConnNetId

    graphics.rects.push({
      center: childLabel.center,
      width: childLabel.width,
      height: childLabel.height,
      fill: isOwnLabel ? "green" : "red", // Green for own label, red for others
    })
  }

  graphics.texts.push({
    x: mergedLabel.center.x,
    y: mergedLabel.center.y + mergedLabel.height / 2 + 0.5,
    text: `DECOMPOSITION: Trace ${collidingTrace.mspPairId} vs Merged Label ${mergedLabel.globalConnNetId}`,
    fontSize: 0.3,
    color: "blue",
  })

  return graphics
}
