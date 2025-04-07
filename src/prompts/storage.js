const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Define the storage directory
const STORAGE_DIR = path.join(os.homedir(), '.context-selector');
const PROMPTS_DIR = path.join(STORAGE_DIR, 'prompts');

/**
 * Initialize the storage
 * @returns {Promise<void>}
 */
async function init() {
  try {
    // Create the storage directory if it doesn't exist
    await fs.ensureDir(PROMPTS_DIR);
  } catch (error) {
    console.error('Error initializing prompt storage:', error.message);
    throw error;
  }
}

/**
 * Save a prompt
 * @param {string} name - Prompt name
 * @param {string} content - Prompt content
 * @returns {Promise<void>}
 */
async function savePrompt(name, content) {
  try {
    await init();
    
    const promptPath = path.join(PROMPTS_DIR, `${name}.json`);
    await fs.writeJson(promptPath, { name, content }, { spaces: 2 });
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
    await init();
    
    const promptPath = path.join(PROMPTS_DIR, `${name}.json`);
    
    if (await fs.pathExists(promptPath)) {
      return await fs.readJson(promptPath);
    }
    
    return null;
  } catch (error) {
    console.error('Error loading prompt:', error.message);
    throw error;
  }
}

/**
 * List all prompts
 * @returns {Promise<Array<string>>} - Array of prompt names
 */
async function listPrompts() {
  try {
    await init();
    
    const files = await fs.readdir(PROMPTS_DIR);
    
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'));
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
    await init();
    
    const promptPath = path.join(PROMPTS_DIR, `${name}.json`);
    
    if (await fs.pathExists(promptPath)) {
      await fs.remove(promptPath);
      return true;
    }
    
    return false;
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
