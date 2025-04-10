const path = require('path');
const fileSystem = require('../simpleFileSystem');

/**
 * Format code graph for LLM consumption in XML format
 * @param {Array} selectedFiles - Array of selected file objects
 * @param {Object} directoryTree - Directory tree object
 * @param {Object} codeGraph - Code graph object
 * @param {Object} options - Formatting options
 * @param {boolean} options.includeFileContents - Whether to include full file contents (default: true)
 * @param {Array} selectedPrompts - Array of selected prompt contents
 * @returns {string} - Formatted content for clipboard in XML format
 */
async function formatGraphForLLM(selectedFiles, directoryTree, codeGraph, options = {}, selectedPrompts = []) {
  // Set default options
  const includeFileContents = options.includeFileContents !== undefined ? options.includeFileContents : true;
  let result = '';

  // Add XML header
  result += '<?xml version="1.0" encoding="UTF-8"?>\n';
  result += '<context>\n';

  // Add directory tree
  result += '  <directory_structure>\n';
  result += '    <![CDATA[\n';
  result += fileSystem.formatDirectoryTree(directoryTree);
  result += '    ]]>\n';
  result += '  </directory_structure>\n\n';

  // Add code graph
  result += '  <code_graph>\n';

  // Add nodes
  result += '    <nodes>\n';
  for (const node of codeGraph.nodes) {
    result += '      <node>\n';
    result += `        <id>${escapeXml(node.id)}</id>\n`;
    result += `        <type>${escapeXml(node.type)}</type>\n`;
    result += `        <label>${escapeXml(node.label || '')}</label>\n`;

    // Add path if available
    if (node.path) {
      result += `        <path>${escapeXml(node.path)}</path>\n`;
    }

    // Add other properties
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'id' && key !== 'type' && key !== 'label' && key !== 'path' && key !== 'node' && value !== undefined) {
        result += `        <${key}>${formatXmlValue(value)}</${key}>\n`;
      }
    }

    result += '      </node>\n';
  }
  result += '    </nodes>\n\n';

  // Add edges
  result += '    <edges>\n';
  for (const edge of codeGraph.edges) {
    result += '      <edge>\n';
    result += `        <source>${escapeXml(edge.source)}</source>\n`;
    result += `        <target>${escapeXml(edge.target)}</target>\n`;
    result += `        <type>${escapeXml(edge.type)}</type>\n`;

    // Add other properties
    for (const [key, value] of Object.entries(edge)) {
      if (key !== 'source' && key !== 'target' && key !== 'type' && key !== 'id' && value !== undefined) {
        result += `        <${key}>${formatXmlValue(value)}</${key}>\n`;
      }
    }

    result += '      </edge>\n';
  }
  result += '    </edges>\n';
  result += '  </code_graph>\n\n';

  // Add function calls section
  result += '  <function_calls>\n';

  // Group functions by their calls
  const functionCalls = new Map();

  for (const edge of codeGraph.edges) {
    if (edge.type === 'calls') {
      const sourceNode = codeGraph.nodes.find(node => node.id === edge.source);
      const targetNode = codeGraph.nodes.find(node => node.id === edge.target);

      if (sourceNode && targetNode) {
        if (!functionCalls.has(sourceNode.id)) {
          functionCalls.set(sourceNode.id, []);
        }

        functionCalls.get(sourceNode.id).push({
          id: targetNode.id,
          name: targetNode.label,
          path: targetNode.path,
          args: edge.args || '',
          line: edge.line,
          column: edge.column
        });
      }
    }
  }

  // Output function calls
  for (const [sourceId, calls] of functionCalls.entries()) {
    const sourceNode = codeGraph.nodes.find(node => node.id === sourceId);
    if (sourceNode) {
      result += '    <function>\n';
      result += `      <name>${escapeXml(sourceNode.label)}</name>\n`;
      result += `      <path>${escapeXml(sourceNode.path)}</path>\n`;
      result += '      <calls>\n';

      if (calls.length === 0) {
        result += '        <none/>\n';
      } else {
        for (const call of calls) {
          result += '        <call>\n';
          result += `          <name>${escapeXml(call.name)}</name>\n`;
          result += `          <path>${escapeXml(path.basename(call.path))}</path>\n`;

          if (call.args) {
            result += `          <args>${escapeXml(call.args)}</args>\n`;
          }

          if (call.line) {
            result += `          <line>${call.line}</line>\n`;
          }

          result += '        </call>\n';
        }
      }

      result += '      </calls>\n';
      result += '    </function>\n';
    }
  }

  result += '  </function_calls>\n\n';

  // Add files if requested
  if (includeFileContents) {
    result += '  <files>\n';

    for (const file of selectedFiles) {
      const content = await fileSystem.readFileContent(file.path);
      const extension = path.extname(file.path).substring(1); // Remove the dot

      // Add file element
      result += '    <file>\n';
      result += `      <path>${file.path}</path>\n`;
      result += `      <language>${extension || 'txt'}</language>\n`;
      result += '      <content><![CDATA[\n';
      result += content;
      result += '      ]]></content>\n';
      result += '    </file>\n\n';
    }

    result += '  </files>\n';
  } else {
    // Add a note about file contents being excluded for token efficiency
    result += '  <note>\n';
    result += '    <title>Note on Selected Files</title>\n';
    result += '    <message>Full file contents have been excluded to optimize token usage. This Graph Mode view focuses on structural information and relationships only.</message>\n';
    result += '    <selected_files>\n';

    for (const file of selectedFiles) {
      result += `      <file_path>${escapeXml(file.path)}</file_path>\n`;
    }

    result += '    </selected_files>\n';
    result += '  </note>\n';
  }

  // Add instructions section if prompts are selected
  if (selectedPrompts && selectedPrompts.length > 0) {
    result += '\n  <instructions>\n';
    selectedPrompts.forEach(promptContent => {
      result += '    <prompt><![CDATA[\n';
      result += promptContent;
      // Ensure prompt ends with a newline for CDATA correctness
      if (!promptContent.endsWith('\n')) {
        result += '\n';
      }
      result += '    ]]></prompt>\n';
    });
    result += '  </instructions>\n';
  }

  result += '</context>';

  return result;
}

/**
 * Escape XML special characters in a string
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeXml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format a value for XML output
 * @param {any} value - Value to format
 * @returns {string} - Formatted value
 */
function formatXmlValue(value) {
  if (typeof value === 'string') {
    return escapeXml(value);
  } else if (Array.isArray(value)) {
    return `<array>${value.map(v => `<item>${formatXmlValue(v)}</item>`).join('')}</array>`;
  } else if (typeof value === 'object' && value !== null) {
    return `<object>${Object.entries(value).map(([k, v]) => `<${k}>${formatXmlValue(v)}</${k}>`).join('')}</object>`;
  } else if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  } else {
    return String(value);
  }
}

module.exports = { formatGraphForLLM };
