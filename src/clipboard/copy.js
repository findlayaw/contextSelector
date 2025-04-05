const clipboardy = require('clipboardy');

/**
 * Copy content to clipboard
 * @param {string} content - Content to copy
 * @returns {Promise<void>}
 */
async function toClipboard(content) {
  try {
    // In clipboardy v3.0.0, the API changed from write() to writeSync()
    if (typeof clipboardy.writeSync === 'function') {
      clipboardy.writeSync(content);
    } else if (typeof clipboardy.write === 'function') {
      await clipboardy.write(content);
    } else {
      throw new Error('No clipboard write method available');
    }
    return true;
  } catch (error) {
    console.error('Error copying to clipboard:', error.message);
    throw error;
  }
}

module.exports = { toClipboard };
