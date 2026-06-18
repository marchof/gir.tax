export const BUTTON_BASE_CSS = `
  .button-base {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #cdd6df;
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: #1f2d3d;
    cursor: pointer;
    font: 600 14px/1.2 sans-serif;
    padding: 8px 12px;
    transition: background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
    width: fit-content;
  }

  .button-base:hover {
    background: #f7f9fb;
    border-color: #bfcad6;
  }

  .button-base:active {
    background: #eef2f6;
  }

  .button-base:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
`;