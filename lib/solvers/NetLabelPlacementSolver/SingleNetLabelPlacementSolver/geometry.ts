import type { FacingDirection } from "lib/utils/dir"

export const NET_LABEL_HORIZONTAL_WIDTH = 0.45
export const NET_LABEL_HORIZONTAL_HEIGHT = 0.2

export function getDimsForOrientation(orientation: FacingDirection) {
  if (orientation === "y+" || orientation === "y-") {
    return {
      width: NET_LABEL_HORIZONTAL_HEIGHT,
      height: NET_LABEL_HORIZONTAL_WIDTH,
    }
  }
  return {
    width: NET_LABEL_HORIZONTAL_WIDTH,
    height: NET_LABEL_HORIZONTAL_HEIGHT,
  }
}

export function getCenterFromAnchor(
  anchor: { x: number; y: number },
  orientation: FacingDirection,
  width: number,
  height: number,
) {
  switch (orientation) {
    case "x+":
      return { x: anchor.x + width / 2, y: anchor.y }
    case "x-":
      return { x: anchor.x - width / 2, y: anchor.y }
    case "y+":
      return { x: anchor.x, y: anchor.y + height / 2 }
    case "y-":
      return { x: anchor.x, y: anchor.y - height / 2 }
  }
}

export function getRectBounds(
  center: { x: number; y: number },
  w: number,
  h: number,
) {
  return {
    minX: center.x - w / 2,
    minY: center.y - h / 2,
    maxX: center.x + w / 2,
    maxY: center.y + h / 2,
  }
}
