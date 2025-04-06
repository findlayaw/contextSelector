/**
 * Mode handler for switching between different application modes
 */

// Define available modes
const MODES = {
  STANDARD: 'standard',
  GRAPH: 'graph',
  CODEMAPS: 'codemaps'
  // Add more modes here in the future
};

/**
 * Get the next mode in the cycle
 * @param {string} currentMode - Current application mode
 * @returns {string} - Next mode in the cycle
 */
function getNextMode(currentMode) {
  // Get all mode values as an array
  const modeValues = Object.values(MODES);

  // Find the index of the current mode
  const currentIndex = modeValues.indexOf(currentMode);

  // Get the next mode in the cycle (or the first if we're at the end)
  const nextIndex = (currentIndex + 1) % modeValues.length;

  return modeValues[nextIndex];
}

/**
 * Get a human-readable name for a mode
 * @param {string} mode - Mode identifier
 * @returns {string} - Human-readable mode name
 */
function getModeName(mode) {
  switch (mode) {
    case MODES.STANDARD:
      return 'Standard';
    case MODES.GRAPH:
      return 'Graph Analysis';
    case MODES.CODEMAPS:
      return 'Code Maps';
    default:
      return 'Unknown';
  }
}

module.exports = {
  MODES,
  getNextMode,
  getModeName
};
