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
 * @param {boolean} includeContents - Current content inclusion setting for CodeMaps
 * @returns {Object} - Next format and content inclusion setting
 */
function getNextOutput(currentFormat, currentMode, includeContents) {
  const modeHandler = require('./modeHandler');
  
  // For CodeMaps mode, we have a special cycle:
  // disabled -> markdown -> xml -> disabled
  if (currentMode === modeHandler.MODES.CODEMAPS) {
    if (!includeContents) {
      // If contents are disabled, enable them and use markdown
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
      // If XML with contents, disable contents
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
 * @param {boolean} includeContents - Whether file contents are included (for CodeMaps)
 * @param {string} currentMode - Current application mode
 * @returns {string} - Human-readable output format name
 */
function getOutputName(format, includeContents, currentMode) {
  const modeHandler = require('./modeHandler');
  
  if (currentMode === modeHandler.MODES.CODEMAPS && !includeContents) {
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
