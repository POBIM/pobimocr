"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { name: "Overview", href: "/" },
  { name: "Browser Engine", href: "/browser-ocr" },
  { name: "CRAFT Engine", href: "/craft-ocr" },
  { name: "Speech-to-Text", href: "/speech-ocr" },
  { name: "API Docs", href: "http://localhost:8005/docs", external: true },
];

const isActive = (pathname: string, href: string) => {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname.startsWith(href);
};

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-lg font-semibold tracking-tight text-gray-800">
            POBIMOCR
          </Link>
          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => (
              item.external ? (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-100/60 hover:text-gray-900"
                >
                  {item.name}
                </a>
              ) : (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    isActive(pathname, item.href)
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100/60 hover:text-gray-900"
                  }`}
                >
                  {item.name}
                </Link>
              )
            ))}
          </nav>
          <button
            className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100/60 md:hidden"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation"
          >
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
        {mobileOpen && (
          <div className="border-t border-gray-200 bg-white/80 md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col px-4 py-3">
              {navItems.map((item) => (
                item.external ? (
                  <a
                    key={item.name}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100/60"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.name}
                  </a>
                ) : (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`rounded-lg px-4 py-2 text-sm transition ${
                      isActive(pathname, item.href)
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-600 hover:bg-gray-100/60"
                    }`}
                  >
                    {item.name}
                  </Link>
                )
              ))}
            </nav>
          </div>
        )}
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-12">
        {children}
      </main>
      <footer className="border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-6 py-8 text-center text-sm text-gray-500">
          <p>POBIMOCR © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
