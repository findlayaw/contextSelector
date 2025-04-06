/**
 * Storage module for prompt templates
 */

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
 * Save a prompt template
 * @param {string} name - Template name
 * @param {string} promptContent - Prompt content
 * @returns {Promise<void>}
 */
async function savePromptTemplate(name, promptContent) {
  try {
    await init();
    
    const promptPath = path.join(PROMPTS_DIR, `${name}.txt`);
    await fs.writeFile(promptPath, promptContent, 'utf8');
  } catch (error) {
    console.error('Error saving prompt template:', error.message);
    throw error;
  }
}

/**
 * Load a prompt template
 * @param {string} name - Template name
 * @returns {Promise<string|null>} - Prompt content
 */
async function loadPromptTemplate(name) {
  try {
    await init();
    
    const promptPath = path.join(PROMPTS_DIR, `${name}.txt`);
    
    if (await fs.pathExists(promptPath)) {
      return await fs.readFile(promptPath, 'utf8');
    }
    
    return null;
  } catch (error) {
    console.error('Error loading prompt template:', error.message);
    return null;
  }
}

/**
 * List all prompt templates
 * @returns {Promise<Array>} - Array of template names
 */
async function listPromptTemplates() {
  try {
    await init();
    
    const files = await fs.readdir(PROMPTS_DIR);
    
    return files
      .filter(file => file.endsWith('.txt'))
      .map(file => path.basename(file, '.txt'));
  } catch (error) {
    console.error('Error listing prompt templates:', error.message);
    return [];
  }
}

/**
 * Delete a prompt template
 * @param {string} name - Template name
 * @returns {Promise<boolean>} - True if successful
 */
async function deletePromptTemplate(name) {
  try {
    await init();
    
    const promptPath = path.join(PROMPTS_DIR, `${name}.txt`);
    
    if (await fs.pathExists(promptPath)) {
      await fs.remove(promptPath);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error deleting prompt template:', error.message);
    return false;
  }
}

module.exports = {
  savePromptTemplate,
  loadPromptTemplate,
  listPromptTemplates,
  deletePromptTemplate
};
