use std::fs;
use std::path::PathBuf;

use noxe_lib::index::parser::parse;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NormalizedAst {
    file: String,
    title: String,
    tags: Vec<String>,
    links: Vec<noxe_lib::index::parser::ParsedLink>,
    headings: Vec<noxe_lib::index::parser::ParsedHeading>,
}

#[test]
fn parser_fixtures_emit_stable_ast_json() {
    let output = collect_fixture_asts();
    assert_eq!(output.len(), 10);
    if std::env::var("NOXE_PARITY_EXPORT").as_deref() == Ok("1") {
        let root = repo_root();
        let out_path = root.join("target/parser-parity-rust.json");
        fs::create_dir_all(out_path.parent().unwrap()).unwrap();
        fs::write(out_path, format!("{}\n", serde_json::to_string_pretty(&output).unwrap())).unwrap();
    }
}

fn collect_fixture_asts() -> Vec<NormalizedAst> {
    let fixture_dir = repo_root().join("tests/fixtures/parity");
    let mut files = fs::read_dir(fixture_dir)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.extension().is_some_and(|extension| extension == "md"))
        .collect::<Vec<_>>();
    files.sort();

    files
        .into_iter()
        .map(|path| {
            let file = path.file_name().unwrap().to_string_lossy().to_string();
            let body = fs::read_to_string(&path).unwrap();
            let parsed = parse(&body, &file).unwrap();
            NormalizedAst {
                file,
                title: parsed.title,
                tags: parsed.tags,
                links: parsed.links,
                headings: parsed.headings,
            }
        })
        .collect()
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf()
}
