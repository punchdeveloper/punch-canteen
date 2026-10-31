/**
 * The navigation icons from v63 (sidebar and phone tab bar use slightly
 * different drawings for a few of them, exactly as in v63).
 */
const svg = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {d}
  </svg>
);

export const sideIcons: Record<string, React.ReactNode> = {
  home: svg(<path d="M3 11.2 12 4l9 7.2v8.3a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 19.5z" />),
  menu: svg(<path d="M6 3v8M3.5 3v5a2.5 2.5 0 0 0 5 0V3M6 11v10M15 3v18M15 3c4 2 5 6 5 10h-5" />),
  cart: svg(<path d="M3 4h2l2.2 10h10.6l2-7H6M9 20h.01M17 20h.01" />),
  tracking: svg(<path d="M4 5h16v14H4zM8 9h8M8 13h6" />),
  chat: svg(<path d="M4 5h16v12H9l-5 4zM8 10h.01M12 10h.01M16 10h.01" />),
  account: svg(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.8-5 3.5-7 8-7s7.2 2 8 7" />
    </>,
  ),
  review: svg(<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z" />),
};

export const bottomIcons: Record<string, React.ReactNode> = {
  home: sideIcons.home,
  menu: sideIcons.menu,
  cart: sideIcons.cart,
  tracking: svg(<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />),
  chat: sideIcons.chat,
  account: svg(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-5 3-8 8-8s8 3 8 8" />
    </>,
  ),
  review: svg(<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9z" />),
};
