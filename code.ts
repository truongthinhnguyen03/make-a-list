/// <reference types="@figma/plugin-typings" />

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// Runs this code if the plugin is run in Figma
if (figma.editorType === 'figma') {
  // This plugin will open a window to prompt the user to enter a number, and
  // it will then create that many rectangles on the screen.

  // This shows the HTML page in "ui.html".
  figma.showUI(__html__);

  // Calls to "parent.postMessage" from within the HTML page will trigger this
  // callback. The callback will be passed the "pluginMessage" property of the
  // posted message.
  figma.ui.onmessage =  (msg: {type: string, count: number}) => {
    // One way of distinguishing between different types of messages sent from
    // your HTML page is to use an object with a "type" property like this.
    if (msg.type === 'create-shapes') {
      // This plugin creates rectangles on the screen.
      const numberOfRectangles = msg.count;

      const nodes: SceneNode[] = [];
      for (let i = 0; i < numberOfRectangles; i++) {
        const rect = figma.createRectangle();
        rect.x = i * 150;
        rect.fills = [{ type: 'SOLID', color: { r: 1, g: 0.5, b: 0 } }];
        figma.currentPage.appendChild(rect);
        nodes.push(rect);
      }
      figma.currentPage.selection = nodes;
      figma.viewport.scrollAndZoomIntoView(nodes);
    }

    // Make sure to close the plugin when you're done. Otherwise the plugin will
    // keep running, which shows the cancel button at the bottom of the screen.
    figma.closePlugin();
  };
}

// Runs this code if the plugin is run in FigJam
if (figma.editorType === 'figjam') {
  // This plugin will convert the entire FigJam board into a README.md file

  figma.showUI(__html__, { width: 340, height: 400 });

  figma.ui.onmessage = async (msg: { type: string }) => {
    if (msg.type === 'convert-to-readme') {
      try {
        const nodes = figma.currentPage.children;
        console.log(`Starting conversion with ${nodes.length} nodes`);
        const readmeContent = convertToReadme(nodes);
        
        figma.ui.postMessage({ type: 'readme-content', content: readmeContent });
      } catch (error) {
        console.error('Error during conversion:', error);
        figma.ui.postMessage({ type: 'error', message: 'An error occurred during conversion. Check the console for details.' });
      }
    }
  };
}

function convertToReadme(nodes: readonly SceneNode[]): string {
  // Get the FigJam board title
  const boardTitle = figma.root.name;
  let content = `# ${boardTitle}\n\n`;
  console.log(`Total nodes: ${nodes.length}`);

  for (const node of nodes) {
    content += processNode(node, 0, true);
  }

  // Remove the last separator if it exists
  content = content.replace(/\n---\n\n$/, '');

  console.log(`Final content length: ${content.length}`);
  return content;
}

function processNode(node: SceneNode, indentLevel: number = 0, isTopLevel: boolean = false): string {
  console.log(`Processing node of type: ${node.type}`);
  try {
    switch (node.type) {
      case 'SECTION':
        return processSectionNode(node, indentLevel, isTopLevel);
      case 'STICKY':
      case 'SHAPE_WITH_TEXT':
        return processTextNode(node, indentLevel);
      case 'LINK_UNFURL':
        return processLinkUnfurlNode(node);
      case 'GROUP':
      case 'FRAME':
        return processContainerNode(node, indentLevel);
      default:
        console.log(`Unhandled node type: ${node.type}`);
        return '';
    }
  } catch (error) {
    console.error(`Error processing node of type ${node.type}:`, error);
    return `- [Error processing ${node.type}]\n`;
  }
}

function processSectionNode(section: SectionNode, indentLevel: number, isTopLevel: boolean): string {
  console.log(`Processing section: ${section.name}`);
  let content = `${'#'.repeat(indentLevel + 2)} ${section.name}\n\n`;
  
  for (const child of section.children) {
    content += processNode(child, indentLevel + 1, false);
  }

  // Add a separator after the section content only if it's a top-level section
  if (isTopLevel) {
    content += '\n---\n\n';
  }

  return content;
}

function processContainerNode(node: GroupNode | FrameNode, indentLevel: number): string {
  console.log(`Processing container with ${node.children.length} children`);
  let content = '';
  for (const child of node.children) {
    content += processNode(child, indentLevel, false);
  }
  return content;
}

function processTextNode(node: SceneNode, indentLevel: number = 0): string {
  const indent = '  '.repeat(indentLevel);
  let content = `${indent}- `;

  if ('characters' in node) {
    const text = node.characters;
    console.log(`Processing text: ${text}`);
    const links = extractLinks(text);

    if (links.length > 0) {
      content += `[${text}](${links[0]})\n`;
    } else {
      content += `${text}\n`;
    }
  } else {
    console.log(`Node doesn't have text: ${node.type}`);
    content += `[No text content]\n`;
  }

  return content;
}

function processLinkUnfurlNode(node: LinkUnfurlNode): string {
  console.log(`Processing link unfurl`, node);
  let linkText = 'Link';
  let url = '';

  if (node.linkUnfurlData) {
    url = node.linkUnfurlData.url;
    linkText = node.linkUnfurlData.title || url;
    console.log(`Link data found: ${linkText} - ${url}`);
  } else {
    console.log('LinkUnfurlNode does not have linkUnfurlData');
  }

  return `- [${linkText}](${url})\n`;
}

function extractLinks(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}
