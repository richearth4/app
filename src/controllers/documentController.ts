import { promises as fs } from 'fs';
import { Request, Response } from 'express';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { StructuredJobDescription } from '../services/jobDescriptionParserService';
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
