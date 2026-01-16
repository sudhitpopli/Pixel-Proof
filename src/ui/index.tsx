// UI Entry Point - Full Integration
import addOnUISdk from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App";

const root = createRoot(document.getElementById("root") as HTMLElement);

addOnUISdk.ready.then(async () => {
    const { runtime } = addOnUISdk.instance;
    // @ts-ignore - documentSandbox is valid but not in RuntimeType enum
    const sandboxProxy = await runtime.apiProxy("documentSandbox");

    root.render(
        <App addOnUISdk={addOnUISdk.instance} sandboxProxy={sandboxProxy} />
    );
});
