'use client';

import React from 'react';

export function Panel({
  hud,
  title,
  right,
  children,
  className = '',
}: {
  hud?: string;
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`pp-panel ${className}`}>
      {(hud || title || right) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {hud && <div className="pp-hud">{hud}</div>}
            {title && <h3 className="mt-0.5 font-sans text-[15px] font-semibold tracking-tight text-white" style={{ fontFamily: 'var(--body)' }}>{title}</h3>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

/** "How to read it" and "Why it matters" side by side. */
export function Explain({ read, why, finding }: { read: React.ReactNode; why: React.ReactNode; finding?: React.ReactNode }) {
  return (
    <div className="grid gap-3 text-[13px] leading-relaxed text-[#cfd6e6] md:grid-cols-2">
      <div>
        <div className="pp-hud mb-1">How to read it</div>
        <div>{read}</div>
      </div>
      <div>
        <div className="pp-hud pp-hud-amber mb-1">Why it matters</div>
        <div>{why}</div>
      </div>
      {finding && (
        <div className="rounded-lg border border-[#ffd60a]/25 bg-[#ffd60a]/[0.06] px-3 py-2 md:col-span-2">
          <span className="pp-hud pp-hud-amber me-2">Finding</span>
          {finding}
        </div>
      )}
    </div>
  );
}

/** Explains what each row and each column of a figure stands for. */
export function LayoutGuide({
  rows,
  cols,
}: {
  rows: { name: string; text: string }[];
  cols: { name: string; text: string }[];
}) {
  return (
    <Panel hud="Figure layout" title="What each row and column shows">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="pp-hud mb-2">Rows</div>
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.name} className="pp-rise flex gap-2.5 text-[13px] leading-relaxed text-[#cfd6e6]" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="pp-num mt-0.5 shrink-0 text-[11px] text-[#30d5c8]">R{i + 1}</span>
                <span>
                  <b className="text-white">{r.name}.</b> {r.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="pp-hud pp-hud-amber mb-2">Columns</div>
          <ul className="space-y-2">
            {cols.map((c, i) => (
              <li key={c.name} className="pp-rise flex gap-2.5 text-[13px] leading-relaxed text-[#cfd6e6]" style={{ animationDelay: `${i * 70 + 120}ms` }}>
                <span className="pp-num mt-0.5 shrink-0 text-[11px] text-[#ffd60a]">C{i + 1}</span>
                <span>
                  <b className="text-white">{c.name}.</b> {c.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[12.5px] leading-relaxed text-[#b4b8cb]">{children}</p>;
}

export function Seg<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`pp-tab ${o.value === value ? 'active' : ''}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
