fn main() {
    // `include_dir!` embeds skills/ at compile time, but Cargo has no way to
    // know the directory is an input — without this, adding or editing a skill
    // leaves the old set baked into the binary until an unrelated change
    // happens to force a rebuild.
    println!("cargo:rerun-if-changed=skills");

    tauri_build::build()
}
