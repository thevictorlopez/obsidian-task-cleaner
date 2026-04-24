# Task Cleaner

An [Obsidian](https://obsidian.md) plugin that removes completed tasks from your notes. Use the **Clean done tasks** command from the command palette to scan all configured paths and strip out any `- [x]` or `- [X]` lines. Removed tasks are soft-deleted, written to a dated archive file at `.trash/deleted-tasks.YYYY-MM-DD.md` with a reference to the source file, so nothing is ever permanently lost.

Configure which vault paths to scan under **Settings → Task Cleaner**. Paths are vault-relative (e.g. `notes/daily`). Any file whose path starts with a configured entry will be included in the scan.

## License

[GNU General Public License v3.0](LICENSE.md) © Víctor López García
