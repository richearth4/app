import { promises as fs } from 'fs';
import { Request, Response } from 'express';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { parseResumeText } from '../services/resumeParserService';

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
