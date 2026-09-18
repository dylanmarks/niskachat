import path from "path";

/**
 * Sanitizes a file path to prevent directory traversal.
 * It resolves the path and ensures it's within the expected base directory.
 * @param {string} inputPath - The user-provided path.
 * @param {string} basePath - The base path the input path should be restricted to.
 * @returns {string|null} - The sanitized path or null if traversal is detected.
 */
export function sanitizePath(inputPath, basePath) {
  if (typeof inputPath !== "string") {
    return null;
  }

  // Explicitly reject directory traversal sequences, windows backslashes, and home directory shortcuts
  if (
    inputPath.includes("..") ||
    inputPath.includes("\\") ||
    inputPath.startsWith("~")
  ) {
    return null;
  }

  const normalizedBase = path.resolve(basePath);
  const resolvedPath = path.resolve(path.join(normalizedBase, inputPath));
  const basePrefix = normalizedBase.endsWith(path.sep)
    ? normalizedBase
    : normalizedBase + path.sep;

  if (resolvedPath === normalizedBase || resolvedPath.startsWith(basePrefix)) {
    return resolvedPath;
  }

  return null;
}
