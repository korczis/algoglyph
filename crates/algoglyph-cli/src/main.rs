//! `algoglyph`: the repository's tooling as one CLI (ADR 0005 §6). Every subcommand reads its
//! policy from data under `config/`, and its custom checks are Rhai scripts discovered by
//! convention under `tools/checks/`, so adding a check is dropping a file, not editing code.
//!
//! The existing Node scripts stay the gates until a port is proven equivalent; this binary runs
//! next to them (`just facts-rs`) and `tests/equivalence.rs` holds the two to the same findings.

mod catalogue;
mod facts;
mod jsre;
mod pathx;
mod plugins;

use std::process::ExitCode;

use clap::{Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(name = "algoglyph", version, about = "algoglyph's repository tooling")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// The derived-facts gate (rule project.derived-facts): no hand-typed count, plate number
    /// or dangling link; driven by config/derived-facts.yaml and the Rhai checks.
    Facts(facts::Args),
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    let result = match cli.command {
        Command::Facts(args) => facts::run(&args),
    };
    match result {
        Ok(code) => code,
        Err(error) => {
            eprintln!("algoglyph: {error}");
            ExitCode::from(2)
        }
    }
}
