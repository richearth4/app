'use client';

import { FormEvent, useMemo, useState } from 'react';

type AnalysisResult = {
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestedBulletImprovements: string[];
  optimizedResumeText: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export default function ResumeMatchPage() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const scoreColorClass = useMemo(() => {
    if (!result) {
      return 'text-slate-900';
    }

    if (result.atsScore >= 80) {
      return 'text-emerald-600';
    }

    if (result.atsScore >= 60) {
      return 'text-amber-500';
    }

    return 'text-rose-600';
  }, [result]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!resumeFile) {
      setError('Please upload your resume before submitting.');
      return;
    }

    if (!jobDescription.trim()) {
      setError('Please add a job description.');
      return;
    }

    try {
      setIsLoading(true);

      const formData = new FormData();
      formData.append('resume', resumeFile);
      formData.append('jobDescription', jobDescription);

      const response = await fetch(`${apiBaseUrl}/documents/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const responseData = (await response.json()) as { message?: string };
        throw new Error(responseData.message ?? 'Resume analysis failed.');
      }

      const responseData = (await response.json()) as AnalysisResult;
      setResult(responseData);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Resume analysis failed.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleDownloadResume() {
    if (!result) {
      return;
    }

    const blob = new Blob([result.optimizedResumeText], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = 'optimized-resume.txt';
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
  }

  if (result) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6">
        <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-indigo-600">Results</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">ATS Resume Match</h1>
            </div>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Analyze another resume
            </button>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-6 lg:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">ATS Score</p>
              <p className={`mt-3 text-6xl font-bold ${scoreColorClass}`}>{result.atsScore}%</p>
              <p className="mt-3 text-sm text-slate-600">Your resume currently matches this role at a glance.</p>
              <button
                type="button"
                onClick={handleDownloadResume}
                className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                Download optimized resume
              </button>
            </article>

            <article className="rounded-xl border border-slate-200 p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold">Keywords</h2>
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-emerald-700">Matched keywords</h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {result.matchedKeywords.map((keyword) => (
                      <li
                        key={keyword}
                        className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
                      >
                        {keyword}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-rose-700">Missing keywords</h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {result.missingKeywords.map((keyword) => (
                      <li
                        key={keyword}
                        className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-800"
                      >
                        {keyword}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          </div>

          <article className="mt-6 rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold">Suggested bullet improvements</h2>
            <ul className="mt-4 space-y-3">
              {result.suggestedBulletImprovements.map((bullet) => (
                <li key={bullet} className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  • {bullet}
                </li>
              ))}
            </ul>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-widest text-indigo-600">Resume Matcher</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Match your resume to a job</h1>
          <p className="mt-3 text-sm text-slate-600">
            Upload your resume and paste the job description to get an ATS score and optimization tips.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="resume" className="text-sm font-medium text-slate-700">
              Resume file
            </label>
            <input
              id="resume"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(event) => setResumeFile(event.target.files?.[0] ?? null)}
              className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-700"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="jobDescription" className="text-sm font-medium text-slate-700">
              Job description
            </label>
            <textarea
              id="jobDescription"
              rows={8}
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="Paste the full job description here..."
              className="w-full rounded-lg border border-slate-300 p-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Analyzing...' : 'Analyze Resume'}
          </button>
        </form>
      </section>
    </main>
  );
}
