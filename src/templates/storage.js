const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Define the storage directory
const STORAGE_DIR = path.join(os.homedir(), '.context-selector');
const TEMPLATES_DIR = path.join(STORAGE_DIR, 'templates');

/**
 * Initialize the storage
 * @returns {Promise<void>}
 */
async function init() {
  try {
    // Create the storage directory if it doesn't exist
    await fs.ensureDir(TEMPLATES_DIR);
  } catch (error) {
    console.error('Error initializing storage:', error.message);
    throw error;
  }
}

/**
 * Save a template
 * @param {string} name - Template name
 * @param {Object} template - Template object
 * @returns {Promise<void>}
 */
async function saveTemplate(name, template) {
  try {
    await init();
    
    const templatePath = path.join(TEMPLATES_DIR, `${name}.json`);
    await fs.writeJson(templatePath, template, { spaces: 2 });
  } catch (error) {
    console.error('Error saving template:', error.message);
    throw error;
  }
}

/**
 * Load a template
 * @param {string} name - Template name
 * @returns {Promise<Object>} - Template object
 */
async function loadTemplate(name) {
  try {
    await init();
    
    const templatePath = path.join(TEMPLATES_DIR, `${name}.json`);
    
    if (await fs.pathExists(templatePath)) {
      return await fs.readJson(templatePath);
    }
    
    return null;
  } catch (error) {
    console.error('Error loading template:', error.message);
    throw error;
  }
}

/**
 * List all templates
 * @returns {Promise<Array>} - Array of template names
 */
async function listTemplates() {
  try {
    await init();
    
    const files = await fs.readdir(TEMPLATES_DIR);
    
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'));
  } catch (error) {
    console.error('Error listing templates:', error.message);
    return [];
  }
}

/**
 * Delete a template
 * @param {string} name - Template name
 * @returns {Promise<boolean>} - True if successful
 */
async function deleteTemplate(name) {
  try {
    await init();
    
    const templatePath = path.join(TEMPLATES_DIR, `${name}.json`);
    
    if (await fs.pathExists(templatePath)) {
      await fs.remove(templatePath);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error deleting template:', error.message);
    return false;
  }
}

module.exports = {
  saveTemplate,
  loadTemplate,
  listTemplates,
  deleteTemplate
};
