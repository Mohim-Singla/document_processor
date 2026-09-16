import { modelMap } from '../models/index.js';

async function fetchOne(filter) {
  const query = filter?.where ? filter.where : filter;
  return modelMap.usersModel.getModel().findOne({ isDeleted: { $ne: true }, ...query }).lean();
}

async function fetchAll(filter = {}, sort = { createdAt: -1 }) {
  const query = filter?.where ? filter.where : filter;
  return modelMap.usersModel.getModel().find({ isDeleted: { $ne: true }, ...query }).sort(sort).lean();
}

async function create(userData) {
  const model = modelMap.usersModel.getModel();
  const created = await model.create({ isDeleted: false, deletedAt: null, ...userData });
  return created.toObject ? created.toObject() : created;
}

async function update(filter, updateData) {
  const query = filter?.where ? filter.where : filter;
  return modelMap.usersModel.getModel().findOneAndUpdate(
    { isDeleted: { $ne: true }, ...query },
    { $set: updateData },
    { new: true }
  ).lean();
}

async function softDelete(filter) {
  const query = filter?.where ? filter.where : filter;
  return modelMap.usersModel.getModel().updateOne(
    { isDeleted: { $ne: true }, ...query },
    { $set: { isDeleted: true, deletedAt: new Date() } }
  );
}

export const users = {
  fetchOne,
  fetchAll,
  create,
  update,
  softDelete,
};
