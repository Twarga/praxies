import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/inter/latin-300.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import App from "./App.jsx";
import { ConfigProvider } from "./contexts/ConfigContext.jsx";
import { EventSourceProvider } from "./contexts/EventSourceContext.jsx";
import { IndexProvider } from "./contexts/IndexContext.jsx";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <ConfigProvider>
        <IndexProvider>
          <EventSourceProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </EventSourceProvider>
        </IndexProvider>
      </ConfigProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
