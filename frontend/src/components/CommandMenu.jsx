import React, { useEffect, useRef } from 'react';

/**
 * Notion-style slash command menu: dark theme, filter by query, keyboard nav.
 * UI only; parent handles open/close, filtering, and selection.
 */
export default function CommandMenu({
  open,
  filteredCommands,
  activeIndex,
  onSelect,
  onClose,
  listRef,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open || !listRef?.current) return;
    const el = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open, activeIndex, listRef]);

  if (!open || filteredCommands.length === 0) return null;

  return (
    <div
      ref={(el) => { menuRef.current = el; if (listRef) listRef.current = el; }}
      id="copilot-command-list"
      className="absolute left-0 right-0 bottom-full mb-1 z-20 py-1.5 rounded-xl bg-gray-900 dark:bg-[#16161d] border border-gray-300 dark:border-violet-500/30 shadow-lg shadow-black/20 dark:shadow-[0_0_24px_rgba(0,0,0,0.4)] max-h-56 overflow-y-auto"
      role="listbox"
      aria-label="Commands"
    >
      {filteredCommands.map((cmd, i) => (
        <button
          key={cmd}
          id={`cmd-${i}`}
          type="button"
          data-index={i}
          role="option"
          aria-selected={i === activeIndex}
          className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all duration-150 flex items-center gap-2 ${
            i === activeIndex
              ? 'bg-violet-500/25 text-violet-200 dark:text-violet-100 border-l-2 border-l-violet-400'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 border-l-2 border-l-transparent'
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(cmd);
          }}
        >
          <span className="font-medium text-violet-500 dark:text-violet-400">{cmd}</span>
        </button>
      ))}
    </div>
  );
}
