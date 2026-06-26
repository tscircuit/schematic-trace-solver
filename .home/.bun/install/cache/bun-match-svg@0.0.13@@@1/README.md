# bun-match-svg

A custom matcher for Bun tests to compare SVG snapshots. Great for GitHub visual snapshot testing.

```ts
test("your SVG test", () => {
  const svgContent = generateSomeSvg() // Your function to generate SVG
  expect(svgContent).toMatchSvgSnapshot(import.meta.path, "uniqueName")
})
```

![Github Visual Snapshot](https://github.com/user-attachments/assets/35dd7ee1-3e30-4401-827d-469561885375)

## Quick Start

The fastest way to get started is to use the CLI to initialize your project:

```bash
bunx bun-match-svg init
```

This will:
1. Create an example test in `tests/svg.test.ts`
2. Set up automatic preloading by creating:
   - `tests/fixtures/preload.ts`
   - `bunfig.toml`

You can then run the example test:

```bash
bun test
```

## Installation

```bash
bun add -D bun-match-svg
```

## Usage

### Basic Usage

Import the library in your test file:

```ts
import "bun-match-svg"

test("your SVG test", () => {
  const svgContent = generateSomeSvg() // Your function to generate SVG
  expect(svgContent).toMatchSvgSnapshot(import.meta.path, "uniqueName")
})
```

The `toMatchSvgSnapshot` matcher takes two arguments:

1. `import.meta.path`: The path of the current test file.
2. `uniqueName` (optional): A unique name for the snapshot. If not provided, it will use the test file name.

### Automatically Preload

To make `toMatchSvgSnapshot` available in all your test files without importing it in each one:

1. Create a file `tests/fixtures/preload.ts` with the following content:

```ts
import "bun-match-svg"
```

2. Define a `bunfig.toml` file in your project root with:

```toml
[test]
preload = ["./tests/fixtures/preload.ts"]
```

Now `toMatchSvgSnapshot` will be automatically available in every test file.

## How It Works

- On first run, it creates a snapshot of your SVG.
- On subsequent runs, it compares the current SVG with the snapshot.
- If differences are found, it generates a diff image.

## Updating Snapshots

To update existing snapshots, run your tests with:

```bash
bun test --update-snapshots
```

Or set the environment variable:

```bash
BUN_UPDATE_SNAPSHOTS=1 bun test
```

## Configuration

The matcher uses `looks-same` for comparison with these default settings:

- `strict: false`
- `tolerance: 2`

There currently isn't a way to configure this, but PRs welcome!

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).
