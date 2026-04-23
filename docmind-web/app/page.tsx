export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <nav className="flex h-16 items-center justify-between bg-slate-950 px-6 text-white md:px-10">
        <div className="text-xl font-semibold tracking-tight">DocMind</div>
      </nav>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-6 py-16 md:px-10">
        <section className="w-full max-w-4xl text-center">
          <h1 className="text-4xl font-bold leading-tight text-slate-900 md:text-6xl">
            DocMind - Turn Any Document Into a Chatbot
          </h1>
          <p className="mt-6 text-lg text-slate-600 md:text-xl">
            Upload your docs, choose your AI model, get an embeddable widget in minutes.
          </p>
          <a
            href="/setup"
            className="mt-10 inline-flex h-12 items-center justify-center rounded-md bg-slate-900 px-6 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Build Your Chatbot
          </a>
        </section>

        <section className="mt-14 grid w-full max-w-5xl gap-5 md:grid-cols-3">
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Any AI Model</h2>
            <p className="mt-2 text-sm text-slate-600">
              Connect your preferred model provider and tune responses for your audience.
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">One Script Tag</h2>
            <p className="mt-2 text-sm text-slate-600">
              Deploy instantly by dropping a single script tag on your website.
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Your Data, Your Control</h2>
            <p className="mt-2 text-sm text-slate-600">
              Keep ownership of your content and decide exactly what your bot should answer.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
