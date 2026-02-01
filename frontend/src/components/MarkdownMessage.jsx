import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.min.css';

/**
 * Renders markdown content with ChatGPT-style typography: headings, lists,
 * code blocks (with syntax highlighting), tables, blockquotes.
 */
const markdownComponents = {
  p: ({ children }) => (
    <p className="mb-3 text-gray-700 dark:text-gray-200 leading-relaxed last:mb-0">
      {children}
    </p>
  ),
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-4 mb-2 first:mt-0 border-b border-gray-200 dark:border-violet-500/20 pb-1">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-gray-900 dark:text-white mt-3 mb-1.5 first:mt-0">
      {children}
    </h3>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-6 mb-3 space-y-1 text-gray-700 dark:text-gray-200">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 mb-3 space-y-1 text-gray-700 dark:text-gray-200">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-violet-500/50 pl-4 py-1 my-3 text-gray-600 dark:text-gray-300 bg-gray-100/80 dark:bg-violet-500/10 rounded-r-lg">
      {children}
    </blockquote>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-lg bg-gray-900 dark:bg-black/50 p-4 my-3 text-sm border border-gray-700 dark:border-violet-500/20 [&>code]:p-0 [&>code]:bg-transparent">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className != null;
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-violet-500/20 text-violet-800 dark:text-violet-200 text-sm font-mono" {...props}>
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 dark:border-violet-500/20">
      <table className="min-w-full text-sm text-left text-gray-700 dark:text-gray-200">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-100 dark:bg-violet-500/15 text-gray-900 dark:text-white font-medium">
      {children}
    </thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y divide-gray-200 dark:divide-violet-500/10">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="px-4 py-2.5 whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5">{children}</td>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-300 hover:underline">
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
  ),
};

export default function MarkdownMessage({ content }) {
  if (content == null || String(content).trim() === '') return null;
  return (
    <div className="markdown-message">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={markdownComponents}
      >
        {String(content)}
      </ReactMarkdown>
    </div>
  );
}
