const fs = require('fs-extra');
const path = require('path');
const storage = require('./storage');

/**
 * Save a template
 * @param {string} name - Template name
 * @param {Array} files - Selected files
 * @returns {Promise<void>}
 */
async function saveTemplate(name, files) {
  try {
    // Create a template object with just the necessary information
    const template = {
      name,
      files: files.map(file => ({
        path: file.path,
        relativePath: file.relativePath,
        name: file.name,
        type: file.type
      })),
      createdAt: new Date().toISOString()
    };
    
    await storage.saveTemplate(name, template);
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
    return await storage.loadTemplate(name);
  } catch (error) {
    console.error('Error loading template:', error.message);
    return null;
  }
}

/**
 * List all templates
 * @returns {Promise<Array>} - Array of template names
 */
async function listTemplates() {
  try {
    return await storage.listTemplates();
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
    return await storage.deleteTemplate(name);
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
