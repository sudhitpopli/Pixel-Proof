// Document Sandbox - Extract text from Adobe Express
import addOnSandboxSdk from "add-on-sdk-document-sandbox";
import { editor } from "express-document-sdk";

async function extractDesignData() {
    try {
        const doc = editor.documentRoot;
        const colors: string[] = [];
        const textElements: any[] = [];
        const images: any[] = [];
        const fonts = new Set<string>();

        console.log('=== Starting extraction ===');

        // Iterate through all pages
        for (const page of doc.pages) {
            console.log('Processing page');

            // Iterate through all artboards on the page
            for (const artboard of page.artboards) {
                console.log('Processing artboard');

                // Get all children in the artboard
                const allNodes = Array.from(artboard.allChildren);
                console.log('Total nodes:', allNodes.length);

                for (const node of allNodes) {
                    console.log('Node type:', node.type);

                    // Extract text nodes
                    if (node.type === "Text") {
                        try {
                            // @ts-ignore - TextNode has textFlow
                            const textFlow = node.textFlow;
                            let fullText = "";

                            if (textFlow && textFlow.paragraphs) {
                                for (const paragraph of textFlow.paragraphs) {
                                    for (const textRun of paragraph.textRuns) {
                                        fullText += textRun.text;
                                        if (textRun.fontFamily) {
                                            fonts.add(textRun.fontFamily);
                                        }
                                    }
                                }
                            }

                            if (fullText) {
                                console.log('Found text:', fullText);
                                textElements.push({
                                    id: node.id,
                                    text: fullText,
                                    fontSize: 16,
                                    fontFamily: Array.from(fonts)[0] || 'Arial'
                                });
                            }
                        } catch (error) {
                            console.error('Error extracting text:', error);
                        }
                    }

                    // Extract colors from fills
                    // @ts-ignore - fills exists on visual nodes
                    if (node.fills && node.fills.length > 0) {
                        // @ts-ignore
                        for (const fill of node.fills) {
                            if (fill.type === "solid") {
                                const color = fill.color;
                                const hexColor = `#${Math.round(color.red * 255).toString(16).padStart(2, '0')}${Math.round(color.green * 255).toString(16).padStart(2, '0')}${Math.round(color.blue * 255).toString(16).padStart(2, '0')}`;
                                if (!colors.includes(hexColor)) {
                                    colors.push(hexColor);
                                }
                            }
                        }
                    }

                    // Extract images
                    if (node.type === "MediaContainer") {
                        images.push({
                            id: node.id,
                            // @ts-ignore
                            width: node.width || 0,
                            // @ts-ignore
                            height: node.height || 0
                        });
                    }
                }
            }
        }

        const result = {
            colors,
            textElements,
            images,
            videos: [],
            fonts: Array.from(fonts),
            symbols: []
        };

        console.log('=== Extraction complete ===');
        console.log('Result:', result);

        return result;
    } catch (error) {
        console.error('=== Extraction failed ===');
        console.error('Error:', error);

        return {
            colors: [],
            textElements: [],
            images: [],
            videos: [],
            fonts: [],
            symbols: []
        };
    }
}

async function getDocumentMetadata() {
    try {
        const doc = editor.documentRoot;
        return {
            documentId: doc.id || 'unknown',
            title: 'Adobe Express Document',
            pageCount: doc.pages.length || 1
        };
    } catch (error) {
        return {
            documentId: 'error',
            title: 'Error',
            pageCount: 0
        };
    }
}

// Expose API to UI
addOnSandboxSdk.instance.runtime.exposeApi({
    extractDesignData,
    getDocumentMetadata
});
