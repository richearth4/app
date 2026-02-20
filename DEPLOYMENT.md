# Deployment Guide

## 1) Deploy backend (Render + Docker)

1. Push this repository to GitHub.
2. Create a new **Render Web Service** and point it to the repo.
3. Render automatically detects `render.yaml` and builds the Docker image from `Dockerfile`.
4. Add environment variables:
   - `NODE_ENV=production`
   - `OPENAI_API_KEY=<your key>` (optional but needed for AI resume tailoring)
5. Confirm `/health` returns `200`.

## 2) Deploy frontend

The UI is implemented in `src/app/page.tsx` and expects a Next.js frontend deployment.

1. Deploy the frontend via Vercel (recommended).
2. Set environment variable:
   - `NEXT_PUBLIC_API_BASE_URL=https://<your-backend-domain>`
3. Redeploy and run one real resume analysis.

## 3) Runtime notes

- Upload endpoint accepts PDF and DOCX files up to 5MB.
- Main pipeline endpoint: `POST /documents/analyze`.
- If `OPENAI_API_KEY` is missing, analysis still works and returns a non-AI-tailored resume output.
