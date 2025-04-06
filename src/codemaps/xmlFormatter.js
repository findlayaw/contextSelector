const path = require('path');
const fileSystem = require('../simpleFileSystem');

/**
 * Format code maps for LLM consumption in XML format
 * @param {Array} selectedFiles - Array of selected file objects
 * @param {Object} directoryTree - Directory tree object
 * @param {Object} codeMaps - Code maps object
 * @param {Object} options - Formatting options
 * @param {boolean} options.includeFileContents - Whether to include full file contents (default: false)
 * @returns {string} - Formatted content for clipboard in XML format
 */
async function formatCodeMapsForLLM(selectedFiles, directoryTree, codeMaps, options = {}) {
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
      for (const imp of file.imports) {
        result += '          <import>\n';
        result += `            <path>${escapeXml(imp.path)}</path>\n`;
        if (imp.items && imp.items.length > 0) {
          result += '            <items>\n';
          for (const item of imp.items) {
            result += `              <item>${escapeXml(item)}</item>\n`;
          }
          result += '            </items>\n';
        }
        result += '          </import>\n';
      }
      result += '        </imports>\n';
    }
    
    // Add classes
    if (file.classes && file.classes.length > 0) {
      result += '        <classes>\n';
      for (const cls of file.classes) {
        result += '          <class>\n';
        result += `            <name>${escapeXml(cls.name)}</name>\n`;
        
        // Add extends
        if (cls.extends) {
          result += `            <extends>${escapeXml(cls.extends)}</extends>\n`;
        }
        
        // Add implements
        if (cls.implements && cls.implements.length > 0) {
          result += '            <implements>\n';
          for (const impl of cls.implements) {
            result += `              <interface>${escapeXml(impl)}</interface>\n`;
          }
          result += '            </implements>\n';
        }
        
        // Add properties
        if (cls.properties && cls.properties.length > 0) {
          result += '            <properties>\n';
          for (const prop of cls.properties) {
            result += '              <property>\n';
            result += `                <name>${escapeXml(prop.name)}</name>\n`;
            if (prop.type) {
              result += `                <type>${escapeXml(prop.type)}</type>\n`;
            }
            if (prop.visibility) {
              result += `                <visibility>${escapeXml(prop.visibility)}</visibility>\n`;
            }
            if (prop.static) {
              result += '                <static>true</static>\n';
            }
            result += '              </property>\n';
          }
          result += '            </properties>\n';
        }
        
        // Add methods
        if (cls.methods && cls.methods.length > 0) {
          result += '            <methods>\n';
          for (const method of cls.methods) {
            result += '              <method>\n';
            result += `                <name>${escapeXml(method.name)}</name>\n`;
            if (method.returnType) {
              result += `                <return_type>${escapeXml(method.returnType)}</return_type>\n`;
            }
            if (method.visibility) {
              result += `                <visibility>${escapeXml(method.visibility)}</visibility>\n`;
            }
            if (method.static) {
              result += '                <static>true</static>\n';
            }
            
            // Add parameters
            if (method.parameters && method.parameters.length > 0) {
              result += '                <parameters>\n';
              for (const param of method.parameters) {
                result += '                  <parameter>\n';
                result += `                    <name>${escapeXml(param.name)}</name>\n`;
                if (param.type) {
                  result += `                    <type>${escapeXml(param.type)}</type>\n`;
                }
                result += '                  </parameter>\n';
              }
              result += '                </parameters>\n';
            }
            
            result += '              </method>\n';
          }
          result += '            </methods>\n';
        }
        
        result += '          </class>\n';
      }
      result += '        </classes>\n';
    }
    
    // Add functions
    if (file.functions && file.functions.length > 0) {
      result += '        <functions>\n';
      for (const func of file.functions) {
        result += '          <function>\n';
        result += `            <name>${escapeXml(func.name)}</name>\n`;
        if (func.returnType) {
          result += `            <return_type>${escapeXml(func.returnType)}</return_type>\n`;
        }
        
        // Add parameters
        if (func.parameters && func.parameters.length > 0) {
          result += '            <parameters>\n';
          for (const param of func.parameters) {
            result += '              <parameter>\n';
            result += `                <name>${escapeXml(param.name)}</name>\n`;
            if (param.type) {
              result += `                <type>${escapeXml(param.type)}</type>\n`;
            }
            result += '              </parameter>\n';
          }
          result += '            </parameters>\n';
        }
        
        result += '          </function>\n';
      }
      result += '        </functions>\n';
    }
    
    result += '      </file>\n';
  }
  result += '    </file_definitions>\n';
  
  // Add relationships section
  if (codeMaps.relationships && codeMaps.relationships.length > 0) {
    result += '    <relationships>\n';
    
    // Group relationships by source file
    const relationshipsBySource = {};
    for (const rel of codeMaps.relationships) {
      if (!relationshipsBySource[rel.source]) {
        relationshipsBySource[rel.source] = [];
      }
      relationshipsBySource[rel.source].push(rel);
    }
    
    // Add relationships for each source file
    for (const [source, relationships] of Object.entries(relationshipsBySource)) {
      result += `      <source_file path="${escapeXml(source)}">\n`;
      result += '        <dependencies>\n';
      
      for (const rel of relationships) {
        result += `          <dependency target="${escapeXml(rel.target)}">\n`;
        
        if (rel.items && rel.items.length > 0) {
          result += '            <items>\n';
          for (const item of rel.items) {
            result += `              <item>${escapeXml(item)}</item>\n`;
          }
          result += '            </items>\n';
        }
        
        result += '          </dependency>\n';
      }
      
      result += '        </dependencies>\n';
      result += '      </source_file>\n';
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
    result += '    <message>Full file contents have been excluded to optimize token usage. This Code Maps view focuses on structural information and API definitions only.</message>\n';
    result += '    <selected_files>\n';
    
    for (const file of selectedFiles) {
      result += `      <file_path>${file.path}</file_path>\n`;
    }
    
    result += '    </selected_files>\n';
    result += '  </note>\n';
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

module.exports = {
  formatCodeMapsForLLM
};
