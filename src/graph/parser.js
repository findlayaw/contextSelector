/**
 * Code parser module for extracting code structure
 * Uses enhanced regex patterns for better code analysis
 */
const codeParser = require('./codeParser');

/**
 * Parse a file and extract its structure
 * @param {string} filePath - Path to the file
 * @returns {Object} - Parsed file structure
 */
function parseFile(filePath) {
  return codeParser.parseFile(filePath);
}

module.exports = {
  parseFile
};
