import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { markdownExtension } from "@/cm/markdown";
import { corkEditorTheme } from "@/cm/theme";
import { livePreviewExtension } from "@/cm/livePreview";
import { checkboxExtension } from "@/cm/checkboxes";
import "@/index.css";

// "- [ ] tarefa" — o traco e o [ ] sao ocultados sempre, com ou sem foco.
const DOC = "- [ ] tarefa aqui\nsegunda linha";

const view = new EditorView({
  state: EditorState.create({
    doc: DOC,
    extensions: [
      keymap.of(defaultKeymap),
      markdownExtension(),
      corkEditorTheme(false),
      checkboxExtension(),
      livePreviewExtension(),
      EditorView.lineWrapping,
    ],
  }),
  parent: document.getElementById("editor")!,
});
view.focus();

(window as unknown as Record<string, unknown>).__probe = {
  // Anda da posicao 0 para a direita e registra onde o cursor efetivamente para.
  varrer() {
    const paradas: number[] = [];
    view.dispatch({ selection: { anchor: 0 } });
    for (let i = 0; i < 8; i++) {
      const antes = view.state.selection.main.head;
      view.dispatch({ selection: { anchor: antes }, userEvent: "select" });
      // Move uma posicao logica para a direita, como a seta faria.
      const proximo = view.moveByChar(view.state.selection.main, true);
      view.dispatch({ selection: { anchor: proximo.head } });
      paradas.push(view.state.selection.main.head);
      if (proximo.head === antes) break;
    }
    return paradas;
  },
  texto: () => view.state.doc.toString(),
};
(window as unknown as Record<string, unknown>).__ready = true;
