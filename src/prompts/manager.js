const storage = require('./storage');

/**
 * Save a prompt
 * @param {string} name - Prompt name
 * @param {string} content - Prompt content
 * @returns {Promise<void>}
 */
async function savePrompt(name, content) {
  try {
    // Basic validation
    if (!name || !content) {
      throw new Error('Prompt name and content cannot be empty.');
    }

    // Sanitize name for filename
    const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!sanitizedName) {
      throw new Error('Invalid prompt name after sanitization.');
    }

    await storage.savePrompt(sanitizedName, content);
  } catch (error) {
    console.error('Error saving prompt:', error.message);
    throw error;
  }
}

/**
 * Load a prompt
 * @param {string} name - Prompt name
 * @returns {Promise<Object|null>} - Prompt object or null if not found
 */
async function loadPrompt(name) {
  try {
    return await storage.loadPrompt(name);
  } catch (error) {
    console.error('Error loading prompt:', error.message);
    return null;
  }
}

/**
 * List all prompts
 * @returns {Promise<Array<string>>} - Array of prompt names
 */
async function listPrompts() {
  try {
    return await storage.listPrompts();
  } catch (error) {
    console.error('Error listing prompts:', error.message);
    return [];
  }
}

/**
 * Delete a prompt
 * @param {string} name - Prompt name
 * @returns {Promise<boolean>} - True if successful
 */
async function deletePrompt(name) {
  try {
    return await storage.deletePrompt(name);
  } catch (error) {
    console.error('Error deleting prompt:', error.message);
    return false;
  }
}

module.exports = {
  savePrompt,
  loadPrompt,
  listPrompts,
  deletePrompt
};
