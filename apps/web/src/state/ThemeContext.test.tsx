import { describe, it, expect, beforeEach } from 'vitest';
import { render, act, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeContext';

function TestConsumer() {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={toggleTheme}>Toggle</button>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
    </div>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('initializes with dark theme by default when no preference exists', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('reads stored preference from localStorage', () => {
    localStorage.setItem('scambreak-theme', 'light');

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('current-theme').textContent).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggles theme and updates localStorage and documentElement', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );

    const toggleBtn = screen.getByText('Toggle');
    act(() => {
      toggleBtn.click();
    });

    expect(screen.getByTestId('current-theme').textContent).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('scambreak-theme')).toBe('light');

    act(() => {
      toggleBtn.click();
    });

    expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('scambreak-theme')).toBe('dark');
  });
});
