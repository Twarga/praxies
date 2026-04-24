import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ConfigProvider } from "./contexts/ConfigContext.jsx";
import { IndexProvider } from "./contexts/IndexContext.jsx";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ConfigProvider>
      <IndexProvider>
        <App />
      </IndexProvider>
    </ConfigProvider>
  </React.StrictMode>,
);
