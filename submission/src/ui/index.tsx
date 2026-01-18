import addOnUISdk from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App";

const root = createRoot(document.getElementById("root") as HTMLElement);

addOnUISdk.ready.then(async () => {
    const { runtime } = addOnUISdk.instance;
    const sandboxProxy = await runtime.apiProxy("documentSandbox" as any);

    root.render(
        <App addOnUISdk={addOnUISdk} sandboxProxy={sandboxProxy} />
    );
});
