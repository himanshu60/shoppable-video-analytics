import { THEMES } from '../../hooks/useTheme.js';
import styles from './ThemeToggle.module.scss';

const OPTIONS = {
  system: { label: 'Auto', icon: '◐', description: 'Follow system setting' },
  light: { label: 'Light', icon: '☀', description: 'Always light' },
  dark: { label: 'Dark', icon: '☾', description: 'Always dark' },
};

/**
 * Three-state theme switch: Auto / Light / Dark.
 *
 * Built as a radiogroup rather than a single toggle button because "auto" is
 * a real third state — a two-way switch cannot express "follow my OS", which
 * is the setting most people actually want.
 */
export function ThemeToggle({ theme, resolvedTheme, onChange }) {
  return (
    <div
      className={styles.group}
      role="radiogroup"
      aria-label={`Colour theme, currently ${theme === 'system' ? `auto (${resolvedTheme})` : theme}`}
    >
      {THEMES.map((option) => {
        const { label, icon, description } = OPTIONS[option];
        const isSelected = theme === option;

        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`${styles.option} ${isSelected ? styles.selected : ''}`}
            onClick={() => onChange(option)}
            title={description}
          >
            <span aria-hidden="true">{icon}</span>
            <span className={styles.label}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
