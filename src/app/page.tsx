'use client';

import { FormEvent, useState } from 'react';

export default function ResumeMatchPage() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

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

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Unable to submit your request. Please try again.');
      }

      setSuccessMessage('Submitted successfully. We are reviewing your match.');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Something went wrong while submitting the form.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-widest text-indigo-600">Resume Matcher</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Match your resume to a job</h1>
          <p className="mt-3 text-sm text-slate-600">
            Upload your resume and paste the job description to get a quick compatibility review.
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

          {successMessage ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </section>
    </main>
  );
}
