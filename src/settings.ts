import { App, PluginSettingTab, Setting, ButtonComponent, TextComponent } from 'obsidian';
import type TaskCleanerPlugin from './main';

export interface TaskCleanerSettings {
	paths: string[];
}

export const DEFAULT_SETTINGS: TaskCleanerSettings = {
	paths: [],
};

export class TaskCleanerSettingTab extends PluginSettingTab {
	plugin: TaskCleanerPlugin;

	constructor(app: App, plugin: TaskCleanerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('p', {
			text: 'Paths are vault-relative (e.g. Notes/daily). Only files under these paths will be scanned.',
		});

		for (const path of this.plugin.settings.paths) {
			new Setting(containerEl).setName(path).addButton((btn: ButtonComponent) => {
				btn.setButtonText('✕').onClick(async () => {
					this.plugin.settings.paths = this.plugin.settings.paths.filter((p) => p !== path);
					await this.plugin.saveSettings();
					this.display();
				});
			});
		}

		let newPathValue = '';
		new Setting(containerEl)
			.addText((text: TextComponent) => {
				text.onChange((value: string) => {
					newPathValue = value;
				});
			})
			.addButton((btn: ButtonComponent) => {
				btn.setButtonText('Add').onClick(async () => {
					if (newPathValue) {
						this.plugin.settings.paths.push(newPathValue);
						await this.plugin.saveSettings();
						this.display();
					}
				});
			});
	}
}
