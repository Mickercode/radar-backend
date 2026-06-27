import { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/Icon';
import { type ContentItem, type Topic, api } from '../lib/api';
import { saveItem, unsaveItem } from '../lib/saved';

const TOPICS: { slug: string; label: string }[] = [
  { slug: '', label: 'All' },
  { slug: 'politics', label: 'Politics' },
  { slug: 'finance', label: 'Finance' },
  { slug: 'business', label: 'Business' },
  { slug: 'tech', label: 'Tech' },
  { slug: 'sports', label: 'Sports' },
  { slug: 'health', label: 'Health' },
  { slug: 'music', label: 'Music' },
  { slug: 'film', label: 'Film' },
  { slug: 'science', label: 'Science' },
  { slug: 'education', label: 'Education' },
];

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (d < 1) return `${Math.floor(d * 60)}m ago`;
  if (d < 24) return `${Math.floor(d)}h ago`;
  return `${Math.floor(d / 24)}d ago`;
}

// ── Content Card ────────────────────────────────────────────────────────────

interface CardProps {
  item: ContentItem;
  onDetail: (item: ContentItem) => void;
  onSaveToggle: (item: ContentItem) => void;
  saved: boolean;
}

function ContentCard({ item, onDetail, onSaveToggle, saved }: CardProps) {
  const takeaways = item.summary?.keyTakeaways ?? [];

  return (
    <article className="card" onClick={() => onDetail(item)}>
      {item.thumbnailUrl && (
        <img src={item.thumbnailUrl} alt="" className="card__thumb" loading="lazy" />
      )}
      <div className="card__body">
        <div className="card__meta">
          <span className={`card__type card__type--${item.type}`}>
            {item.type === 'podcast' && <Icon name="headphones" size={11} />}
            {item.type === 'clip' && <Icon name="play" size={11} />}
            {item.type === 'news' && <Icon name="feed" size={11} />}
            {item.type}
          </span>
          <span className="card__source">{item.source}</span>
          <span className="card__dot">·</span>
          <span className="card__time">{timeAgo(item.createdAt)}</span>
          {item.duration > 0 && (
            <><span className="card__dot">·</span><span className="card__dur">{formatDuration(item.duration)}</span></>
          )}
        </div>

        <h2 className="card__title">{item.title}</h2>

        {takeaways.length > 0 && (
          <ul className="card__takeaways">
            {takeaways.slice(0, 3).map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        )}

        {!takeaways.length && item.summary?.summary && (
          <p className="card__summary">{item.summary.summary}</p>
        )}
      </div>

      <div className="card__actions" onClick={(e) => e.stopPropagation()}>
        <button
          className={`card__save icon-btn${saved ? ' card__save--active' : ''}`}
          onClick={() => onSaveToggle(item)}
          aria-label={saved ? 'Unsave' : 'Save to My Knowledge'}
          title={saved ? 'Remove from My Knowledge' : 'Save to My Knowledge'}
        >
          <Icon name="save" size={18} />
        </button>
        {item.articleUrl && (
          <a
            href={item.articleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="card__link icon-btn"
            aria-label="Open article"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="link" size={18} />
          </a>
        )}
      </div>
    </article>
  );
}

// ── Detail Sheet ────────────────────────────────────────────────────────────

function DetailSheet({ item, onClose, onSaveToggle, saved }: { item: ContentItem; onClose: () => void; onSaveToggle: (item: ContentItem) => void; saved: boolean }) {
  const s = item.summary;

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__bar">
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={20} />
          </button>
          <span className="sheet__source">{item.source} · {timeAgo(item.createdAt)}</span>
          <button
            className={`icon-btn${saved ? ' card__save--active' : ''}`}
            onClick={() => onSaveToggle(item)}
            aria-label={saved ? 'Unsave' : 'Save'}
          >
            <Icon name="save" size={20} />
          </button>
        </div>

        <div className="sheet__scroll">
          {item.thumbnailUrl && (
            <img src={item.thumbnailUrl} alt="" className="sheet__thumb" />
          )}
          <div className="sheet__content">
            <h1 className="sheet__title">{item.title}</h1>

            {s?.what && <p className="sheet__lead">{s.what}</p>}

            {s && s.keyTakeaways.length > 0 && (
              <section className="kn__section">
                <h2 className="kn__section-title">Key Takeaways</h2>
                <ul className="kn__takeaways">
                  {s.keyTakeaways.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </section>
            )}

            {s?.whyItMatters && (
              <section className="kn__section">
                <h2 className="kn__section-title">Why It Matters</h2>
                <p className="kn__prose">{s.whyItMatters}</p>
              </section>
            )}

            {s?.howItMattersToYou && (
              <section className="kn__section">
                <h2 className="kn__section-title">How It Matters to You</h2>
                <p className="kn__prose">{s.howItMattersToYou}</p>
              </section>
            )}

            {s && s.glossary.length > 0 && (
              <section className="kn__section kn__glossary">
                <h2 className="kn__section-title">Glossary</h2>
                {s.glossary.map((entry, i) => {
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

            {item.articleUrl && (
              <a href={item.articleUrl} target="_blank" rel="noopener noreferrer" className="kn__read-btn btn btn--primary">
                <Icon name="link" size={16} /> Read full article
              </a>
            )}
            {item.audioUrl && (
              <a href={item.audioUrl} target="_blank" rel="noopener noreferrer" className="kn__read-btn btn btn--primary">
                <Icon name="headphones" size={16} /> Listen to podcast
              </a>
            )}
            {item.videoUrl && (
              <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="kn__read-btn btn btn--primary">
                <Icon name="play" size={16} /> Watch clip
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Feed Page ───────────────────────────────────────────────────────────────

export function FeedPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeTopic, setActiveTopic] = useState<string>('');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContentItem | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem('radar:saved') ?? '[]').map((i: {id: string}) => i.id))
  );

  // Load topics once
  useEffect(() => {
    api.topics().then(setTopics).catch(() => {});
  }, []);

  // Load feed when topic changes
  useEffect(() => {
    setLoading(true);
    setError(null);

    const topicObj = topics.find((t) => t.slug === activeTopic);
    const topicIds = topicObj ? [topicObj.id] : [];

    api.feed(topicIds)
      .then((r) => {
        setItems(r.items);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load feed. Check your connection.');
        setLoading(false);
      });
  }, [activeTopic, topics]);

  const handleSaveToggle = useCallback((item: ContentItem) => {
    if (savedIds.has(item.id)) {
      unsaveItem(item.id);
      setSavedIds((prev) => { const s = new Set(prev); s.delete(item.id); return s; });
    } else {
      saveItem(item);
      setSavedIds((prev) => new Set([...prev, item.id]));
    }
  }, [savedIds]);

  const displayTopics = [{ slug: '', label: 'All' }, ...topics.map((t) => ({ slug: t.slug, label: t.name }))];

  return (
    <div className="feed-page">
      {/* Topic tabs */}
      <div className="feed-tabs-wrap">
        <div className="feed-tabs">
          {displayTopics.map((t) => (
            <button
              key={t.slug}
              className={`feed-tab${activeTopic === t.slug ? ' feed-tab--active' : ''}`}
              onClick={() => setActiveTopic(t.slug)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed content */}
      <div className="feed-content">
        {loading && (
          <div className="feed-loading">
            <div className="feed-spinner" />
            <p>Loading your feed…</p>
          </div>
        )}

        {!loading && error && (
          <div className="empty">
            <Icon name="feed" size={48} />
            <h3>Could not load feed</h3>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="empty">
            <Icon name="feed" size={48} />
            <h3>No content yet</h3>
            <p>The feed is being updated. Check back soon.</p>
          </div>
        )}

        {!loading && !error && items.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            onDetail={setDetail}
            onSaveToggle={handleSaveToggle}
            saved={savedIds.has(item.id)}
          />
        ))}
      </div>

      {/* Detail sheet */}
      {detail && (
        <DetailSheet
          item={detail}
          onClose={() => setDetail(null)}
          onSaveToggle={handleSaveToggle}
          saved={savedIds.has(detail.id)}
        />
      )}
    </div>
  );
}
