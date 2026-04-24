import { Plugin } from 'obsidian';
import { TaskCleanerSettings, DEFAULT_SETTINGS, TaskCleanerSettingTab } from './settings';
import { cleanDoneTasks } from './cleaner';

export default class TaskCleanerPlugin extends Plugin {
	settings: TaskCleanerSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addCommand({
			id: 'clean-done-tasks',
			name: 'Clean done tasks',
			callback: () => this.cleanDoneTasks(),
		});
		this.addSettingTab(new TaskCleanerSettingTab(this.app, this));
	}

	onunload(): void {}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async cleanDoneTasks(): Promise<void> {
		return cleanDoneTasks(this.app.vault, this.settings);
	}
}
