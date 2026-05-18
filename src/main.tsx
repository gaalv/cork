import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { Providers } from "@/app/Providers";
import { installThemeRuntime } from "@/features/settings/runtime/themeRuntime";
import { installQuickCaptureRuntime } from "@/features/quick-capture/services/registerQuickCapture";
import { installOpenTodosRuntime } from "@/features/todos/services/registerOpenTodos";
import { installSyncNowRuntime } from "@/features/sync/services/registerSyncNow";
import { installGlobalErrorReporters, RootErrorBoundary } from "@/shared/ui/RootErrorBoundary";
import "@/index.css";

installGlobalErrorReporters();
installThemeRuntime();
void installQuickCaptureRuntime();
void installOpenTodosRuntime();
void installSyncNowRuntime();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <RootErrorBoundary>
      <Providers>
        <App />
      </Providers>
    </RootErrorBoundary>
  </StrictMode>,
);
