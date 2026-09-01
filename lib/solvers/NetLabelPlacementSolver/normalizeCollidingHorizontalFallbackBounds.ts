import type { InputNetConnection, InputProblem } from "lib/types/InputProblem"
import { boundsOverlap } from "lib/utils/textBoxBounds"
import type { NetLabelPlacement } from "./NetLabelPlacementSolver"
import {
  getCenterFromAnchor,
  getDimsForOrientation,
  getRectBounds,
} from "./SingleNetLabelPlacementSolver/geometry"

const getRenderedHorizontalFallbackPlacement = (params: {
  inputProblem: InputProblem
  netLabelPlacement: NetLabelPlacement
}): NetLabelPlacement | null => {
  const { inputProblem, netLabelPlacement } = params
  if (netLabelPlacement.mspConnectionPairIds.length > 0) return null
  if (
    netLabelPlacement.orientation !== "x+" &&
    netLabelPlacement.orientation !== "x-"
  ) {
    return null
  }

  const effectiveNetId =
    netLabelPlacement.netId ?? netLabelPlacement.globalConnNetId
  const requestedOrientations =
    inputProblem.availableNetLabelOrientations[effectiveNetId] ?? []
  if (
    requestedOrientations.length === 0 ||
    requestedOrientations.some(
      (orientation) => orientation !== "y+" && orientation !== "y-",
    )
  ) {
    return null
  }

  const netConnection = netLabelPlacement.netId
    ? inputProblem.netConnections.find(
        (connection) => connection.netId === netLabelPlacement.netId,
      )
    : inputProblem.netConnections.find((connection) =>
        connection.pinIds.some((pinId) =>
          netLabelPlacement.pinIds.includes(pinId),
        ),
      )
  const renderedHorizontalWidth = netConnection?.netLabelHeight
  if (
    renderedHorizontalWidth === undefined ||
    renderedHorizontalWidth <=
      netLabelPlacement.width + netLabelPlacement.height + 1e-9
  ) {
    return null
  }

  const { width, height } = getDimsForOrientation({
    orientation: netLabelPlacement.orientation,
    netLabelWidth: renderedHorizontalWidth,
    netLabelHeight: netLabelPlacement.height,
  })
  const previousBaseCenter = getCenterFromAnchor(
    netLabelPlacement.anchorPoint,
    netLabelPlacement.orientation,
    netLabelPlacement.width,
    netLabelPlacement.height,
  )
  const renderedBaseCenter = getCenterFromAnchor(
    netLabelPlacement.anchorPoint,
    netLabelPlacement.orientation,
    width,
    height,
  )

  return {
    ...netLabelPlacement,
    width,
    height,
    center: {
      x:
        renderedBaseCenter.x +
        netLabelPlacement.center.x -
        previousBaseCenter.x,
      y:
        renderedBaseCenter.y +
        netLabelPlacement.center.y -
        previousBaseCenter.y,
    },
  }
}

const getNetConnectionForPlacement = (
  inputProblem: InputProblem,
  netLabelPlacement: NetLabelPlacement,
): InputNetConnection | undefined =>
  netLabelPlacement.netId
    ? inputProblem.netConnections.find(
        (connection) => connection.netId === netLabelPlacement.netId,
      )
    : inputProblem.netConnections.find((connection) =>
        connection.pinIds.some((pinId) =>
          netLabelPlacement.pinIds.includes(pinId),
        ),
      )

/**
 * Corrects the bounds of horizontal fallbacks from vertical-only rails when
 * their rendered text would overlap a ground label. Ground rails are handled
 * specially downstream, so their collision checks need the rendered width.
 */
export const normalizeHorizontalFallbackBoundsCollidingWithGroundLabels =
  (params: {
    inputProblem: InputProblem
    netLabelPlacements: NetLabelPlacement[]
  }) => {
    const { inputProblem, netLabelPlacements } = params
    const renderedFallbackPlacements = netLabelPlacements.map(
      (netLabelPlacement) =>
        getRenderedHorizontalFallbackPlacement({
          inputProblem,
          netLabelPlacement,
        }),
    )

    return netLabelPlacements.map((netLabelPlacement, placementIndex) => {
      const renderedFallbackPlacement =
        renderedFallbackPlacements[placementIndex]
      if (!renderedFallbackPlacement) return netLabelPlacement

      const renderedBounds = getRectBounds(
        renderedFallbackPlacement.center,
        renderedFallbackPlacement.width,
        renderedFallbackPlacement.height,
      )
      const intersectsDifferentNetLabel = netLabelPlacements.some(
        (otherNetLabelPlacement, otherPlacementIndex) => {
          if (otherPlacementIndex === placementIndex) return false
          if (
            otherNetLabelPlacement.globalConnNetId ===
            netLabelPlacement.globalConnNetId
          ) {
            return false
          }
          if (
            getNetConnectionForPlacement(inputProblem, otherNetLabelPlacement)
              ?.isGround !== true
          ) {
            return false
          }

          const effectiveOtherPlacement =
            renderedFallbackPlacements[otherPlacementIndex] ??
            otherNetLabelPlacement
          return boundsOverlap(
            renderedBounds,
            getRectBounds(
              effectiveOtherPlacement.center,
              effectiveOtherPlacement.width,
              effectiveOtherPlacement.height,
            ),
          )
        },
      )

      return intersectsDifferentNetLabel
        ? renderedFallbackPlacement
        : netLabelPlacement
    })
  }
