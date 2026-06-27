import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../components/Icon';
import {
  type Note,
  loadNotes,
  createNote,
  updateNote,
  deleteNote,
  relativeTime,
} from '../lib/notes';

type SaveStatus = 'idle' | 'saving' | 'saved';

export function NotebookPage() {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const activeNote = notes.find((n) => n.id === activeId) ?? null;
  const inEditor = activeId !== null;

  const filtered = search.trim()
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.body.toLowerCase().includes(search.toLowerCase()),
      )
    : notes;

  // Debounced autosave whenever title or body changes while editing
  useEffect(() => {
    if (!activeId) return;
    setSaveStatus('saving');
    const timer = window.setTimeout(() => {
      const updated = updateNote(activeId, { title, body });
      setNotes((prev) =>
        [...prev.map((n) => (n.id === activeId ? updated : n))].sort(
          (a, b) => b.updatedAt.localeCompare(a.updatedAt),
        ),
      );
      setSaveStatus('saved');
    }, 1200);
    return () => clearTimeout(timer);
  }, [title, body, activeId]);

  const openNote = useCallback((note: Note) => {
    setActiveId(note.id);
    setTitle(note.title);
    setBody(note.body);
    setSaveStatus('idle');
    setConfirmDelete(false);
    // Focus body if title already filled, else focus title
    requestAnimationFrame(() => {
      if (note.title && bodyRef.current) bodyRef.current.focus();
    });
  }, []);

  const handleNewNote = useCallback(() => {
    const note = createNote();
    setNotes((prev) => [note, ...prev]);
    openNote(note);
  }, [openNote]);

  // Force-save and go back to list
  const handleBack = useCallback(() => {
    if (activeId) {
      updateNote(activeId, { title, body });
      setNotes(loadNotes());
    }
    setActiveId(null);
    setSaveStatus('idle');
    setConfirmDelete(false);
  }, [activeId, title, body]);

  const handleDelete = useCallback(() => {
    if (!activeId) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    deleteNote(activeId);
    setNotes(loadNotes());
    setActiveId(null);
    setConfirmDelete(false);
  }, [activeId, confirmDelete]);

  // ── List view ──────────────────────────────────────────────────────────────
  if (!inEditor) {
    return (
      <div className="nb">
        <div className="nb__topbar">
          <div className="nb__search-wrap">
            <Icon name="search" size={16} className="nb__search-icon" />
            <input
              className="nb__search"
              type="search"
              placeholder="Search notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="nb__new" onClick={handleNewNote} aria-label="New note">
            <Icon name="pen" size={18} />
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="nb__empty">
            <Icon name="notebook" size={48} />
            <h3>{search ? 'No notes match' : 'No notes yet'}</h3>
            <p>{search ? 'Try a different search.' : 'Tap the pen to write your first note.'}</p>
            {!search && (
              <button className="nb__empty-btn" onClick={handleNewNote}>
                <Icon name="pen" size={16} /> New note
              </button>
            )}
          </div>
        ) : (
          <ul className="nb__list">
            {filtered.map((note) => (
              <li key={note.id} className="nb__item" onClick={() => openNote(note)}>
                <div className="nb__item-top">
                  <span className="nb__item-title">
                    {note.title || <em>Untitled</em>}
                  </span>
                  <span className="nb__item-time">{relativeTime(note.updatedAt)}</span>
                </div>
                <p className="nb__item-preview">
                  {note.body.split('\n').find((l) => l.trim()) || 'Empty note'}
                </p>
              </li>
            ))}
          </ul>
        )}

        <button className="nb__fab" onClick={handleNewNote} aria-label="New note">
          <Icon name="pen" size={22} />
        </button>
      </div>
    );
  }

  // ── Editor view ────────────────────────────────────────────────────────────
  return (
    <div className="nb nb--editor">
      <div className="nb__editor-bar">
        <button className="nb__back icon-btn" onClick={handleBack} aria-label="Back to notes">
          <Icon name="left" size={20} />
        </button>
        <span className={`nb__status nb__status--${saveStatus}`}>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && <><Icon name="check" size={13} /> Saved</>}
        </span>
        <button
          className={`nb__delete icon-btn${confirmDelete ? ' nb__delete--confirm' : ''}`}
          onClick={handleDelete}
          aria-label={confirmDelete ? 'Confirm delete' : 'Delete note'}
          title={confirmDelete ? 'Tap again to delete' : 'Delete note'}
        >
          <Icon name="trash" size={18} />
          {confirmDelete && <span className="nb__delete-label">Delete?</span>}
        </button>
      </div>

      <input
        className="nb__title-input"
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={500}
      />

      <div className="nb__divider" />

      <textarea
        ref={bodyRef}
        className="nb__body"
        placeholder="Start writing…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        spellCheck
      />

      {activeNote && (
        <p className="nb__meta">
          Created {relativeTime(activeNote.createdAt)}
          {activeNote.body.trim() && ` · ${activeNote.body.trim().split(/\s+/).length} words`}
        </p>
      )}
    </div>
  );
}
