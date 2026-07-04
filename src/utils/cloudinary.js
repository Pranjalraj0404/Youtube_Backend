import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs'
import dotenv from "dotenv"
dotenv.config()
    // Configuration
cloudinary.config({ 
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,       api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
});
    
const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null

    const response = await cloudinary.uploader.upload(
    localFilePath, {
        resource_type: "auto"
    }
)

    console.log("file uploaded on cloudinary , sile src: " + response.url)
    //once file is uploaded , delete from server (Removes file from your server after successful upload)
    fs.unlinkSync(localFilePath)
    return response

//Error Handling
    } catch (error) {
        console.log("Error on cloudinary", error)
        fs.unlinkSync(localFilePath)
        return null
    }
}

//delete file
const deleteFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId)
        console.log("Deleted from cloudinary. Public id", publicId) // ✅ FIXED
    } catch (error) {
        console.log("Error deleting from cloudinary", error)
        return null
    }
}


export {uploadOnCloudinary, deleteFromCloudinary}