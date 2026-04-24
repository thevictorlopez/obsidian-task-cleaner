import { Notice, TFile, Vault } from 'obsidian';
import type { TaskCleanerSettings } from './settings';

const DONE_TASK_RE = /^(\s*)[-*+] \[[xX]\] .+/;

function pad2(n: number): string {
	return n.toString().padStart(2, '0');
}

function formatDateTime(d: Date): string {
	const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
	const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
	return `${date} ${time}`;
}

function formatDate(d: Date): string {
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export async function cleanDoneTasks(
	vault: Vault,
	settings: TaskCleanerSettings,
): Promise<void> {
	if (settings.paths.length === 0) {
		new Notice('No done tasks found');
		return;
	}

	const allFiles = vault.getMarkdownFiles();
	const matchingFiles = allFiles.filter((file) =>
		settings.paths.some((p) => file.path.startsWith(p)),
	);

	const now = new Date();
	const dateStr = formatDate(now);
	const dateTimeStr = formatDateTime(now);
	const archivePath = `.trash/deleted-tasks.${dateStr}.md`;

	let totalTasksRemoved = 0;
	let filesWithTasks = 0;
	let archiveEntry = `\n## Cleaned on ${dateTimeStr}\n`;

	for (const file of matchingFiles) {
		const content = await vault.read(file);
		const lines = content.split('\n');

		const doneTasks: string[] = [];
		const remainingLines: string[] = [];

		for (const line of lines) {
			if (DONE_TASK_RE.test(line)) {
				doneTasks.push(line);
			} else {
				remainingLines.push(line);
			}
		}

		if (doneTasks.length === 0) continue;

		totalTasksRemoved += doneTasks.length;
		filesWithTasks += 1;

		await vault.modify(file, remainingLines.join('\n'));

		archiveEntry += `\n### [[${file.path}]]\n`;
		for (const task of doneTasks) {
			archiveEntry += `${task}\n`;
		}
	}

	if (totalTasksRemoved === 0) {
		new Notice('No done tasks found');
		return;
	}

	const trashExists = vault.getAbstractFileByPath('.trash');
	if (!trashExists) {
		await vault.createFolder('.trash');
	}

	const archiveFile = vault.getAbstractFileByPath(archivePath);
	if (archiveFile) {
		await vault.append(archiveFile as TFile, archiveEntry);
	} else {
		await vault.create(archivePath, archiveEntry.trimStart());
	}

	new Notice(`Cleaned ${totalTasksRemoved} tasks from ${filesWithTasks} files`);
}
