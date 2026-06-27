import { useState, useCallback } from 'react';
import { Icon } from '../components/Icon';
import { type SavedItem, getSavedItems, unsaveItem } from '../lib/saved';
import { relativeTime } from '../lib/notes';

type View = 'list' | 'detail';

const TYPE_ICONS = {
  news: 'feed',
  podcast: 'headphones',
  clip: 'play',
} as const;

export function KnowledgePage() {
  const [items, setItems] = useState<SavedItem[]>(() => getSavedItems());
  const [selected, setSelected] = useState<SavedItem | null>(null);
  const [view, setView] = useState<View>('list');
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? items.filter(
        (i) =>
          i.title.toLowerCase().includes(search.toLowerCase()) ||
          i.source.toLowerCase().includes(search.toLowerCase()) ||
          i.summary?.toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  const openItem = useCallback((item: SavedItem) => {
    setSelected(item);
    setView('detail');
  }, []);

  const handleUnsave = useCallback((id: string) => {
    unsaveItem(id);
    setItems(getSavedItems());
    if (selected?.id === id) setView('list');
  }, [selected]);

  const handleBack = () => {
    setView('list');
    setSelected(null);
  };

  // ── List view ──────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="kn">
        <div className="page-head">
          <div className="page-kicker">What you've saved</div>
          <h1 className="page-title">My Knowledge</h1>
        </div>

        <div className="kn__topbar">
          <div className="nb__search-wrap">
            <Icon name="search" size={16} className="nb__search-icon" />
            <input
              className="nb__search"
              type="search"
              placeholder="Search saved items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            <Icon name="brain" size={48} />
            <h3>{search ? 'No matches' : 'Nothing saved yet'}</h3>
            <p>
              {search
                ? 'Try a different search term.'
                : 'Save articles, podcasts, and clips from your feed. They\'ll appear here.'}
            </p>
          </div>
        ) : (
          <ul className="kn__list">
            {filtered.map((item) => (
              <li key={item.id} className="kn__item" onClick={() => openItem(item)}>
                <div className={`kn__item-badge kn__item-badge--${item.type}`}>
                  <Icon name={TYPE_ICONS[item.type]} size={13} />
                  {item.type}
                </div>
                <div className="kn__item-body">
                  <p className="kn__item-title">{item.title}</p>
                  <p className="kn__item-meta">{item.source} · {relativeTime(item.savedAt)}</p>
                  {item.summary && (
                    <p className="kn__item-preview">{item.summary}</p>
                  )}
                </div>
                {item.thumbnailUrl && (
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    className="kn__item-thumb"
                    loading="lazy"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ── Detail view ────────────────────────────────────────────────────────────
  if (!selected) return null;

  return (
    <div className="kn kn--detail">
      <div className="kn__detail-bar">
        <button className="icon-btn" onClick={handleBack} aria-label="Back">
          <Icon name="left" size={20} />
        </button>
        <div className={`kn__item-badge kn__item-badge--${selected.type}`}>
          <Icon name={TYPE_ICONS[selected.type]} size={13} />
          {selected.type}
        </div>
        <button
          className="icon-btn kn__unsave"
          onClick={() => handleUnsave(selected.id)}
          aria-label="Remove from My Knowledge"
          title="Remove"
        >
          <Icon name="trash" size={18} />
        </button>
      </div>

      <div className="kn__detail-scroll">
        {selected.thumbnailUrl && (
          <img src={selected.thumbnailUrl} alt="" className="kn__detail-thumb" />
        )}

        <div className="kn__detail-content">
          <p className="kn__detail-source">{selected.source} · {relativeTime(selected.savedAt)}</p>
          <h1 className="kn__detail-title">{selected.title}</h1>

          {selected.summary && (
            <p className="kn__detail-summary">{selected.summary}</p>
          )}

          {selected.keyTakeaways.length > 0 && (
            <section className="kn__section">
              <h2 className="kn__section-title">Key Takeaways</h2>
              <ul className="kn__takeaways">
                {selected.keyTakeaways.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </section>
          )}

          {selected.howItMattersToYou && (
            <section className="kn__section">
              <h2 className="kn__section-title">How It Matters to You</h2>
              <p className="kn__prose">{selected.howItMattersToYou}</p>
            </section>
          )}

          {selected.glossary.length > 0 && (
            <section className="kn__section kn__glossary">
              <h2 className="kn__section-title">Glossary</h2>
              {selected.glossary.map((entry, i) => {
                const [term, ...defParts] = entry.split(':');
                return (
                  <div key={i} className="kn__gloss-entry">
                    <span className="kn__gloss-term">{term?.trim()}</span>
                    <span className="kn__gloss-def">{defParts.join(':').trim()}</span>
                  </div>
                );
              })}
            </section>
          )}

          {(selected.articleUrl || selected.audioUrl || selected.videoUrl) && (
            <a
              href={selected.articleUrl ?? selected.videoUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="kn__read-btn btn btn--primary"
            >
              <Icon name="link" size={16} />
              {selected.type === 'podcast' ? 'Listen now' : selected.type === 'clip' ? 'Watch clip' : 'Read full article'}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
