export class Vault {
  getMarkdownFiles = jest.fn();
  read = jest.fn();
  modify = jest.fn();
  create = jest.fn();
  append = jest.fn();
  createFolder = jest.fn();
  getAbstractFileByPath = jest.fn();
}

export class App {
  vault = new Vault();
}

export class Plugin {
  app: App;
  addCommand = jest.fn();
  addSettingTab = jest.fn();
  loadData = jest.fn();
  saveData = jest.fn();

  constructor(app: App) {
    this.app = app;
  }
}

export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl: HTMLElement = document.createElement('div');

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
  }

  display = jest.fn();
  hide = jest.fn();
}

export class Notice {
  message: string;
  constructor(message: string) {
    this.message = message;
  }
}

export class Setting {
  setName = jest.fn().mockReturnThis();
  setDesc = jest.fn().mockReturnThis();
  addText = jest.fn().mockReturnThis();
  addButton = jest.fn().mockReturnThis();
}

export class ButtonComponent {
  setButtonText = jest.fn().mockReturnThis();
  onClick = jest.fn().mockReturnThis();
}

export class TextComponent {
  setPlaceholder = jest.fn().mockReturnThis();
  setValue = jest.fn().mockReturnThis();
  onChange = jest.fn().mockReturnThis();
}

export class TFile {
  path: string;
  name: string;
  constructor(path: string = '', name: string = '') {
    this.path = path;
    this.name = name || path.split('/').pop() || '';
  }
}
