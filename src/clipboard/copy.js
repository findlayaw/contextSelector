const clipboardy = require('clipboardy');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

/**
 * Copy content to clipboard
 * @param {string} content - Content to copy
 * @returns {Promise<void>}
 */
async function toClipboard(content) {
  try {
    // First try using clipboardy
    try {
      // In clipboardy v3.0.0, the API changed from write() to writeSync()
      if (typeof clipboardy.writeSync === 'function') {
        clipboardy.writeSync(content);
        return true;
      } else if (typeof clipboardy.write === 'function') {
        await clipboardy.write(content);
        return true;
      }
    } catch (clipboardyError) {
      console.log('Clipboardy failed, trying alternative method...');
    }

    // If clipboardy fails, try using PowerShell on Windows
    if (process.platform === 'win32') {
      return new Promise((resolve, reject) => {
        // Create a temporary file
        const tempFile = path.join(process.cwd(), 'temp_clipboard.txt');
        fs.writeFileSync(tempFile, content, 'utf8');

        // Use PowerShell to read the file and set clipboard
        const command = `powershell -command "Get-Content -Path '${tempFile}' -Raw | Set-Clipboard"`;

        exec(command, (error) => {
          // Clean up the temporary file
          try {
            fs.unlinkSync(tempFile);
          } catch (unlinkError) {
            console.error('Error removing temp file:', unlinkError.message);
          }

          if (error) {
            console.error('PowerShell clipboard error:', error.message);
            reject(error);
          } else {
            console.log('Content copied to clipboard using PowerShell');
            resolve(true);
          }
        });
      });
    } else {
      throw new Error('No clipboard write method available');
    }
  } catch (error) {
    console.error('Error copying to clipboard:', error.message);
    throw error;
  }
}

module.exports = { toClipboard };
