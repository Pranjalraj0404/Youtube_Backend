import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { registerUser, logoutUser } from '../controllers/user.controller.js';

import {upload} from "../middlewares/multer.middleware.js"

const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },{
            name: "coverImage",
            maxCount: 1
        }
    ]),
    
    registerUser);

//user logout route
router.route("/logour").post(verifyJWT, logoutUser);

export default router;