import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-black text-black dark:text-white selection:bg-blue-500 selection:text-white">
      <main className="flex flex-col items-center justify-center px-4 text-center sm:px-8">
        <div className="relative mb-8">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 opacity-75 blur transition duration-1000 group-hover:opacity-100 group-hover:duration-200"></div>
          <span className="relative inline-flex items-center rounded-full bg-black px-3 py-1 text-sm font-medium text-white ring-1 ring-white/10">
            <span>New Release 1.0</span>
          </span>
        </div>

        <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-7xl bg-clip-text text-transparent bg-gradient-to-b from-neutral-800 to-neutral-500 dark:from-neutral-100 dark:to-neutral-400">
          Exam Detection
        </h1>

        <p className="mb-10 max-w-2xl text-lg text-neutral-600 dark:text-neutral-400 sm:text-xl">
          Advanced AI-powered proctoring for secure and reliable online examinations.
          Ensure integrity with real-time face detection and behavior analysis.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/dashboard"
            className="inline-flex h-12 items-center justify-center rounded-full bg-blue-600 px-8 text-base font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-black"
          >
            Get Started
          </Link>
          <Link
            href="/docs"
            className="inline-flex h-12 items-center justify-center rounded-full border border-neutral-200 bg-transparent px-8 text-base font-medium text-neutral-900 transition-all hover:bg-neutral-100 dark:border-neutral-800 dark:text-white dark:hover:bg-neutral-900"
          >
            Documentation
          </Link>
        </div>
      </main>

      <footer className="absolute bottom-8 text-sm text-neutral-500 dark:text-neutral-600">
        &copy; {new Date().getFullYear()} Exam Detection Inc. All rights reserved.
      </footer>
    </div>
  );
}
