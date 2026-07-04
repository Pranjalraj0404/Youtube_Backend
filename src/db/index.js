import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";


const connectDB = async () => {
  try {

    // Debugging line:
    console.log("CONNECTING TO:", `${process.env.MONGODB_URL}/${DB_NAME}`);
    
    const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)

    console.log("Connected to the database successfully");

    }catch (error) {
     console.error("Error connecting to the database:", error); 
     process.exit(1);
    }
     }

export { connectDB };