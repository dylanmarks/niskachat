import path from "path";

/**
 * Sanitizes a file path to prevent directory traversal.
 * It resolves the path and ensures it's within the expected base directory.
 * @param {string} inputPath - The user-provided path.
 * @param {string} basePath - The base path the input path should be restricted to.
 * @returns {string|null} - The sanitized path or null if traversal is detected.
 */
export function sanitizePath(inputPath, basePath) {
  const resolvedPath = path.resolve(path.join(basePath, inputPath));

  if (resolvedPath.startsWith(basePath)) {
    return resolvedPath;
  }

  return null;
}
