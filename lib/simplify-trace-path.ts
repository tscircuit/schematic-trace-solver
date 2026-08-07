/**
 * ⚡ tscircuit/schematic-trace-solver Issue #235 Fix — Autorouting Path Simplification
 * Reward: $300.00 USD (Algora Bounty)
 * Developer: Samarth Nimangre (@Samarth1306w)
 */

export interface Point {
    x: number;
    y: number;
}

export class TracePathSimplifier {
    public static simplifyPath(points: Point[], epsilon: number = 0.5): Point[] {
        if (points.length <= 2) return points;

        let maxDistance = 0;
        let index = 0;
        const end = points.length - 1;

        for (let i = 1; i < end; i++) {
            const distance = this.perpendicularDistance(points[i], points[0], points[end]);
            if (distance > maxDistance) {
                index = i;
                maxDistance = distance;
            }
        }

        if (maxDistance > epsilon) {
            const recursiveResult1 = this.simplifyPath(points.slice(0, index + 1), epsilon);
            const recursiveResult2 = this.simplifyPath(points.slice(index), epsilon);

            return recursiveResult1.slice(0, recursiveResult1.length - 1).concat(recursiveResult2);
        } else {
            return [points[0], points[end]];
        }
    }

    private static perpendicularDistance(pt: Point, p1: Point, p2: Point): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        if (dx === 0 && dy === 0) {
            return Math.hypot(pt.x - p1.x, pt.y - p1.y);
        }

        const numerator = Math.abs(dy * pt.x - dx * pt.y + p2.x * p1.y - p2.y * p1.x);
        const denominator = Math.hypot(dx, dy);

        return numerator / denominator;
    }
}
