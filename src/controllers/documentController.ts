import { promises as fs } from 'fs';
import { Request, Response } from 'express';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import {
  parseJobDescriptionText,
  StructuredJobDescription,
} from '../services/jobDescriptionParserService';
import { tailorResumeToJobDescription } from '../services/openAiIntegrationService';
import { parseResumeText } from '../services/resumeParserService';
import { StructuredResume } from '../services/resumeParserService';
import { scoreResumeAgainstJob } from '../services/scoringService';

const extractTextFromPdf = async (filePath: string): Promise<string> => {
  const fileBuffer = await fs.readFile(filePath);
  const result = await pdfParse(fileBuffer);
  return result.text.trim();
};

const extractTextFromDocx = async (filePath: string): Promise<string> => {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value.trim();
};

export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  const { path: filePath, mimetype, originalname } = req.file;

  try {
    const extractedText =
      mimetype === 'application/pdf'
        ? await extractTextFromPdf(filePath)
        : await extractTextFromDocx(filePath);

    res.status(200).json({
      fileName: originalname,
      text: extractedText,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to extract text from document',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await fs.unlink(filePath).catch(() => undefined);
  }
};

export const structureResumeText = (req: Request, res: Response): void => {
  const { text } = req.body as { text?: unknown };

  if (typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ message: 'A non-empty text string is required' });
    return;
  }

  const structuredResume = parseResumeText(text);

  res.status(200).json(structuredResume);
};

export const structureJobDescriptionText = (req: Request, res: Response): void => {
  const { text } = req.body as { text?: unknown };

  if (typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ message: 'A non-empty text string is required' });
    return;
  }

  const structuredJobDescription = parseJobDescriptionText(text);

  res.status(200).json(structuredJobDescription);
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isStructuredResume = (value: unknown): value is StructuredResume => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as StructuredResume;

  return (
    typeof candidate.summary === 'string' &&
    isStringArray(candidate.workExperience) &&
    isStringArray(candidate.skills) &&
    isStringArray(candidate.education) &&
    isStringArray(candidate.certifications)
  );
};

const isStructuredJobDescription = (value: unknown): value is StructuredJobDescription => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as StructuredJobDescription;

  return (
    isStringArray(candidate.requiredSkills) &&
    isStringArray(candidate.responsibilities) &&
    typeof candidate.seniorityLevel === 'string' &&
    isStringArray(candidate.keyPhrases)
  );
};

export const scoreResume = (req: Request, res: Response): void => {
  const { resume, jobDescription } = req.body as {
    resume?: unknown;
    jobDescription?: unknown;
  };

  if (!isStructuredResume(resume) || !isStructuredJobDescription(jobDescription)) {
    res.status(400).json({
      message:
        'Payload must include valid structured `resume` and `jobDescription` JSON objects.',
    });
    return;
  }

  const result = scoreResumeAgainstJob(resume, jobDescription);
  res.status(200).json(result);
};

export const tailorResume = async (req: Request, res: Response): Promise<void> => {
  const { resume, jobDescription } = req.body as {
    resume?: unknown;
    jobDescription?: unknown;
  };

  if (!isStructuredResume(resume) || !isStructuredJobDescription(jobDescription)) {
    res.status(400).json({
      message:
        'Payload must include valid structured `resume` and `jobDescription` JSON objects.',
    });
    return;
  }

  try {
    const updatedResume = await tailorResumeToJobDescription(resume, jobDescription);
    res.status(200).json(updatedResume);
  } catch (error) {
    res.status(502).json({
      message: 'Failed to tailor resume to the job description.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const analyzeResumeAgainstJob = async (req: Request, res: Response): Promise<void> => {
  const { jobDescription } = req.body as { jobDescription?: unknown };

  if (!req.file) {
    res.status(400).json({ message: 'No resume file uploaded.' });
    return;
  }

  if (typeof jobDescription !== 'string' || jobDescription.trim().length === 0) {
    res.status(400).json({ message: 'A non-empty jobDescription field is required.' });
    return;
  }

  const { path: filePath, mimetype, originalname } = req.file;

  try {
    const extractedResumeText =
      mimetype === 'application/pdf'
        ? await extractTextFromPdf(filePath)
        : await extractTextFromDocx(filePath);

    const structuredResume = parseResumeText(extractedResumeText);
    const structuredJobDescription = parseJobDescriptionText(jobDescription);
    const scoreResult = scoreResumeAgainstJob(structuredResume, structuredJobDescription);

    const optimizedResume = process.env.OPENAI_API_KEY
      ? await tailorResumeToJobDescription(structuredResume, structuredJobDescription)
      : structuredResume;

    const optimizedResumeText = [
      optimizedResume.summary,
      ...optimizedResume.workExperience,
      ...optimizedResume.skills,
      ...optimizedResume.education,
      ...optimizedResume.certifications,
    ]
      .filter((line) => line.trim().length > 0)
      .join('\n');

    res.status(200).json({
      fileName: originalname,
      structuredResume,
      structuredJobDescription,
      atsScore: scoreResult.score,
      matchedKeywords: scoreResult.matchedKeywords,
      missingKeywords: scoreResult.missingKeywords,
      suggestedBulletImprovements: scoreResult.improvementSuggestions,
      optimizedResume,
      optimizedResumeText,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to analyze resume against the job description.',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await fs.unlink(filePath).catch(() => undefined);
  }
};
