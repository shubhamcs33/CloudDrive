const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    CopyObjectCommand,
    HeadObjectCommand
} = require("@aws-sdk/client-s3");

dotenv.config();

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

const MONGO_URI =
    process.env.MONGO_URI;

/* =========================================================
   AWS S3
========================================================= */

const AWS_REGION =
    process.env.AWS_REGION || "ap-southeast-2";

const AWS_S3_BUCKET =
    process.env.AWS_S3_BUCKET;

if (!AWS_S3_BUCKET) {
    console.error(
        "AWS_S3_BUCKET is missing in .env"
    );

    process.exit(1);
}

const s3 = new S3Client({
    region: AWS_REGION
});

/* =========================================================
   LOCAL TEMP DIRECTORIES
========================================================= */

const UPLOAD_DIR =
    path.join(__dirname, "uploads");

const VERSION_DIR =
    path.join(__dirname, "versions");

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(
        UPLOAD_DIR,
        {
            recursive: true
        }
    );
}

if (!fs.existsSync(VERSION_DIR)) {
    fs.mkdirSync(
        VERSION_DIR,
        {
            recursive: true
        }
    );
}

/*
   These folders are now only used temporarily
   while multer receives the file.

   Permanent file storage = AWS S3.
*/

app.use(
    "/uploads",
    express.static(UPLOAD_DIR)
);


/* =========================================================
   MULTER
========================================================= */

const storage =
    multer.diskStorage({
        destination: (
            req,
            file,
            cb
        ) => {
            cb(
                null,
                UPLOAD_DIR
            );
        },

        filename: (
            req,
            file,
            cb
        ) => {

            const safeName =
                file.originalname.replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                );

            const uniqueName =
                `${Date.now()}-${safeName}`;

            cb(
                null,
                uniqueName
            );
        }
    });

const upload =
    multer({
        storage
    });


/* =========================================================
   DATABASE
========================================================= */

mongoose
    .connect(MONGO_URI)
    .then(() => {

        console.log(
            "MongoDB connected successfully."
        );

        app.listen(
            PORT,
            () => {

                console.log(
                    `CloudDrive server running on port ${PORT}`
                );

            }
        );
    })
    .catch(
        (error) => {

            console.error(
                "MongoDB connection error:",
                error
            );

        }
    );


/* =========================================================
   USER SCHEMA
========================================================= */

const userSchema =
    new mongoose.Schema({

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

const User =
    mongoose.model(
        "User",
        userSchema
    );


/* =========================================================
   FILE SCHEMA
========================================================= */

const fileSchema =
    new mongoose.Schema({

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

const FileModel =
    mongoose.model(
        "File",
        fileSchema
    );


/* =========================================================
   FILE METADATA
========================================================= */

const fileMetadataSchema =
    new mongoose.Schema({

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

const FileMetadata =
    mongoose.model(
        "FileMetadata",
        fileMetadataSchema
    );


/* =========================================================
   VERSION SCHEMA
========================================================= */

const versionSchema =
    new mongoose.Schema({

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

const FileVersion =
    mongoose.model(
        "FileVersion",
        versionSchema
    );


/* =========================================================
   FOLDER SCHEMA
========================================================= */

const folderSchema =
    new mongoose.Schema({

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

const Folder =
    mongoose.model(
        "Folder",
        folderSchema
    );


/* =========================================================
   PERMISSION SCHEMA
========================================================= */

const permissionSchema =
    new mongoose.Schema({

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
            enum: [
                "viewer",
                "editor"
            ],
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

const Permission =
    mongoose.model(
        "Permission",
        permissionSchema
    );


/* =========================================================
   HOME
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.json({
            message:
                "CloudDrive API is running."
        });

    }
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/health",
    (req, res) => {

        res.json({
            status: "ok"
        });

    }
);


/* =========================================================
   USERS
========================================================= */

app.post(
    "/users",
    async (req, res) => {

        try {

            const {
                firebaseUid,
                email
            } = req.body;

            if (
                !firebaseUid ||
                !email
            ) {

                return res.status(400).json({
                    message:
                        "firebaseUid and email are required."
                });

            }

            const user =
                await User.findOneAndUpdate(
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

    }
);


app.get(
    "/users/:firebaseUid",
    async (req, res) => {

        try {

            const user =
                await User.findOne({
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

app.get(
    "/files",
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

            const files =
                await FileModel
                    .find({
                        ownerId:
                            userId
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

    }
);


/* =========================================================
   UPLOAD FILE → AWS S3
========================================================= */

app.post(
    "/upload",
    upload.single("file"),
    async (req, res) => {

        let uploadedToS3 =
            false;

        let s3Key =
            null;

        try {

            if (!req.file) {

                return res.status(400).json({
                    message:
                        "No file was uploaded."
                });

            }

            const ownerId =
                req.body.userId;

            if (!ownerId) {

                if (
                    fs.existsSync(
                        req.file.path
                    )
                ) {
                    fs.unlinkSync(
                        req.file.path
                    );
                }

                return res.status(400).json({
                    message:
                        "userId is required."
                });

            }

            /*
                The unique filename becomes
                the S3 object key.
            */

            s3Key =
                req.file.filename;

            await s3.send(
                new PutObjectCommand({

                    Bucket:
                        AWS_S3_BUCKET,

                    Key:
                        s3Key,

                    Body:
                        fs.createReadStream(
                            req.file.path
                        ),

                    ContentType:
                        req.file.mimetype

                })
            );

            uploadedToS3 =
                true;


            /* -----------------------------------------
               SAVE FILE INFORMATION IN MONGODB
            ----------------------------------------- */

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
                        .replace(
                            ".",
                            ""
                        )
                        .toLowerCase(),

                mimeType:
                    req.file.mimetype,

                fileSize:
                    req.file.size,

                extension,

                ownerId,

                storagePath:
                    `s3://${AWS_S3_BUCKET}/${s3Key}`

            });


            console.log(
                "File uploaded to S3:",
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


            /*
                If MongoDB fails after the S3 upload,
                remove the S3 object so we don't
                leave an orphaned file.
            */

            if (
                uploadedToS3 &&
                s3Key
            ) {

                try {

                    await s3.send(
                        new DeleteObjectCommand({

                            Bucket:
                                AWS_S3_BUCKET,

                            Key:
                                s3Key

                        })
                    );

                } catch (cleanupError) {

                    console.error(
                        "S3 cleanup error:",
                        cleanupError
                    );

                }

            }


            res.status(500).json({
                message:
                    "Could not upload file."
            });

        } finally {

            /*
                Local file is only temporary.
                Remove it after S3 upload.
            */

            if (
                req.file &&
                fs.existsSync(
                    req.file.path
                )
            ) {

                fs.unlinkSync(
                    req.file.path
                );

            }

        }

    }
);


/* =========================================================
   REPLACE FILE — VERSION CONTROL + S3
========================================================= */

app.put(
    "/files/:filename",
    upload.single("file"),
    async (req, res) => {

        let versionKey =
            null;

        let versionCreated =
            false;

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

                if (
                    fs.existsSync(
                        req.file.path
                    )
                ) {
                    fs.unlinkSync(
                        req.file.path
                    );
                }

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

                if (
                    fs.existsSync(
                        req.file.path
                    )
                ) {
                    fs.unlinkSync(
                        req.file.path
                    );
                }

                return res.status(404).json({
                    message:
                        "File not found."
                });

            }


            /*
                Confirm the current file actually
                exists in S3.
            */

            try {

                await s3.send(
                    new HeadObjectCommand({

                        Bucket:
                            AWS_S3_BUCKET,

                        Key:
                            existingFile.filename

                    })
                );

            } catch (s3Error) {

                if (
                    s3Error.name ===
                        "NotFound" ||
                    s3Error.$metadata?.httpStatusCode ===
                        404
                ) {

                    if (
                        fs.existsSync(
                            req.file.path
                        )
                    ) {
                        fs.unlinkSync(
                            req.file.path
                        );
                    }

                    return res.status(404).json({
                        message:
                            "Existing file is missing from S3."
                    });

                }

                throw s3Error;

            }


            /* -----------------------------------------
               FIND NEXT VERSION NUMBER
            ----------------------------------------- */

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


            versionKey =
                `versions/${versionFilename}`;


            /* -----------------------------------------
               COPY CURRENT S3 FILE → VERSION
            ----------------------------------------- */

            await s3.send(
                new CopyObjectCommand({

                    Bucket:
                        AWS_S3_BUCKET,

                    CopySource:
                        encodeURIComponent(
                            `${AWS_S3_BUCKET}/${existingFile.filename}`
                        ),

                    Key:
                        versionKey,

                    MetadataDirective:
                        "COPY"

                })
            );


            versionCreated =
                true;


            /* -----------------------------------------
               UPLOAD NEW CURRENT FILE
            ----------------------------------------- */

            await s3.send(
                new PutObjectCommand({

                    Bucket:
                        AWS_S3_BUCKET,

                    Key:
                        existingFile.filename,

                    Body:
                        fs.createReadStream(
                            req.file.path
                        ),

                    ContentType:
                        req.file.mimetype

                })
            );


            /* -----------------------------------------
               SAVE VERSION INFORMATION
            ----------------------------------------- */

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


            /* -----------------------------------------
               UPDATE FILE INFORMATION
            ----------------------------------------- */

            existingFile.originalname =
                req.file.originalname;

            existingFile.size =
                req.file.size;

            existingFile.mimeType =
                req.file.mimetype;

            existingFile.uploadedAt =
                new Date();


            await existingFile.save();


            /* -----------------------------------------
               UPDATE FILE METADATA
            ----------------------------------------- */

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
                        `s3://${AWS_S3_BUCKET}/${existingFile.filename}`

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


            /*
                If the version copy was created but
                replacement failed, clean it up.
            */

            if (
                versionCreated &&
                versionKey
            ) {

                try {

                    await s3.send(
                        new DeleteObjectCommand({

                            Bucket:
                                AWS_S3_BUCKET,

                            Key:
                                versionKey

                        })
                    );

                } catch (cleanupError) {

                    console.error(
                        "Version cleanup error:",
                        cleanupError
                    );

                }

            }


            res.status(500).json({
                message:
                    "Could not replace file."
            });

        } finally {

            if (
                req.file &&
                fs.existsSync(
                    req.file.path
                )
            ) {

                fs.unlinkSync(
                    req.file.path
                );

            }

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

            const {
                userId
            } = req.query;


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
   DOWNLOAD VERSION FROM S3
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


            const versionKey =
                `versions/${version.storedName}`;


            const s3Object =
                await s3.send(
                    new GetObjectCommand({

                        Bucket:
                            AWS_S3_BUCKET,

                        Key:
                            versionKey

                    })
                );


            res.setHeader(
                "Content-Type",
                version.mimeType ||
                    "application/octet-stream"
            );


            res.setHeader(
                "Content-Disposition",
                `attachment; filename*=UTF-8''${encodeURIComponent(
                    version.originalName
                )}`
            );


            if (
                s3Object.ContentLength !==
                undefined
            ) {

                res.setHeader(
                    "Content-Length",
                    s3Object.ContentLength
                );

            }


            s3Object.Body.pipe(res);

        } catch (error) {

            console.error(
                "Version download error:",
                error
            );


            if (
                error.name ===
                    "NoSuchKey" ||
                error.$metadata?.httpStatusCode ===
                    404
            ) {

                return res.status(404).json({
                    message:
                        "Version file not found in S3."
                });

            }


            res.status(500).json({
                message:
                    "Could not download version."
            });

        }

    }
);


/* =========================================================
   DOWNLOAD CURRENT FILE FROM S3
========================================================= */

app.get(
    "/download/:filename",
    async (req, res) => {

        try {

            const filename =
                req.params.filename;


            const file =
                await FileModel.findOne({
                    filename
                });


            if (!file) {

                return res.status(404).json({
                    message:
                        "File not found."
                });

            }


            const s3Object =
                await s3.send(
                    new GetObjectCommand({

                        Bucket:
                            AWS_S3_BUCKET,

                        Key:
                            filename

                    })
                );


            res.setHeader(
                "Content-Type",
                file.mimeType ||
                    "application/octet-stream"
            );


            res.setHeader(
                "Content-Disposition",
                `attachment; filename*=UTF-8''${encodeURIComponent(
                    file.originalname
                )}`
            );


            if (
                s3Object.ContentLength !==
                undefined
            ) {

                res.setHeader(
                    "Content-Length",
                    s3Object.ContentLength
                );

            }


            s3Object.Body.pipe(res);

        } catch (error) {

            console.error(
                "Download error:",
                error
            );


            if (
                error.name ===
                    "NoSuchKey" ||
                error.$metadata?.httpStatusCode ===
                    404
            ) {

                return res.status(404).json({
                    message:
                        "File not found in S3."
                });

            }


            res.status(500).json({
                message:
                    "Could not download file."
            });

        }

    }
);


/* =========================================================
   DELETE FILE FROM S3
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


            if (!file) {

                return res.status(404).json({
                    message:
                        "File not found."
                });

            }


            /*
                Get all versions before
                deleting MongoDB records.
            */

            const versions =
                await FileVersion.find({
                    fileId:
                        file._id
                });


            /* -----------------------------------------
               DELETE CURRENT FILE FROM S3
            ----------------------------------------- */

            await s3.send(
                new DeleteObjectCommand({

                    Bucket:
                        AWS_S3_BUCKET,

                    Key:
                        filename

                })
            );


            /* -----------------------------------------
               DELETE ALL VERSIONS FROM S3
            ----------------------------------------- */

            for (
                const version of versions
            ) {

                await s3.send(
                    new DeleteObjectCommand({

                        Bucket:
                            AWS_S3_BUCKET,

                        Key:
                            `versions/${version.storedName}`

                    })
                );

            }


            /* -----------------------------------------
               DELETE MONGODB DATA
            ----------------------------------------- */

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


            console.log(
                "File deleted from S3:",
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


            if (
                !folderName ||
                !ownerId
            ) {

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
                        parentFolder ||
                        null

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
                    .populate(
                        "fileId"
                    )
                    .sort({
                        createdAt: -1
                    });


            const result =
                permissions.map(
                    (
                        permission
                    ) => ({

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