export function mergeSameNetCollinear(segments: Array<{ netId: string; x1: number; y1: number; x2: number; y2: number }>, epsilon = 0.05) {
  return segments.filter((s, idx, arr) => !arr.slice(0, idx).some(prev => prev.netId === s.netId && Math.abs(prev.y1 - s.y1) < epsilon && Math.abs(prev.y2 - s.y2) < epsilon));
}
