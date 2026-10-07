import { useTheme } from '../state/ThemeContext';
import { Icon } from './Icon';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = true }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <span className="theme-toggle-icon">
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
      </span>
      {showLabel && (
        <span className="theme-toggle-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
      )}
    </button>
  );
}
