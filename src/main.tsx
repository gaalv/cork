import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { installThemeRuntime } from "@/services/themeRuntime";
import { installDensityRuntime } from "@/services/densityRuntime";
import { installQuickCaptureRuntime } from "@/services/registerQuickCapture";
import { installSyncNowRuntime } from "@/services/registerSyncNow";
import { installGlobalErrorReporters, RootErrorBoundary } from "@/components/ui/RootErrorBoundary";
import "@/index.css";

installGlobalErrorReporters();
installThemeRuntime();
installDensityRuntime();
void installQuickCaptureRuntime();
void installSyncNowRuntime();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
