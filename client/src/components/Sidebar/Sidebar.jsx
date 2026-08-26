import styles from './Sidebar.module.scss';

const NAV = [
  { key: 'overview', label: 'Overview', hint: 'Funnel and trends' },
  { key: 'videos', label: 'Videos', hint: 'Per-video metrics' },
  { key: 'activity', label: 'Activity', hint: 'Live event feed' },
];

const ICONS = {
  // Simple geometric glyphs rather than an icon dependency: three shapes do
  // not justify shipping a library.
  overview: (
    <>
      <rect x="2" y="9" width="3.4" height="6" rx="1" />
      <rect x="7.3" y="5" width="3.4" height="10" rx="1" />
      <rect x="12.6" y="2" width="3.4" height="13" rx="1" />
    </>
  ),
  videos: (
    <>
      <rect x="1.5" y="3" width="15" height="11" rx="2" fill="none" strokeWidth="1.6" />
      <path d="M7.2 6.4v5.2l4.4-2.6z" />
    </>
  ),
  activity: <path d="M1.5 9h3l2.2-5 3.4 10 2.2-5h3.2" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
};

export function Sidebar({ route, onNavigate }) {
  return (
    <nav className={styles.sidebar} aria-label="Dashboard sections">
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">V</span>
        <span className={styles.brandText}>
          <strong>Videoselz</strong>
          <small>Analytics</small>
        </span>
      </div>

      <ul className={styles.list}>
        {NAV.map((item) => {
          const isActive = route === item.key;
          return (
            <li key={item.key}>
              <button
                type="button"
                className={`${styles.link} ${isActive ? styles.active : ''}`}
                onClick={() => onNavigate(item.key)}
                aria-current={isActive ? 'page' : undefined}
              >
                <svg viewBox="0 0 18 18" className={styles.icon} aria-hidden="true">
                  {ICONS[item.key]}
                </svg>
                <span className={styles.linkText}>
                  <span className={styles.linkLabel}>{item.label}</span>
                  <span className={styles.linkHint}>{item.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
