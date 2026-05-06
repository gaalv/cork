/** App-wide context providers. Empty for now; F04 will wire stores here. */
import type { PropsWithChildren } from "react";

export function Providers({ children }: PropsWithChildren) {
  return <>{children}</>;
}
