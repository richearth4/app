import { Router } from 'express';
import { getExampleMessage } from '../controllers/exampleController';

const exampleRouter = Router();

exampleRouter.get('/', getExampleMessage);

export default exampleRouter;
