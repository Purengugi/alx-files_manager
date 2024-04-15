import { ObjectID } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import mime from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

async function postUpload(request, response) {
  const token = request.header('X-Token');
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  if (!userId) {
    return response.status(401).json({ error: 'Unauthorized' });
  }
  const {
    name, type, parentId = 0, isPublic = false, data,
  } = request.body;
  if (!name) {
    return response.status(400).json({ error: 'Missing name' });
  }
  if (!type) {
    return response.status(400).json({ error: 'Missing type' });
  }
  if (!data && type !== 'folder') {
    return response.status(400).json({ error: 'Missing data' });
  }
  const file = {
    name,
    type,
    userId,
    parentId,
    isPublic,
  };
  const files = dbClient.dbClient.collection('files');
  if (parentId) {
    const idObject = ObjectID(parentId);
    const parentFolder = await files.findOne({ _id: idObject });
    if (!parentFolder) {
      return response.status(400).json({ error: 'Parent not found' });
    } if (parentFolder.type !== 'folder') {
      return response.status(400).json({ error: 'Parent is not a folder' });
    }
  }
  if (type === 'folder') {
    const result = await files.insertOne(file);
    const [{
      name, _id, isPublic, userId, type, parentId,
    }] = result.ops;
    return response.status(201).json({
      id: _id.toString(),
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }
  const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
  await fs.promises.mkdir(folderPath, { recursive: true });
  const filePath = `${folderPath}/${uuidv4()}`;
  await fs.promises.writeFile(filePath, Buffer.from(data, 'base64'));
  file.localPath = filePath;
  if (type !== 'folder') {
    const result = await files.insertOne(file);
    const [{
      name, _id, isPublic, userId, type, parentId,
    }] = result.ops;
    return response.status(201).json({
      id: _id.toString(),
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }
  return response.status(400).json({ error: 'Invalid request' });
}

async function getIndex(request, response) {
  const token = request.header('X-Token');
  const key = `auth_${token}`;
  const user = await redisClient.get(key);
  if (!user) {
    return response.status(401).json({ error: 'Unauthorized' });
  }
  const { parentId, page = 0 } = request.query;
  const files = dbClient.dbClient.collection('files');
  let query;
  if (!parentId) {
    query = { userId: ObjectID(user) };
  } else {
    query = { parentId: ObjectID(parentId), userId: ObjectID(user) };
  }
  console.log(query);
  const result = await files.aggregate([
    { $match: query },
    { $skip: parseInt(page, 10) * 20 },
    { $limit: 20 },
  ]).toArray();
  const newArray = result.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
  return response.status(200).json(newArray);
}

async function getShow(request, response) {
  const token = request.header('X-Token');
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  if (!userId) {
    return response.status(401).json({ error: 'Unauthorized' });
  }
  const { id } = request.params;
  const files = dbClient.dbClient.collection('files');
  const objectId = new ObjectID(id);
  const objectId2 = new ObjectID(userId);
  const file = await files.findOne({ _id: objectId, userId: objectId2 });
  if (!file) {
    return response.status(404).json({ error: 'Not found' });
  }
  return response.status(200).json(file);
}

async function putPublish(request, response) {
  const token = request.header('X-Token');
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  if (!userId) {
    return response.status(401).json({ error: 'Unauthorized' });
  }
  const { id } = request.params;
  const files = dbClient.dbClient.collection('files');
  const objectId = new ObjectID(id);
  const objectId2 = new ObjectID(userId);
  const file = await files.findOne({ _id: objectId, userId: objectId2 });
  if (!file) {
    return response.status(404).json({ error: 'Not found' });
  }
  file.isPublic = true;
  return response.json(file);
}

async function putUnpublish(request, response) {
  const token = request.header('X-Token');
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  if (!userId) {
    return response.status(401).json({ error: 'Unauthorized' });
  }
  const { id } = request.params;
  const files = dbClient.dbClient.collection('files');
  const objectId = new ObjectID(id);
  const objectId2 = new ObjectID(userId);
  const file = await files.findOne({ _id: objectId, userId: objectId2 });
  if (!file) {
    return response.status(404).json({ error: 'Not found' });
  }
  file.isPublic = false;
  return response.json(file);
}

async function getFile(request, response) {
  const { id } = request.params;
  const files = dbClient.dbClient.collection('files');
  const objectId = new ObjectID(id);
  const file = await files.findOne({ _id: objectId });
  if (!file) {
    return response.status(404).json({ error: 'Not found' });
  }
  const token = request.header('X-Token');
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);

  if (!file.isPublic && (!userId || file.userId.toString() !== userId)) {
    return response.status(404).json({ error: 'Not found' });
  }

  if (file.type === 'folder') {
    return response.status(400).json({ error: "A folder doesn't have content" });
  }

  fs.stat(file.localPath, (err) => {
    if (err) {
      response.status(404).json({ error: 'Not found' });
    }
  });

  const mimeType = mime.lookup(file.name);
  response.setHeader('Content-Type', mimeType);
  const fileData = (await fs.promises.readFile(file.localPath));
  return response.status(200).send(fileData);
}

module.exports = {
  postUpload, getIndex, getShow, putPublish, putUnpublish, getFile,
};
