import { App, Notice, TFile } from 'obsidian';
import TaskCleanerPlugin from '../src/main';
import { DEFAULT_SETTINGS } from '../src/settings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a fake TFile with a given path. We cast through `unknown` because the
 * real obsidian TFile type (used for type-checking) has a no-arg constructor,
 * while our mock accepts a path. At runtime Jest replaces the module with our
 * mock, so the instance will have the `path` property set correctly.
 */
function makeTFile(path: string): TFile {
  return { path, name: path.split('/').pop() ?? '' } as unknown as TFile;
}

/**
 * Build a minimal TaskCleanerPlugin instance wired to a controlled vault mock.
 * `files` is a map of vault-relative path -> file contents.
 * `archiveContent` is the pre-existing content of today's archive file, if any.
 */
function makePlugin(
  files: Record<string, string>,
  archiveContent?: string,
): { plugin: TaskCleanerPlugin; vault: App['vault'] } {
  const app = new App();
  const vault = app.vault;

  // Build TFile list from the supplied paths
  const tfiles = Object.keys(files).map((p) => makeTFile(p));

  // vault.getMarkdownFiles() returns all TFiles
  (vault.getMarkdownFiles as jest.Mock).mockReturnValue(tfiles);

  // vault.read(file) returns the file's content (or archive content for archive path)
  (vault.read as jest.Mock).mockImplementation((file: TFile) => {
    if (archiveContent !== undefined && file.path.startsWith('.trash/deleted-tasks.')) {
      return Promise.resolve(archiveContent);
    }
    return Promise.resolve(files[file.path] ?? '');
  });

  // vault.modify / create / append / createFolder all resolve immediately
  (vault.modify as jest.Mock).mockResolvedValue(undefined);
  (vault.create as jest.Mock).mockResolvedValue(undefined);
  (vault.append as jest.Mock).mockResolvedValue(undefined);
  (vault.createFolder as jest.Mock).mockResolvedValue(undefined);

  // vault.getAbstractFileByPath: return a TFile-like object for the archive path
  // when archiveContent was provided (simulates the file already existing today),
  // otherwise return null (file does not exist yet).
  (vault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
    if (archiveContent !== undefined && path.startsWith('.trash/deleted-tasks.')) {
      return makeTFile(path);
    }
    return null;
  });

  // Construct the plugin, bypassing Obsidian's Plugin registration machinery.
  const plugin = new TaskCleanerPlugin(app as any, null as any);
  plugin.settings = { ...DEFAULT_SETTINGS };

  return { plugin, vault };
}

// ---------------------------------------------------------------------------
// Spy on Notice so we can assert on the message text
// ---------------------------------------------------------------------------
function spyOnNotice(): { calls: string[]; restore: () => void } {
  const calls: string[] = [];
  const OriginalNotice = Notice;
  const spy = jest
    .spyOn(require('obsidian'), 'Notice')
    .mockImplementation((msg: string) => {
      calls.push(msg);
      return new OriginalNotice(msg);
    });
  return { calls, restore: () => spy.mockRestore() };
}

// ---------------------------------------------------------------------------
// Pin the system clock so archive filenames and timestamps are deterministic
// ---------------------------------------------------------------------------
const FIXED_DATE = '2026-04-24';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-04-24T10:30:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DEFAULT_SETTINGS', () => {
  it('equals { paths: [] }', () => {
    expect(DEFAULT_SETTINGS).toEqual({ paths: [] });
  });
});

describe('TaskCleanerPlugin.cleanDoneTasks()', () => {
  // -------------------------------------------------------------------------
  // Empty / no-match cases
  // -------------------------------------------------------------------------
  describe('when no done tasks are found', () => {
    it('shows a "No done tasks found" notice when paths is empty', async () => {
      const { plugin } = makePlugin({});
      plugin.settings.paths = [];

      const { calls, restore } = spyOnNotice();
      await plugin.cleanDoneTasks();
      restore();

      expect(calls).toContain('No done tasks found');
    });

    it('does not write or create any file when paths is empty', async () => {
      const { plugin, vault } = makePlugin({});
      plugin.settings.paths = [];

      await plugin.cleanDoneTasks();

      expect(vault.modify).not.toHaveBeenCalled();
      expect(vault.create).not.toHaveBeenCalled();
      expect(vault.append).not.toHaveBeenCalled();
    });

    it('shows "No done tasks found" when files exist but contain no done tasks', async () => {
      const { plugin } = makePlugin({
        'notes/clean.md': '- [ ] pending\nJust some text.\n',
      });
      plugin.settings.paths = ['notes'];

      const { calls, restore } = spyOnNotice();
      await plugin.cleanDoneTasks();
      restore();

      expect(calls).toContain('No done tasks found');
    });
  });

  // -------------------------------------------------------------------------
  // Task line removal
  // -------------------------------------------------------------------------
  describe('removing done task lines', () => {
    it('removes "- [x] task" lines (lowercase x) from a file', async () => {
      const { plugin, vault } = makePlugin({
        'notes/todo.md': '- [ ] pending\n- [x] done task\nnormal line\n',
      });
      plugin.settings.paths = ['notes'];

      await plugin.cleanDoneTasks();

      expect(vault.modify).toHaveBeenCalled();
      const modifiedContent: string = (vault.modify as jest.Mock).mock.calls[0][1];
      expect(modifiedContent).not.toMatch(/- \[x\] done task/);
    });

    it('removes "- [X] task" lines (uppercase X) from a file', async () => {
      const { plugin, vault } = makePlugin({
        'notes/todo.md': '- [X] Done With Capital X\n- [ ] still pending\n',
      });
      plugin.settings.paths = ['notes'];

      await plugin.cleanDoneTasks();

      expect(vault.modify).toHaveBeenCalled();
      const modifiedContent: string = (vault.modify as jest.Mock).mock.calls[0][1];
      expect(modifiedContent).not.toMatch(/- \[X\] Done With Capital X/);
    });

    it('leaves "- [ ] task" (pending) lines untouched in the modified file', async () => {
      const { plugin, vault } = makePlugin({
        'notes/todo.md': '- [ ] pending task\n- [x] done task\n',
      });
      plugin.settings.paths = ['notes'];

      await plugin.cleanDoneTasks();

      expect(vault.modify).toHaveBeenCalled();
      const modifiedContent: string = (vault.modify as jest.Mock).mock.calls[0][1];
      expect(modifiedContent).toContain('- [ ] pending task');
    });

    it('leaves non-task lines untouched in the modified file', async () => {
      const { plugin, vault } = makePlugin({
        'notes/todo.md': '# Heading\nSome prose text.\n- [x] done task\n',
      });
      plugin.settings.paths = ['notes'];

      await plugin.cleanDoneTasks();

      expect(vault.modify).toHaveBeenCalled();
      const modifiedContent: string = (vault.modify as jest.Mock).mock.calls[0][1];
      expect(modifiedContent).toContain('# Heading');
      expect(modifiedContent).toContain('Some prose text.');
    });

    it('removes indented done tasks (e.g. "  - [x] subtask") while keeping sibling pending tasks', async () => {
      const { plugin, vault } = makePlugin({
        'notes/todo.md': '- [ ] parent\n  - [x] subtask\n  - [ ] other sub\n',
      });
      plugin.settings.paths = ['notes'];

      await plugin.cleanDoneTasks();

      expect(vault.modify).toHaveBeenCalled();
      const modifiedContent: string = (vault.modify as jest.Mock).mock.calls[0][1];
      expect(modifiedContent).not.toMatch(/- \[x\] subtask/);
      expect(modifiedContent).toContain('  - [ ] other sub');
    });

    it('processes done tasks from multiple files in a single run', async () => {
      const { plugin, vault } = makePlugin({
        'notes/a.md': '- [x] task in A\n',
        'notes/b.md': '- [x] task in B\n',
      });
      plugin.settings.paths = ['notes'];

      await plugin.cleanDoneTasks();

      const modifiedPaths = (vault.modify as jest.Mock).mock.calls.map(
        (call) => (call[0] as TFile).path,
      );
      expect(modifiedPaths).toContain('notes/a.md');
      expect(modifiedPaths).toContain('notes/b.md');
    });
  });

  // -------------------------------------------------------------------------
  // Path filtering
  // -------------------------------------------------------------------------
  describe('path filtering', () => {
    it('only modifies files that fall under a configured path', async () => {
      const { plugin, vault } = makePlugin({
        'notes/todo.md': '- [x] in scope\n',
        'other/todo.md': '- [x] out of scope\n',
      });
      plugin.settings.paths = ['notes'];

      await plugin.cleanDoneTasks();

      const modifiedPaths = (vault.modify as jest.Mock).mock.calls.map(
        (call) => (call[0] as TFile).path,
      );
      expect(modifiedPaths).toContain('notes/todo.md');
      expect(modifiedPaths).not.toContain('other/todo.md');
    });
  });

  // -------------------------------------------------------------------------
  // Archive file
  // -------------------------------------------------------------------------
  describe('archive file', () => {
    it('creates .trash/deleted-tasks.YYYY-MM-DD.md with correct format when it does not exist', async () => {
      const { plugin, vault } = makePlugin({
        'notes/todo.md': '- [x] Task one\n- [X] Task two\n- [ ] pending\n',
      });
      plugin.settings.paths = ['notes'];

      await plugin.cleanDoneTasks();

      expect(vault.create).toHaveBeenCalled();

      const [archivePath, archiveContent]: [string, string] =
        (vault.create as jest.Mock).mock.calls[0];

      // Correct filename
      expect(archivePath).toBe(`.trash/deleted-tasks.${FIXED_DATE}.md`);

      // Heading contains a date-time stamp
      expect(archiveContent).toMatch(/## Cleaned on 2026-04-24 \d{2}:\d{2}:\d{2}/);

      // Source file referenced as wikilink
      expect(archiveContent).toContain('### [[notes/todo.md]]');

      // Removed tasks listed
      expect(archiveContent).toContain('- [x] Task one');
      expect(archiveContent).toContain('- [X] Task two');

      // Pending task must NOT appear in the archive
      expect(archiveContent).not.toContain('- [ ] pending');
    });

    it('appends a new entry to today\'s archive file if it already exists', async () => {
      const existingArchive =
        '## Cleaned on 2026-04-24 09:00:00\n\n### [[notes/old.md]]\n- [x] old task\n';

      const { plugin, vault } = makePlugin(
        { 'notes/new.md': '- [x] new task\n' },
        existingArchive,
      );
      plugin.settings.paths = ['notes'];

      await plugin.cleanDoneTasks();

      // Must append rather than overwrite
      expect(vault.append).toHaveBeenCalled();
      expect(vault.create).not.toHaveBeenCalled();

      const appendedContent: string = (vault.append as jest.Mock).mock.calls[0][1];

      expect(appendedContent).toMatch(/## Cleaned on 2026-04-24 \d{2}:\d{2}:\d{2}/);
      expect(appendedContent).toContain('### [[notes/new.md]]');
      expect(appendedContent).toContain('- [x] new task');
    });
  });

  // -------------------------------------------------------------------------
  // Notice with task/file counts
  // -------------------------------------------------------------------------
  describe('success notice', () => {
    it('shows "Cleaned X tasks from Y files" with the correct counts', async () => {
      const { plugin } = makePlugin({
        'notes/a.md': '- [x] task one\n- [x] task two\n',
        'notes/b.md': '- [X] task three\n',
      });
      plugin.settings.paths = ['notes'];

      const { calls, restore } = spyOnNotice();
      await plugin.cleanDoneTasks();
      restore();

      // 3 tasks across 2 files
      expect(calls).toContain('Cleaned 3 tasks from 2 files');
    });
  });
});
