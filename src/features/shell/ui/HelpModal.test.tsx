import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useShellStore } from "@/features/shell/state/shellStore";

import { HelpModal } from "./HelpModal";

beforeEach(() => {
  useShellStore.getState().reset();
});

describe("HelpModal", () => {
  it("renders the shortcut reference", () => {
    useShellStore.getState().openHelp();

    const { container } = render(<HelpModal />);

    expect(container).toMatchSnapshot();
  });
});
