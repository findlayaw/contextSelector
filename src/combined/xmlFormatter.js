/**
 * Combined XML formatter module for formatting both code graph and code maps for LLM consumption in XML format
 */
const path = require('path');
const fileSystem = require('../simpleFileSystem');

/**
 * Format combined code graph and code maps for LLM consumption in XML format
 * @param {Array} selectedFiles - Array of selected file objects
 * @param {Object} directoryTree - Directory tree object
 * @param {Object} codeGraph - Code graph object
 * @param {Object} codeMaps - Code maps object
 * @param {Object} options - Formatting options
 * @param {boolean} options.includeFileContents - Whether to include full file contents (default: false)
 * @param {Array} selectedPrompts - Array of selected prompt contents
 * @returns {string} - Formatted content for clipboard in XML format
 */
async function formatCombinedForLLM(selectedFiles, directoryTree, codeGraph, codeMaps, options = {}, selectedPrompts = []) {
  // Set default options
  const includeFileContents = options.includeFileContents !== undefined ? options.includeFileContents : false;
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

  // Add code graph section
  result += '  <code_graph>\n';
  
  // Add graph statistics
  result += '    <statistics>\n';
  result += `      <total_files>${selectedFiles.length}</total_files>\n`;
  result += `      <total_nodes>${codeGraph.nodes.length}</total_nodes>\n`;
  result += `      <total_relationships>${codeGraph.edges.length}</total_relationships>\n`;
  
  // Add node types breakdown
  result += '      <node_types>\n';
  const nodeTypes = {};
  for (const node of codeGraph.nodes) {
    nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
  }
  
  for (const [type, count] of Object.entries(nodeTypes)) {
    result += `        <type name="${escapeXml(type)}" count="${count}" />\n`;
  }
  result += '      </node_types>\n';
  
  // Add relationship types breakdown
  result += '      <relationship_types>\n';
  const edgeTypes = {};
  for (const edge of codeGraph.edges) {
    edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
  }
  
  for (const [type, count] of Object.entries(edgeTypes)) {
    result += `        <type name="${escapeXml(type)}" count="${count}" />\n`;
  }
  result += '      </relationship_types>\n';
  result += '    </statistics>\n\n';

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

  // Add code maps section
  result += '  <code_maps>\n';
  
  // Add file definitions
  result += '    <file_definitions>\n';
  for (const file of codeMaps.files) {
    result += '      <file>\n';
    result += `        <path>${escapeXml(file.path)}</path>\n`;
    result += `        <language>${escapeXml(file.language)}</language>\n`;
    
    // Add package/namespace if available
    if (file.package) {
      result += `        <package>${escapeXml(file.package)}</package>\n`;
    }
    
    if (file.namespace) {
      result += `        <namespace>${escapeXml(file.namespace)}</namespace>\n`;
    }
    
    // Add imports
    if (file.imports && file.imports.length > 0) {
      result += '        <imports>\n';
      for (const importItem of file.imports) {
        result += '          <import>\n';
        result += `            <source>${escapeXml(importItem.source)}</source>\n`;
        result += `            <type>${escapeXml(importItem.type)}</type>\n`;
        
        if (importItem.type === 'default' || importItem.type === 'namespace' || importItem.type === 'commonjs') {
          result += `            <name>${escapeXml(importItem.name)}</name>\n`;
        } else if (importItem.type === 'named' && importItem.names) {
          result += '            <names>\n';
          for (const name of importItem.names) {
            result += `              <name>${escapeXml(name)}</name>\n`;
          }
          result += '            </names>\n';
        }
        
        result += '          </import>\n';
      }
      result += '        </imports>\n';
    }
    
    // Add definitions
    if (file.definitions && file.definitions.length > 0) {
      result += '        <definitions>\n';
      for (const def of file.definitions) {
        result += '          <definition>\n';
        result += `            <type>${escapeXml(def.type)}</type>\n`;
        result += `            <name>${escapeXml(def.name)}</name>\n`;
        
        // Add type-specific properties
        if (def.type === 'class' || def.type === 'interface') {
          if (def.extends) {
            result += `            <extends>${escapeXml(def.extends)}</extends>\n`;
          }
          
          if (def.methods && def.methods.length > 0) {
            result += '            <methods>\n';
            for (const method of def.methods) {
              result += '              <method>\n';
              result += `                <name>${escapeXml(method.name)}</name>\n`;
              result += '                <params>\n';
              for (const param of method.params) {
                result += `                  <param>${escapeXml(param)}</param>\n`;
              }
              result += '                </params>\n';
              result += '              </method>\n';
            }
            result += '            </methods>\n';
          }
          
          if (def.type === 'interface' && def.properties && def.properties.length > 0) {
            result += '            <properties>\n';
            for (const prop of def.properties) {
              result += '              <property>\n';
              result += `                <name>${escapeXml(prop.name)}</name>\n`;
              if (prop.type) {
                result += `                <type>${escapeXml(prop.type)}</type>\n`;
              }
              result += '              </property>\n';
            }
            result += '            </properties>\n';
          }
        } else if (def.type === 'function') {
          result += '            <params>\n';
          for (const param of def.params) {
            result += `              <param>${escapeXml(param)}</param>\n`;
          }
          result += '            </params>\n';
          
          if (def.returnType) {
            result += `            <return_type>${escapeXml(def.returnType)}</return_type>\n`;
          }
        } else if (def.type.includes('component')) {
          if (def.propsType) {
            result += `            <props_type>${escapeXml(def.propsType)}</props_type>\n`;
          }
          if (def.exported !== undefined) {
            result += `            <exported>${def.exported}</exported>\n`;
          }
        } else if (def.type === 'hook') {
          if (def.exported !== undefined) {
            result += `            <exported>${def.exported}</exported>\n`;
          }
        }
        
        result += '          </definition>\n';
      }
      result += '        </definitions>\n';
    }
    
    // Add type references
    if (file.typeReferences && file.typeReferences.length > 0) {
      result += '        <type_references>\n';
      for (const typeRef of file.typeReferences) {
        result += '          <type_reference>\n';
        result += `            <name>${escapeXml(typeRef.name)}</name>\n`;
        if (typeRef.module) {
          result += `            <module>${escapeXml(typeRef.module)}</module>\n`;
        }
        result += '          </type_reference>\n';
      }
      result += '        </type_references>\n';
    }
    
    // Add exports
    if (file.exports && file.exports.length > 0) {
      result += '        <exports>\n';
      for (const exportItem of file.exports) {
        result += '          <export>\n';
        result += `            <type>${escapeXml(exportItem.type)}</type>\n`;
        result += `            <name>${escapeXml(exportItem.name)}</name>\n`;
        result += '          </export>\n';
      }
      result += '        </exports>\n';
    }
    
    result += '      </file>\n';
  }
  result += '    </file_definitions>\n\n';
  
  // Add relationships
  if (codeMaps.relationships && codeMaps.relationships.length > 0) {
    result += '    <relationships>\n';
    for (const rel of codeMaps.relationships) {
      result += '      <relationship>\n';
      result += `        <source>${escapeXml(rel.source)}</source>\n`;
      result += `        <target>${escapeXml(rel.target)}</target>\n`;
      result += `        <type>${escapeXml(rel.type)}</type>\n`;
      
      if (rel.name) {
        result += `        <name>${escapeXml(rel.name)}</name>\n`;
      }
      
      if (rel.items && rel.items.length > 0) {
        result += '        <items>\n';
        for (const item of rel.items) {
          result += `          <item>${escapeXml(item)}</item>\n`;
        }
        result += '        </items>\n';
      }
      
      result += '      </relationship>\n';
    }
    result += '    </relationships>\n';
  }
  
  result += '  </code_maps>\n\n';

  // Add file contents for selected files if requested
  if (includeFileContents) {
    result += '  <files>\n';

    for (const file of selectedFiles) {
      const content = await fileSystem.readFileContent(file.path);
      const extension = path.extname(file.path).substring(1); // Remove the dot

      // Add file element
      result += '    <file>\n';
      result += `      <path>${escapeXml(file.path)}</path>\n`;
      result += `      <language>${escapeXml(extension || 'txt')}</language>\n`;
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
    result += '    <message>Full file contents have been excluded to optimize token usage. This Combined view focuses on structural information, relationships, and API definitions only.</message>\n';
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
 * Escape XML special characters
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeXml(str) {
  if (typeof str !== 'string') {
    return String(str);
  }
  
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

module.exports = { formatCombinedForLLM };
