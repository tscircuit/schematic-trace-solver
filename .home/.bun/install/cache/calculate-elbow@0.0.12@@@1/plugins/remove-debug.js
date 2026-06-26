/**
 * tsdown plugin to remove globalThis.__DEBUG_CALCULATE_ELBOW_CASE assignments
 */
export default function removeDebugPlugin() {
  return {
    name: "remove-debug",
    transform(code, id) {
      if (id.endsWith(".ts") || id.endsWith(".js")) {
        // Remove lines that assign to globalThis.__DEBUG_CALCULATE_ELBOW_CASE
        const cleanedCode = code
          .split("\n")
          .filter(
            (line) =>
              !line
                .trim()
                .match(
                  /globalThis\.__DEBUG_CALCULATE_ELBOW_CASE\s*=\s*\d+(\.\d+)?/,
                ),
          )
          .join("\n")

        if (cleanedCode !== code) {
          return cleanedCode
        }
      }
      return null
    },
  }
}
