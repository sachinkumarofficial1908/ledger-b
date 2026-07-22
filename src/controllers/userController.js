import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const [users, total] = await Promise.all([
    User.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(),
  ]);

  res.json({
    success: true,
    data: users,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, assignedClients } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new ApiError(409, "A user with this email already exists.");

  const user = await User.create({
    name,
    email,
    password,
    role: role || "admin",
    assignedClients: assignedClients || [],
  });

  res.status(201).json({ success: true, data: user });
});

export const updateUser = asyncHandler(async (req, res) => {
  const { name, role, isActive, assignedClients } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found.");

  if (name !== undefined) user.name = name;
  if (role !== undefined) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;
  if (assignedClients !== undefined) user.assignedClients = assignedClients;

  await user.save();
  res.json({ success: true, data: user });
});

export const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    throw new ApiError(400, "You can't delete your own account.");
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new ApiError(404, "User not found.");
  res.json({ success: true, message: "User removed." });
});
