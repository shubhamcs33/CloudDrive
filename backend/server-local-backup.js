const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

const MONGO_URI = "mongodb://127.0.0.1:27017/clouddrive";

const UPLOAD_DIR = path.join(__dirname, "uploads");
const VERSION_DIR = path.join(__dirname, "versions");

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

if (!fs.existsSync(VERSION_DIR)) {
    fs.mkdirSync(VERSION_DIR, { recursive: true });
}

app.use("/uploads", express.static(UPLOAD_DIR));


/* =========================================================
   MULTER
========================================================= */

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },

    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
        );

        const uniqueName = `${Date.now()}-${safeName}`;

        cb(null, uniqueName);
    }
});

const upload = multer({
    storage
});


/* =========================================================
   DATABASE
========================================================= */

mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully.");

        app.listen(PORT, () => {
            console.log(
                `CloudDrive server running on port ${PORT}`
            );
        });
    })
    .catch((error) => {
        console.error(
            "MongoDB connection error:",
            error
        );
    });


/* =========================================================
   USER SCHEMA
========================================================= */

const userSchema = new mongoose.Schema({
    firebaseUid: {
        type: String,
        required: true,
        unique: true
    },

    email: {
        type: String,
        required: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model(
    "User",
    userSchema
);


/* =========================================================
   FILE SCHEMA
========================================================= */

const fileSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true
    },

    originalname: {
        type: String,
        required: true
    },

    size: {
        type: Number,
        required: true
    },

    mimeType: {
        type: String
    },

    uploadedAt: {
        type: Date,
        default: Date.now
    },

    ownerId: {
        type: String,
        required: true
    }
});

const FileModel = mongoose.model(
    "File",
    fileSchema
);


/* =========================================================
   FILE METADATA
========================================================= */

const fileMetadataSchema = new mongoose.Schema({
    fileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "File",
        required: true
    },

    originalName: {
        type: String,
        required: true
    },

    storedName: {
        type: String,
        required: true
    },

    fileType: {
        type: String
    },

    mimeType: {
        type: String
    },

    fileSize: {
        type: Number
    },

    extension: {
        type: String
    },

    uploadDate: {
        type: Date,
        default: Date.now
    },

    ownerId: {
        type: String,
        required: true
    },

    storagePath: {
        type: String
    }
});

const FileMetadata = mongoose.model(
    "FileMetadata",
    fileMetadataSchema
);


/* =========================================================
   VERSION SCHEMA
========================================================= */

const versionSchema = new mongoose.Schema({
    fileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "File",
        required: true
    },

    ownerId: {
        type: String,
        required: true
    },

    originalName: {
        type: String,
        required: true
    },

    storedName: {
        type: String,
        required: true
    },

    versionNumber: {
        type: Number,
        required: true
    },

    size: {
        type: Number,
        required: true
    },

    mimeType: {
        type: String
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

versionSchema.index(
    {
        fileId: 1,
        versionNumber: 1
    },
    {
        unique: true
    }
);

const FileVersion = mongoose.model(
    "FileVersion",
    versionSchema
);


/* =========================================================
   FOLDER SCHEMA
========================================================= */

const folderSchema = new mongoose.Schema({
    folderName: {
        type: String,
        required: true
    },

    ownerId: {
        type: String,
        required: true
    },

    parentFolder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Folder",
        default: null
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Folder = mongoose.model(
    "Folder",
    folderSchema
);


/* =========================================================
   PERMISSION SCHEMA
========================================================= */

const permissionSchema = new mongoose.Schema({
    fileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "File",
        required: true
    },

    ownerId: {
        type: String,
        required: true
    },

    sharedWithUid: {
        type: String,
        required: true
    },

    sharedWithEmail: {
        type: String,
        required: true
    },

    permission: {
        type: String,
        enum: ["viewer", "editor"],
        default: "viewer"
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

permissionSchema.index(
    {
        fileId: 1,
        sharedWithUid: 1
    },
    {
        unique: true
    }
);

const Permission = mongoose.model(
    "Permission",
    permissionSchema
);


/* =========================================================
   HOME
========================================================= */

app.get("/", (req, res) => {
    res.json({
        message: "CloudDrive API is running."
    });
});


/* =========================================================
   HEALTH
========================================================= */

app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    });
});


/* =========================================================
   USERS
========================================================= */

app.post("/users", async (req, res) => {
    try {
        const {
            firebaseUid,
            email
        } = req.body;

        if (!firebaseUid || !email) {
            return res.status(400).json({
                message:
                    "firebaseUid and email are required."
            });
        }

        const user = await User.findOneAndUpdate(
            {
                firebaseUid
            },
            {
                firebaseUid,
                email
            },
            {
                new: true,
                upsert: true
            }
        );

        res.json(user);

    } catch (error) {
        console.error(
            "User error:",
            error
        );

        res.status(500).json({
            message:
                "Could not create user."
        });
    }
});


app.get(
    "/users/:firebaseUid",
    async (req, res) => {
        try {
            const user = await User.findOne({
                firebaseUid:
                    req.params.firebaseUid
            });

            if (!user) {
                return res.status(404).json({
                    message:
                        "User not found."
                });
            }

            res.json(user);

        } catch (error) {
            console.error(
                "Get user error:",
                error
            );

            res.status(500).json({
                message:
                    "Could not get user."
            });
        }
    }
);


/* =========================================================
   GET USER FILES
========================================================= */

app.get("/files", async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                message:
                    "userId is required."
            });
        }

        const files = await FileModel
            .find({
                ownerId: userId
            })
            .sort({
                uploadedAt: -1
            });

        res.json(files);

    } catch (error) {
        console.error(
            "Get files error:",
            error
        );

        res.status(500).json({
            message:
                "Could not load files."
        });
    }
});


/* =========================================================
   UPLOAD
========================================================= */

app.post(
    "/upload",
    upload.single("file"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    message:
                        "No file was uploaded."
                });
            }

            const ownerId = req.body.userId;

            if (!ownerId) {
                fs.unlinkSync(req.file.path);

                return res.status(400).json({
                    message:
                        "userId is required."
                });
            }

            const newFile =
                await FileModel.create({
                    filename:
                        req.file.filename,

                    originalname:
                        req.file.originalname,

                    size:
                        req.file.size,

                    mimeType:
                        req.file.mimetype,

                    ownerId
                });

            const extension =
                path.extname(
                    req.file.originalname
                );

            await FileMetadata.create({
                fileId:
                    newFile._id,

                originalName:
                    req.file.originalname,

                storedName:
                    req.file.filename,

                fileType:
                    extension
                        .replace(".", "")
                        .toLowerCase(),

                mimeType:
                    req.file.mimetype,

                fileSize:
                    req.file.size,

                extension,

                ownerId,

                storagePath:
                    req.file.path
            });

            console.log(
                "File uploaded:",
                req.file.filename
            );

            res.json({
                message:
                    "File uploaded successfully.",

                file: {
                    id:
                        newFile._id,

                    filename:
                        newFile.filename,

                    originalname:
                        newFile.originalname,

                    size:
                        newFile.size,

                    mimeType:
                        newFile.mimeType,

                    uploadedAt:
                        newFile.uploadedAt
                }
            });

        } catch (error) {
            console.error(
                "Upload error:",
                error
            );

            if (
                req.file &&
                fs.existsSync(req.file.path)
            ) {
                fs.unlinkSync(req.file.path);
            }

            res.status(500).json({
                message:
                    "Could not upload file."
            });
        }
    }
);


/* =========================================================
   REPLACE FILE — VERSION CONTROL
========================================================= */

app.put(
    "/files/:filename",
    upload.single("file"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    message:
                        "No replacement file was uploaded."
                });
            }

            const filename =
                req.params.filename;

            const ownerId =
                req.body.userId;

            if (!ownerId) {
                fs.unlinkSync(req.file.path);

                return res.status(400).json({
                    message:
                        "userId is required."
                });
            }

            const existingFile =
                await FileModel.findOne({
                    filename,
                    ownerId
                });

            if (!existingFile) {
                fs.unlinkSync(req.file.path);

                return res.status(404).json({
                    message:
                        "File not found."
                });
            }

            const oldFilePath =
                path.join(
                    UPLOAD_DIR,
                    existingFile.filename
                );

            if (
                !fs.existsSync(oldFilePath)
            ) {
                fs.unlinkSync(req.file.path);

                return res.status(404).json({
                    message:
                        "Existing file is missing."
                });
            }

            const latestVersion =
                await FileVersion
                    .findOne({
                        fileId:
                            existingFile._id
                    })
                    .sort({
                        versionNumber: -1
                    });

            const nextVersion =
                latestVersion
                    ? latestVersion.versionNumber + 1
                    : 1;

            const safeName =
                existingFile.originalname
                    .replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );

            const versionFilename =
                `${Date.now()}-v${nextVersion}-${safeName}`;

            const versionPath =
                path.join(
                    VERSION_DIR,
                    versionFilename
                );

            fs.copyFileSync(
                oldFilePath,
                versionPath
            );

            await FileVersion.create({
                fileId:
                    existingFile._id,

                ownerId,

                originalName:
                    existingFile.originalname,

                storedName:
                    versionFilename,

                versionNumber:
                    nextVersion,

                size:
                    existingFile.size,

                mimeType:
                    existingFile.mimeType
            });

            fs.unlinkSync(oldFilePath);

            fs.renameSync(
                req.file.path,
                oldFilePath
            );

            existingFile.originalname =
                req.file.originalname;

            existingFile.size =
                req.file.size;

            existingFile.mimeType =
                req.file.mimetype;

            existingFile.uploadedAt =
                new Date();

            await existingFile.save();

            await FileMetadata.findOneAndUpdate(
                {
                    fileId:
                        existingFile._id
                },
                {
                    originalName:
                        req.file.originalname,

                    fileType:
                        path.extname(
                            req.file.originalname
                        )
                            .replace(
                                ".",
                                ""
                            )
                            .toLowerCase(),

                    mimeType:
                        req.file.mimetype,

                    fileSize:
                        req.file.size,

                    extension:
                        path.extname(
                            req.file.originalname
                        ),

                    uploadDate:
                        new Date(),

                    storagePath:
                        oldFilePath
                }
            );

            console.log(
                `File replaced. Previous version saved as V${nextVersion}.`
            );

            res.json({
                message:
                    "File replaced successfully. Previous version saved.",

                version:
                    nextVersion,

                file: {
                    filename:
                        existingFile.filename,

                    originalname:
                        existingFile.originalname,

                    size:
                        existingFile.size,

                    uploadedAt:
                        existingFile.uploadedAt
                }
            });

        } catch (error) {
            console.error(
                "Replace file error:",
                error
            );

            if (
                req.file &&
                fs.existsSync(req.file.path)
            ) {
                fs.unlinkSync(req.file.path);
            }

            res.status(500).json({
                message:
                    "Could not replace file."
            });
        }
    }
);


/* =========================================================
   GET FILE VERSIONS
========================================================= */

app.get(
    "/versions/:filename",
    async (req, res) => {
        try {
            const { userId } =
                req.query;

            if (!userId) {
                return res.status(400).json({
                    message:
                        "userId is required."
                });
            }

            const file =
                await FileModel.findOne({
                    filename:
                        req.params.filename,

                    ownerId:
                        userId
                });

            if (!file) {
                return res.status(404).json({
                    message:
                        "File not found."
                });
            }

            const versions =
                await FileVersion
                    .find({
                        fileId:
                            file._id
                    })
                    .sort({
                        versionNumber: -1
                    });

            res.json(versions);

        } catch (error) {
            console.error(
                "Get versions error:",
                error
            );

            res.status(500).json({
                message:
                    "Could not load file versions."
            });
        }
    }
);


/* =========================================================
   DOWNLOAD VERSION
========================================================= */

app.get(
    "/versions/download/:id",
    async (req, res) => {
        try {
            const version =
                await FileVersion.findById(
                    req.params.id
                );

            if (!version) {
                return res.status(404).json({
                    message:
                        "Version not found."
                });
            }

            const versionPath =
                path.join(
                    VERSION_DIR,
                    version.storedName
                );

            if (
                !fs.existsSync(versionPath)
            ) {
                return res.status(404).json({
                    message:
                        "Version file not found."
                });
            }

            res.download(
                versionPath,
                version.originalName
            );

        } catch (error) {
            console.error(
                "Version download error:",
                error
            );

            res.status(500).json({
                message:
                    "Could not download version."
            });
        }
    }
);


/* =========================================================
   DOWNLOAD CURRENT FILE
========================================================= */

app.get(
    "/download/:filename",
    async (req, res) => {
        try {
            const filename =
                req.params.filename;

            const filePath =
                path.join(
                    UPLOAD_DIR,
                    filename
                );

            if (
                !fs.existsSync(filePath)
            ) {
                return res.status(404).json({
                    message:
                        "File not found."
                });
            }

            res.download(
                filePath,
                filename
            );

        } catch (error) {
            console.error(
                "Download error:",
                error
            );

            res.status(500).json({
                message:
                    "Could not download file."
            });
        }
    }
);


/* =========================================================
   DELETE FILE
========================================================= */

app.delete(
    "/delete/:filename",
    async (req, res) => {
        try {
            const filename =
                req.params.filename;

            const file =
                await FileModel.findOne({
                    filename
                });

            const filePath =
                path.join(
                    UPLOAD_DIR,
                    filename
                );

            if (
                !fs.existsSync(filePath)
            ) {
                return res.status(404).json({
                    message:
                        "File not found."
                });
            }

            fs.unlinkSync(filePath);

            if (file) {
                await FileVersion.deleteMany({
                    fileId:
                        file._id
                });

                await FileMetadata.deleteMany({
                    fileId:
                        file._id
                });

                await Permission.deleteMany({
                    fileId:
                        file._id
                });

                await FileModel.deleteOne({
                    _id:
                        file._id
                });
            }

            console.log(
                "File deleted:",
                filename
            );

            res.json({
                message:
                    "File deleted successfully."
            });

        } catch (error) {
            console.error(
                "Delete error:",
                error
            );

            res.status(500).json({
                message:
                    "Could not delete file."
            });
        }
    }
);


/* =========================================================
   CREATE FOLDER
========================================================= */

app.post(
    "/folders",
    async (req, res) => {
        try {
            const {
                folderName,
                ownerId,
                parentFolder
            } = req.body;

            if (!folderName || !ownerId) {
                return res.status(400).json({
                    message:
                        "folderName and ownerId are required."
                });
            }

            const folder =
                await Folder.create({
                    folderName:
                        folderName.trim(),

                    ownerId,

                    parentFolder:
                        parentFolder || null
                });

            res.json({
                message:
                    "Folder created successfully.",

                folder
            });

        } catch (error) {
            console.error(
                "Create folder error:",
                error
            );

            res.status(500).json({
                message:
                    "Could not create folder."
            });
        }
    }
);


/* =========================================================
   GET FOLDERS
========================================================= */

app.get(
    "/folders",
    async (req, res) => {
        try {
            const {
                userId,
                parentFolder
            } = req.query;

            if (!userId) {
                return res.status(400).json({
                    message:
                        "userId is required."
                });
            }

            const query = {
                ownerId:
                    userId
            };

            if (parentFolder) {
                query.parentFolder =
                    parentFolder;
            } else {
                query.parentFolder =
                    null;
            }

            const folders =
                await Folder
                    .find(query)
                    .sort({
                        createdAt: -1
                    });

            res.json(folders);

        } catch (error) {
            console.error(
                "Get folders error:",
                error
            );

            res.status(500).json({
                message:
                    "Could not load folders."
            });
        }
    }
);


/* =========================================================
   DELETE FOLDER
========================================================= */

app.delete(
    "/folders/:id",
    async (req, res) => {
        try {
            const folder =
                await Folder.findById(
                    req.params.id
                );

            if (!folder) {
                return res.status(404).json({
                    message:
                        "Folder not found."
                });
            }

            await Folder.deleteOne({
                _id:
                    req.params.id
            });

            res.json({
                message:
                    "Folder deleted successfully."
            });

        } catch (error) {
            console.error(
                "Delete folder error:",
                error
            );

            res.status(500).json({
                message:
                    "Could not delete folder."
            });
        }
    }
);


/* =========================================================
   SHARE FILE
========================================================= */

app.post(
    "/share",
    async (req, res) => {
        try {
            const {
                filename,
                ownerId,
                sharedWithEmail,
                permission
            } = req.body;

            if (
                !filename ||
                !ownerId ||
                !sharedWithEmail
            ) {
                return res.status(400).json({
                    message:
                        "filename, ownerId and sharedWithEmail are required."
                });
            }

            const file =
                await FileModel.findOne({
                    filename,
                    ownerId
                });

            if (!file) {
                return res.status(404).json({
                    message:
                        "File not found or you are not the owner."
                });
            }

            const recipient =
                await User.findOne({
                    email:
                        sharedWithEmail
                            .trim()
                            .toLowerCase()
                });

            if (!recipient) {
                return res.status(404).json({
                    message:
                        "Recipient user does not exist."
                });
            }

            if (
                recipient.firebaseUid ===
                ownerId
            ) {
                return res.status(400).json({
                    message:
                        "You cannot share a file with yourself."
                });
            }

            const validPermission =
                permission === "editor"
                    ? "editor"
                    : "viewer";

            const share =
                await Permission.findOneAndUpdate(
                    {
                        fileId:
                            file._id,

                        sharedWithUid:
                            recipient.firebaseUid
                    },
                    {
                        fileId:
                            file._id,

                        ownerId,

                        sharedWithUid:
                            recipient.firebaseUid,

                        sharedWithEmail:
                            recipient.email,

                        permission:
                            validPermission
                    },
                    {
                        new: true,
                        upsert: true
                    }
                );

            res.json({
                message:
                    "File shared successfully.",

                share
            });

        } catch (error) {
            console.error(
                "Share error:",
                error
            );

            res.status(500).json({
                message:
                    "Could not share file."
            });
        }
    }
);


/* =========================================================
   GET FILE SHARES
========================================================= */

app.get(
    "/shares",
    async (req, res) => {
        try {
            const {
                fileId
            } = req.query;

            if (!fileId) {
                return res.status(400).json({
                    message:
                        "fileId is required."
                });
            }

            const shares =
                await Permission
                    .find({
                        fileId
                    })
                    .sort({
                        createdAt: -1
                    });

            res.json(shares);

        } catch (error) {
            console.error(
                "Get shares error:",
                error
            );

            res.status(500).json({
                message:
                    "Could not load shares."
            });
        }
    }
);


/* =========================================================
   GET SHARED FILES
========================================================= */

app.get(
    "/shared-files",
    async (req, res) => {
        try {
            const {
                userId
            } = req.query;

            if (!userId) {
                return res.status(400).json({
                    message:
                        "userId is required."
                });
            }

            const permissions =
                await Permission
                    .find({
                        sharedWithUid:
                            userId
                    })
                    .populate("fileId")
                    .sort({
                        createdAt: -1
                    });

            const result =
                permissions.map(
                    (permission) => ({
                        _id:
                            permission._id,

                        permission:
                            permission.permission,

                        ownerId:
                            permission.ownerId,

                        sharedWithEmail:
                            permission.sharedWithEmail,

                        createdAt:
                            permission.createdAt,

                        file:
                            permission.fileId
                    })
                );

            res.json(result);

        } catch (error) {
            console.error(
                "Shared files error:",
                error
            );

            res.status(500).json({
                message:
                    "Could not load shared files."
            });
        }
    }
);


/* =========================================================
   REMOVE SHARE
========================================================= */

app.delete(
    "/share/:id",
    async (req, res) => {
        try {
            const share =
                await Permission.findById(
                    req.params.id
                );

            if (!share) {
                return res.status(404).json({
                    message:
                        "Share permission not found."
                });
            }

            await Permission.deleteOne({
                _id:
                    req.params.id
            });

            res.json({
                message:
                    "Share permission removed."
            });

        } catch (error) {
            console.error(
                "Remove share error:",
                error
            );

            res.status(500).json({
                message:
                    "Could not remove share."
            });
        }
    }
);
