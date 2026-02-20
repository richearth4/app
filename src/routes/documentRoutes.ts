import { randomUUID } from 'crypto';
import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import {
  scoreResume,
  structureResumeText,
  tailorResume,
  uploadDocument,
} from '../controllers/documentController';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const storage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname);
    cb(null, `${randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Only PDF and DOCX files are allowed'));
      return;
    }

    cb(null, true);
  },
});

const documentRouter = Router();

documentRouter.post('/upload', (req, res) => {
  upload.single('file')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ message: 'File size exceeds 5MB limit' });
        return;
      }

      res.status(400).json({ message: error.message });
      return;
    }

    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
      return;
    }

    void uploadDocument(req, res);
  });
});

documentRouter.post('/structure', structureResumeText);
documentRouter.post('/score', scoreResume);
documentRouter.post('/tailor', (req, res) => {
  void tailorResume(req, res);
});

export default documentRouter;
