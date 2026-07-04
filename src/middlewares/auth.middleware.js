import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const verifyJWT = asyncHandler(async (req, res, next) => {
  const token = req.cookies.accessToken || req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return next(new ApiError('Authentication token is missing', 401));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decodedToken?._id).select('-password -refeshTokens')

if (!user) {
      return next(new ApiError('User not found', 404));

    req.user = user;
    next();
    }

  } catch (error) {
    throw new ApiError('Invalid authentication token', 401);
  }
  
});

