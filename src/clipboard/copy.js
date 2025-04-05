const clipboardy = require('clipboardy');

/**
 * Copy content to clipboard
 * @param {string} content - Content to copy
 * @returns {Promise<void>}
 */
async function toClipboard(content) {
  try {
    await clipboardy.write(content);
    return true;
  } catch (error) {
    console.error('Error copying to clipboard:', error.message);
    throw error;
  }
}

module.exports = { toClipboard };
