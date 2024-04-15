import { Router } from 'express';
import AppController from '../controllers/AppController';

const { postNew, getMe } = require('../controllers/UsersController');
const { getConnect, getDisconnect } = require('../controllers/AuthController');

const {
  postUpload, getShow, getIndex, putPublish, putUnpublish, getFile,
} = require('../controllers/FilesController');

const router = Router();

router.get('/status', AppController.getStatus);

router.get('/stats', AppController.getStats);

router.post('/users', postNew);

router.get('/connect', getConnect);

router.get('/disconnect', getDisconnect);

router.get('/users/me', getMe);

router.post('/files', postUpload);

router.get('/files/:id', getShow);

router.get('/files', getIndex);

router.put('/files/:id/publish', putPublish);

router.put('/files/:id/unpublish', putUnpublish);

router.get('/files/:id/data', getFile);

module.exports = router;
