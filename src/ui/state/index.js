/**
 * State management for the terminal UI
 * Centralizes all state variables used across components
 */

const modeHandler = require('../modeHandler');
const outputHandler = require('../outputHandler');

// Create a state object to hold all state variables
const state = {
  // File selection state
  selectedFiles: [],
  selectedEmptyDirs: [],
  directoryTree: null,
  tokenCount: 0,

  // UI state
  expandedDirs: new Set(),
  activeBox: 'treeBox',

  // Search state
  isSearchActive: false,
  searchResults: [],
  originalTree: null,
  groupedResults: {},
  searchListToNodeMap: [], // Map display indices to actual nodes in search mode

  // Template state
  templateToSave: null,
  templateFiles: [],

  // Prompt state
  currentPrompt: '',
  promptTemplateToSave: null,
  templateLoaderFocus: 'files', // 'files' or 'prompts'

  // Multi-selection state
  multiSelectStartIndex: -1,
  highlightedIndices: new Set(),

  // Mode state
  currentMode: modeHandler.MODES.STANDARD,

  // CodeMaps options
  includeContents: false,

  // Output format
  currentOutputFormat: outputHandler.OUTPUT_FORMATS.MARKDOWN,

  // Flattened tree for node lookup
  flattenedTree: []
};

/**
 * Initialize the state with options
 * @param {Object} options - Options to initialize state with
 */
function initState(options) {
  // Set initial mode based on options
  if (options.graphMode) {
    state.currentMode = modeHandler.MODES.GRAPH;
  } else if (options.codeMapsMode) {
    state.currentMode = modeHandler.MODES.CODEMAPS;
    // Store the includeContents option
    state.includeContents = options.includeContents || false;
  } else {
    state.currentMode = modeHandler.MODES.STANDARD;
  }

  // Set initial output format based on options
  if (options.xmlOutput) {
    state.currentOutputFormat = outputHandler.OUTPUT_FORMATS.XML;
  } else {
    state.currentOutputFormat = outputHandler.OUTPUT_FORMATS.MARKDOWN;
  }
}

/**
 * Reset the state to its initial values
 */
function resetState() {
  state.selectedFiles = [];
  state.selectedEmptyDirs = [];
  state.directoryTree = null;
  state.tokenCount = 0;
  state.expandedDirs = new Set();
  state.activeBox = 'treeBox';
  state.isSearchActive = false;
  state.searchResults = [];
  state.originalTree = null;
  state.groupedResults = {};
  state.searchListToNodeMap = [];
  state.templateToSave = null;
  state.templateFiles = [];
  state.currentPrompt = '';
  state.promptTemplateToSave = null;
  state.templateLoaderFocus = 'files';
  state.multiSelectStartIndex = -1;
  state.highlightedIndices = new Set();
  state.flattenedTree = [];
}

/**
 * Get the current state
 * @returns {Object} - The current state
 */
function getState() {
  return state;
}

/**
 * Get the result object to return from the terminal
 * @returns {Object} - Result object with selected files and other data
 */
function getResult() {
  return {
    selectedFiles: state.selectedFiles,
    selectedEmptyDirs: state.selectedEmptyDirs,
    directoryTree: state.directoryTree,
    tokenCount: state.tokenCount,
    saveTemplate: state.templateToSave,
    templateFiles: state.templateFiles.length > 0 ? state.templateFiles : null,
    currentPrompt: state.currentPrompt,
    promptTemplateToSave: state.promptTemplateToSave,
    mode: state.currentMode,
    includeContents: state.includeContents,
    outputFormat: state.currentOutputFormat
  };
}

/**
 * Get an empty result object (for when user quits without selecting)
 * @returns {Object} - Empty result object
 */
function getEmptyResult() {
  return {
    selectedFiles: [],
    selectedEmptyDirs: [],
    directoryTree: null,
    tokenCount: 0,
    saveTemplate: null,
    templateFiles: null,
    currentPrompt: '',
    promptTemplateToSave: null,
    mode: state.currentMode,
    includeContents: state.includeContents,
    outputFormat: state.currentOutputFormat
  };
}

module.exports = {
  getState,
  initState,
  resetState,
  getResult,
  getEmptyResult
};
