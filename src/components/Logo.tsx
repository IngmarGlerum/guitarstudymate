/** ES-335 sunburst top with an f-hole. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id="logo-sunburst" cx="38%" cy="36%" r="72%">
          <stop offset="0" stopColor="#f6c978" />
          <stop offset=".5" stopColor="#d98a2b" />
          <stop offset=".82" stopColor="#8a2a1b" />
          <stop offset="1" stopColor="#2a0f08" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#logo-sunburst)" />
      <path
        d="M20.5 7c-3.2 2-3.8 6.2-2.2 9.6s1 6.2-1.6 8.6"
        fill="none"
        stroke="#1a0f09"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="20.8" cy="6.6" r="1.7" fill="#1a0f09" />
      <circle cx="16.4" cy="25.4" r="1.7" fill="#1a0f09" />
    </svg>
  );
}

/** A tweed-braided cable ending in a quarter-inch plug, as in the reference photos. */
export function JackPlug({ width = 176 }: { width?: number }) {
  return (
    <svg width={width} height={width * 0.25} viewBox="0 0 176 44" aria-hidden="true">
      <defs>
        <pattern
          id="plug-tweed"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="3.5" height="7" fill="#c2ad72" />
          <rect x="3.5" width="3.5" height="7" fill="#6b4a2b" />
        </pattern>
      </defs>
      {/* braided cable */}
      <rect x="0" y="16" width="46" height="12" rx="3" fill="url(#plug-tweed)" />
      {/* rubber boot */}
      <path d="M44 11h30a7 7 0 0 1 7 7v8a7 7 0 0 1-7 7H44z" fill="#3b2b1d" stroke="#54402d" strokeWidth="1.5" />
      {/* brass sleeve */}
      <rect x="81" y="14" width="40" height="16" rx="2" fill="#d9a441" />
      <rect x="81" y="14" width="40" height="5.5" rx="2" fill="#f0c874" opacity=".75" />
      <rect x="99" y="14" width="4.5" height="16" fill="#2a1a12" />
      {/* tip */}
      <path d="M121 16.5h28a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H121z" fill="#e8b85a" />
      <path d="M121 16.5h28a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H121z" fill="none" stroke="#9a6c22" strokeWidth="1" />
      <rect x="149" y="17.5" width="3.5" height="9" rx="1.7" fill="#2a1a12" />
    </svg>
  );
}
