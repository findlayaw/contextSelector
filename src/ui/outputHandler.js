/**
 * Output handler for switching between different output formats
 */

// Define available output formats
const OUTPUT_FORMATS = {
  MARKDOWN: 'markdown',
  XML: 'xml'
};

// Define available content options for CodeMaps mode
const CODEMAPS_CONTENT_OPTIONS = {
  DISABLED: 'disabled',
  ENABLED: 'enabled'
};

/**
 * Get the next output format in the cycle
 * @param {string} currentFormat - Current output format
 * @param {string} currentMode - Current application mode
 * @param {boolean} includeContents - Current content inclusion setting for CodeMaps/Graph Mode
 * @returns {Object} - Next format and content inclusion setting
 */
function getNextOutput(currentFormat, currentMode, includeContents) {
  const modeHandler = require('./modeHandler');

  // For CodeMaps, Graph, and Combined modes, we have a special cycle:
  // structure-only -> markdown -> xml -> structure-only
  if (currentMode === modeHandler.MODES.CODEMAPS || currentMode === modeHandler.MODES.GRAPH || currentMode === modeHandler.MODES.COMBINED) {
    if (!includeContents) {
      // If contents are disabled (structure-only), enable them and use markdown
      return {
        format: OUTPUT_FORMATS.MARKDOWN,
        includeContents: true
      };
    } else if (currentFormat === OUTPUT_FORMATS.MARKDOWN) {
      // If markdown with contents, switch to XML with contents
      return {
        format: OUTPUT_FORMATS.XML,
        includeContents: true
      };
    } else {
      // If XML with contents, disable contents (structure-only)
      return {
        format: OUTPUT_FORMATS.MARKDOWN,
        includeContents: false
      };
    }
  } else {
    // For other modes, just toggle between markdown and XML
    return {
      format: currentFormat === OUTPUT_FORMATS.MARKDOWN ? OUTPUT_FORMATS.XML : OUTPUT_FORMATS.MARKDOWN,
      includeContents: includeContents
    };
  }
}

/**
 * Get a human-readable name for an output format
 * @param {string} format - Output format identifier
 * @param {boolean} includeContents - Whether file contents are included (for CodeMaps/Graph Mode)
 * @param {string} currentMode - Current application mode
 * @returns {string} - Human-readable output format name
 */
function getOutputName(format, includeContents, currentMode) {
  const modeHandler = require('./modeHandler');

  // Structure-only mode for CodeMaps, Graph Mode, and Combined Mode
  if ((currentMode === modeHandler.MODES.CODEMAPS || currentMode === modeHandler.MODES.GRAPH || currentMode === modeHandler.MODES.COMBINED) && !includeContents) {
    return 'Structure Only';
  } else if (format === OUTPUT_FORMATS.MARKDOWN) {
    return 'Markdown';
  } else if (format === OUTPUT_FORMATS.XML) {
    return 'XML';
  } else {
    return 'Unknown';
  }
}

module.exports = {
  OUTPUT_FORMATS,
  CODEMAPS_CONTENT_OPTIONS,
  getNextOutput,
  getOutputName
};
