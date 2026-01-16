import addOnSandboxSdk from "add-on-sdk-document-sandbox";
import { editor } from "express-document-sdk";

/**
 * Extract all text from the Adobe Express document
 * Iterates through pages, artboards, and text nodes
 */
async function extractText() {
    try {
        console.log("=== Starting Text Extraction ===");

        const allText: string[] = [];
        const doc = editor.documentRoot;

        console.log(`Document has ${doc.pages.length} page(s)`);

        // Iterate through all pages
        for (const page of doc.pages) {
            console.log(`Processing page: ${page.id}`);

            // Iterate through all artboards on the page
            for (const artboard of page.artboards) {
                console.log(`  Processing artboard: ${artboard.id}`);

                // Get all children in the artboard
                const children = Array.from(artboard.allChildren);
                console.log(`    Found ${children.length} node(s)`);

                // Extract text from Text nodes
                for (const node of children) {
                    if (node.type === "Text") {
                        try {
                            // Access text content through fullContent.text property
                            const textNode = node as any; // Type assertion for text access

                            if (textNode.fullContent && textNode.fullContent.text) {
                                const textContent = textNode.fullContent.text;
                                console.log(`      Found text: "${textContent}"`);
                                allText.push(textContent);
                            }
                        } catch (error) {
                            console.error(`      Error extracting text from node:`, error);
                        }
                    }
                }
            }
        }

        console.log("=== Extraction Complete ===");
        console.log(`Total text elements found: ${allText.length}`);

        return {
            success: true,
            textElements: allText,
            count: allText.length
        };

    } catch (error) {
        console.error("=== Extraction Failed ===");
        console.error("Error:", error);

        return {
            success: false,
            textElements: [],
            count: 0,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Get document metadata
 */
async function getDocumentInfo() {
    try {
        const doc = editor.documentRoot;
        return {
            pageCount: doc.pages.length,
            documentId: doc.id || "unknown"
        };
    } catch (error) {
        return {
            pageCount: 0,
            documentId: "error"
        };
    }
}

// Expose API to UI
addOnSandboxSdk.instance.runtime.exposeApi({
    extractText,
    getDocumentInfo
});

console.log("Sandbox API initialized - extractText and getDocumentInfo available");
