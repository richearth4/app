import { Request, Response } from 'express';

export const getExampleMessage = (_req: Request, res: Response): void => {
  res.status(200).json({
    message: 'Example route is working',
  });
};
