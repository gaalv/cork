import { useEffect } from "react";
import { Toaster as SonnerToaster, toast } from "sonner";

import { onIpcError } from "@/shared/ipc/errors";

export function Toaster() {
  useEffect(() => {
    return onIpcError((event) => {
      toast.error(event.message, { description: event.topic, duration: 6000 });
    });
  }, []);

  return <SonnerToaster visibleToasts={3} position="bottom-right" richColors closeButton />;
}
