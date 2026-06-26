# graphics-debug

Module for debugging graphics, turn log output into meaningful markdown and SVG diagrams.

Just pipe in output with graphics JSON objects into `graphics-debug` (or `gd`) to get an html file
with all your graphics drawn-in.

```bash
echo ':graphics { points: [{x: 0, y: 0, label: "hello world" }], title: "test graphic" } }' | graphics-debug
# wrote to "test-graphic-1.debug.svg"
```

```bash
# Run a program that has debug logs and pipe the output to graphics-debug
bun test path/to/test.ts |& graphics-debug --html
# wrote to "graphics.debug.html"

# another syntax for the same thing
bun test path/to/test.ts 2>&1 | graphics-debug --html
```

Don't want to write files everywhere? Use the `--url` flag to get a url to view
the graphics in a browser.

```bash
node myscript.js |& graphics-debug --url
```

Don't have access to the cli? Paste into the online version: https://graphicsdebug.com

https://github.com/user-attachments/assets/9f3f41e6-b0fe-416a-a551-ba5c5b920cad

## Format

The `graphics` json object is very simple, here's the basic schema:

```typescript
interface Point {
  x: number
  y: number
  color?: string
  label?: string
  layer?: string
  step?: number
}

interface Line {
  points: { x: number; y: number }[]
  strokeWidth?: number
  strokeColor?: string
  strokeDash?: string
  layer?: string
  step?: number
  label?: string
}

interface Rect {
  center: { x: number; y: number }
  width: number
  height: number
  fill?: string
  stroke?: string
  color?: string
  layer?: string
  step?: number
  label?: string
}

interface Circle {
  center: { x: number; y: number }
  radius: number
  fill?: string
  stroke?: string
  layer?: string
  step?: number
  label?: string
}

interface GraphicsObject {
  points?: Point[]
  lines?: Line[]
  rects?: Rect[]
  circles?: Circle[]
  coordinateSystem?: "cartesian" | "screen"
  title?: string
}
```

## Library Usage

### Writing `graphics-debug` compatible logs

The best way to write `graphics-debug` compatible logs is to use the [`debug` library](https://www.npmjs.com/package/debug).

You should **always JSON.stringify graphics objects**, otherwise the graphics
will take up more lines and will not have the correct depth (there will be
missing information)

```tsx
import Debug from "debug"

const debugGraphics = Debug("mypackage:graphics")

const A = { x: 0, y: 0, label: "A" }
const B = { x: 1, y: 1, label: "B" }

debugGraphics(
  JSON.stringify({
    points: [A, B],
    title: "initial points for my algorithm",
  })
)

// ... do some algorithm stuff e.g....
const C = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, label: "C" }

debugGraphics(
  JSON.stringify({
    points: [A, B, C],
    title: "final points for my algorithm",
  })
)
```

To see the output, you'll need to run `DEBUG=mypackage:graphics` in your terminal
before running the program. This makes it easy to turn on/off the graphics output

You can also use `debugGraphics.enabled` to conditionally emit graphics based,
this is useful if it's expensive to compute the graphics object.

### Process Log Strings into HTML or SVGs

```tsx
import {
  getSvgFromLogString,
  getHtmlFromLogString,
  getSvgsFromLogString,
} from "graphics-debug"

const logString = `
hello world! This is some other content that will be ignored
here's some :graphics { points: [{x: 0, y: 0, label: "hello world" }], title: "test graphic" }
`

const svg = getSvgFromLogString(logString)
const html = getHtmlFromLogString(logString)

// If you want to parse for multiple SVGs
const svgs = getSvgsFromLogString(logString)
// Array<{ title: string; svg: string }>
```

### Extract `graphics` objects from a Debug Log

```tsx
import { getGraphicsObjectsFromLogString } from "graphics-debug"

const graphicsObjects = getGraphicsObjectsFromLogString(logString)
// Array<GraphicsObject>
```

### Generate SVG directly from a GraphicsObject

```tsx
import { getSvgFromGraphicsObject } from "graphics-debug"

// Create your graphics object
const graphicsObject = {
  points: [
    { x: 0, y: 0, label: "Origin" },
    { x: 100, y: 100, color: "red" },
  ],
  lines: [
    {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ],
      strokeColor: "blue",
    },
  ],
  title: "My Graph",
}

// Generate SVG string directly from the object
const svg = getSvgFromGraphicsObject(graphicsObject)
// Returns a formatted SVG string ready to be written to a file or embedded in HTML
```

### Translate a GraphicsObject

You can shift every element in a `GraphicsObject` by a fixed amount using `translateGraphics`.

```tsx
import { translateGraphics } from "graphics-debug"

const moved = translateGraphics(graphicsObject, 10, 5)
```

### Merge two GraphicsObjects

Combine the contents of two graphics objects into one using `mergeGraphics`.

```tsx
import { mergeGraphics } from "graphics-debug"

const combined = mergeGraphics(graphicsObjectA, graphicsObjectB)
```

### Stack GraphicsObjects

Use `stackGraphicsHorizontally` or `stackGraphicsVertically` to place graphics next to or above each other.

```tsx
import { stackGraphicsHorizontally, stackGraphicsVertically } from "graphics-debug"

const sideBySide = stackGraphicsHorizontally([
  graphicsObjectA,
  graphicsObjectB,
], { titles: ["A", "B"] })
const stacked = stackGraphicsVertically([
  graphicsObjectA,
  graphicsObjectB,
], { titles: ["A", "B"] })
```

### Testing GraphicsObjects with Bun's Test Framework

If you're using Bun for testing, you can use the `toMatchGraphicsSvg` matcher to compare graphics objects against saved snapshots.

First, install the required peer dependencies:

```bash
bun add -d bun-match-svg looksSame
```

Then use the matcher in your tests:

```tsx
import { expect, test } from "bun:test"
import "graphics-debug/matcher"
import type { GraphicsObject } from "graphics-debug"

// Your test graphics object
const graphicsObject: GraphicsObject = {
  points: [
    { x: 0, y: 0, label: "Origin" },
    { x: 100, y: 100, color: "red" },
  ],
  lines: [
    {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ],
      strokeColor: "blue",
    },
  ],
  title: "My Test Graphics",
}

test("should match the expected visualization", async () => {
  // First run creates the snapshot
  // Subsequent runs will compare against saved snapshot
  await expect(graphicsObject).toMatchGraphicsSvg(import.meta.path)

  // You can also provide a custom name for the snapshot:
  await expect(graphicsObject).toMatchGraphicsSvg(import.meta.path, {
    svgName: "custom-name",
  })
})
```

Snapshots are stored as SVG files in an `__snapshots__` directory next to your test file. To update snapshots, run your tests with the `-u` or `--update-snapshots` flag:

```bash
bun test -u
```

This is powered by the same technology as bun-match-svg but integrated specifically for GraphicsObject testing.

### Example Graphics JSON

An example graphics JSON file is provided in the repository to help you get started quickly.

You can find the example file at [`site/examples/exampleGraphics.json`](site/examples/exampleGraphics.json). This file contains a sample graphics object that you can use to test the functionality of the `graphics-debug` module.

Here is the content of the `exampleGraphics.json` file:

```JSON
{
  "title": "Example Usage",
  "rects": [
    {
      "center": { "x": 0, "y": 0 },
      "width": 100,
      "height": 100,
      "fill": "green"
    }
  ],
  "points": [
    {
      "x": 50,
      "y": 50,
      "color": "red",
      "label": "Test Output!"
    }
  ]
}
```

You can load this example into the application to visualize the graphics objects and understand how the `graphics-debug` module works.

### React Components

The package also includes React helpers under `graphics-debug/react`.
The `<InteractiveGraphics>` component renders an interactive viewer with
zoom, pan and layer/step filtering built in.

```tsx
import { InteractiveGraphics } from "graphics-debug/react"
import exampleGraphics from "./exampleGraphics.json"

export default function Demo() {
  return <InteractiveGraphics graphics={exampleGraphics} />
}
```

`InteractiveGraphics` accepts a `GraphicsObject` via the `graphics` prop.
You can optionally handle clicks on objects with `onObjectClicked` or
limit how many objects are drawn with `objectLimit`.

