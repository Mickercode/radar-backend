const STORAGE_KEY = 'radar:notes';

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

function persist(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Note[]) : [];
  } catch {
    return [];
  }
}

export function createNote(): Note {
  const now = new Date().toISOString();
  const note: Note = { id: crypto.randomUUID(), title: '', body: '', createdAt: now, updatedAt: now };
  persist([note, ...loadNotes()]);
  return note;
}

export function updateNote(id: string, changes: { title?: string; body?: string }): Note {
  const notes = loadNotes();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) throw new Error('Note not found');
  const updated: Note = { ...notes[idx]!, ...changes, updatedAt: new Date().toISOString() };
  notes[idx] = updated;
  persist(notes);
  return updated;
}

export function deleteNote(id: string) {
  persist(loadNotes().filter((n) => n.id !== id));
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}
