import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)   // FIXED: await added
        if (!user) {
            throw new ApiError(404, "User not found")
        }

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, "Error generating tokens")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    console.log("DEBUG BODY:", req.body)

    const { fullname, email, username, password } = req.body

    if ([fullname, email, username, password].some(field => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required")
    }

    const existUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existUser) {
        throw new ApiError(409, "Username or email already exists")
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path
    const coverLocalPath = req.files?.coverImage?.[0]?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    let avatar
    let coverImage

    try {
        avatar = await uploadOnCloudinary(avatarLocalPath)

        if (coverLocalPath) {
            coverImage = await uploadOnCloudinary(coverLocalPath)
        }
    } catch (error) {
        throw new ApiError(500, "Error uploading files to Cloudinary")
    }

    try {
        if (!avatar) {
            throw new ApiError(500, "Avatar file failed to upload")
        }

        const user = await User.create({
            fullname,
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
            email,
            password,
            username: username.toLowerCase()
        })

        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
        )

        if (!createdUser) {
            throw new ApiError(500, "Something went wrong while creating user")
        }

        return res
            .status(201)
            .json(new ApiResponse(201, createdUser, "User registered successfully"))
    } catch (error) {
        console.log("User creation failed. Cleaning up images...", error)

        if (avatar?.public_id) {
            await deleteFromCloudinary(avatar.public_id)
        }

        if (coverImage?.public_id) {
            await deleteFromCloudinary(coverImage.public_id)
        }

        throw new ApiError(500, "Something went wrong while creating user (Images rolled back)")
    }
})

const loginUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body   // FIXED: Email → email

    if (!username || !email || !password) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]   // FIXED
    })

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password)
    if (!isPasswordCorrect) {
        throw new ApiError(401, "Invalid credentials")
    }

    const { accessToken, refreshToken } =
        await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser, accessToken },
                "User logged in successfully"
            )
        )
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: null
            }
        },
        { new: true }
    )

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 0
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)    // FIXED
        .clearCookie("refreshToken", options)   // FIXED
        .json(
            new ApiResponse(
                200,
                null,
                "User logged out successfully"
            )
        )
})

const refreshTokens = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Refresh token is required")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        const user = await User.findById(decodedToken?._id) // FIXED

        if (!user || user.refreshToken !== incomingRefreshToken) {
            throw new ApiError(403, "Invalid refresh token")
        }

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        }

        const {
            accessToken,
            refreshToken: newRefreshToken
        } = await generateAccessAndRefreshToken(user._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Tokens refreshed successfully"
                )
            )
    } catch (error) {
        throw new ApiError(403, "Invalid or expired refresh token")
    }
})

const changecurrentUserPassword = asyncHandler(async (req, res) => {
    // Implementation for changing current user's password
    const { oldPassword, newPassword } = req.body;

   const user =  await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Old password is incorrect");
    }
    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res.status(200).json(new ApiResponse(200, null, "Password changed successfully"));
})

const getCurretUserProfile = asyncHandler(async (req, res) => {
    // Implementation for getting current user's profile   
    return res.status(200).json(new ApiResponse(200, req.user, "Current user profile fetched successfully"));

}
)

const updateCurrentUserProfile = asyncHandler(async (req, res) => {
    // Implementation for updating current user's profile

    const { fullname, bio ,email} = req.body;

    if ( !fullname || !email){
        throw new ApiError(400, "Fullname and email are required");
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                bio,
                email
            }
        },
        { new: true, runValidators: true }
    ).select("-password -refreshToken");

    return res.status(200).json(new ApiResponse(200, updatedUser, "User profile updated successfully"));

})


const updateUserAvatar = asyncHandler(async (req, res) => {
    // Implementation for updating user profile by ID
    const avatarLocalPath =  req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(500, "Avatar upload failed");
    }
    
    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true, runValidators: true }
    ).select("-password -refreshToken");

    return res.status(200).json(new ApiResponse(200, updatedUser, "User avatar updated successfully"));
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    // Implementation for updating user cover image by ID
    const coverLocalPath =  req.file?.path  
    if (!coverLocalPath) {
        throw new ApiError(400, "Cover image file is missing");
    }
    const coverImage = await uploadOnCloudinary(coverLocalPath)

    if (!coverImage.url) {
        throw new ApiError(500, "Cover image upload failed");
    }
    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true, runValidators: true }
    ).select("-password -refreshToken");

    return res.status(200).json(new ApiResponse(200, updatedUser, "User cover image updated successfully"));

})

export {
    registerUser,
    loginUser,
    refreshTokens,
    logoutUser,
    changecurrentUserPassword,
    getCurretUserProfile,
    updateCurrentUserProfile,
    updateUserAvatar,
    updateUserCoverImage,
    
}
