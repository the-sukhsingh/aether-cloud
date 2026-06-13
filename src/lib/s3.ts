import AWS from "aws-sdk";

// Initialize S3 client only if environment variables are present
const hasAws = !!(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_REGION &&
  process.env.AWS_S3_BUCKET
);

const s3 = hasAws
  ? new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
      signatureVersion: "v4",
    })
  : null;

const bucketName = process.env.AWS_S3_BUCKET || "";

export interface S3Item {
  key: string;
  name: string;
  size: number;
  lastModified?: string;
  url: string;
  isFolder: boolean;
}

export function isS3Enabled() {
  return hasAws && s3 !== null;
}

// List all files and folders under a userId prefix
export async function listObjects(userId: string): Promise<S3Item[]> {
  if (!s3) throw new Error("AWS S3 not configured");

  const prefix = `${userId}/`;
  const params = {
    Bucket: bucketName,
    Prefix: prefix,
  };

  const data = await s3.listObjectsV2(params).promise();
  const items: S3Item[] = [];

  if (data.Contents) {
    for (const object of data.Contents) {
      if (!object.Key) continue;
      
      // The key is relative to the user root (e.g. userId/Folder/file.txt)
      // If the key is exactly the user prefix, skip it
      if (object.Key === prefix) continue;

      const isFolder = object.Key.endsWith("/");
      
      // Get a signed URL for non-folder files
      let url = "";
      if (!isFolder) {
        url = s3.getSignedUrl("getObject", {
          Bucket: bucketName,
          Key: object.Key,
          Expires: 3600, // 1 hour
        });
      }

      // Extract name (last segment)
      const segments = object.Key.replace(prefix, "").split("/");
      const name = isFolder 
        ? segments[segments.length - 2] + "/" 
        : segments[segments.length - 1];

      items.push({
        key: object.Key,
        name,
        size: object.Size || 0,
        lastModified: object.LastModified?.toISOString(),
        url,
        isFolder,
      });
    }
  }

  return items;
}

// Upload a file to S3
export async function uploadObject(
  userId: string,
  key: string,
  body: Buffer,
  contentType: string
): Promise<S3Item> {
  if (!s3) throw new Error("AWS S3 not configured");

  const params = {
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  };

  const uploadResult = await s3.upload(params).promise();

  // Generate signed URL
  const url = s3.getSignedUrl("getObject", {
    Bucket: bucketName,
    Key: key,
    Expires: 3600,
  });

  const segments = key.replace(`${userId}/`, "").split("/");
  const name = segments[segments.length - 1];

  return {
    key,
    name,
    size: body.length,
    lastModified: new Date().toISOString(),
    url,
    isFolder: false,
  };
}

// Create a virtual folder in S3 (represented by a zero-byte object ending in /)
export async function createS3Folder(userId: string, key: string): Promise<S3Item> {
  if (!s3) throw new Error("AWS S3 not configured");

  // Key must end in slash
  const folderKey = key.endsWith("/") ? key : `${key}/`;

  const params = {
    Bucket: bucketName,
    Key: folderKey,
    Body: "",
  };

  await s3.putObject(params).promise();

  const segments = folderKey.replace(`${userId}/`, "").split("/");
  const name = segments[segments.length - 2] + "/";

  return {
    key: folderKey,
    name,
    size: 0,
    lastModified: new Date().toISOString(),
    url: "",
    isFolder: true,
  };
}

// Delete an object or folder (and its children)
export async function deleteObject(key: string): Promise<void> {
  if (!s3) throw new Error("AWS S3 not configured");

  const isFolder = key.endsWith("/");

  if (isFolder) {
    // List all objects under the folder prefix and delete them in batch
    const listParams = {
      Bucket: bucketName,
      Prefix: key,
    };

    const listedObjects = await s3.listObjectsV2(listParams).promise();

    if (!listedObjects.Contents || listedObjects.Contents.length === 0) return;

    const deleteParams = {
      Bucket: bucketName,
      Delete: {
        Objects: listedObjects.Contents.map((obj) => ({ Key: obj.Key! })),
      },
    };

    await s3.deleteObjects(deleteParams).promise();

    // If there are more objects (paginated), recursively handle them
    if (listedObjects.IsTruncated) {
      await deleteObject(key);
    }
  } else {
    const params = {
      Bucket: bucketName,
      Key: key,
    };
    await s3.deleteObject(params).promise();
  }
}

// Rename/Move an object (copy and delete)
export async function renameObject(oldKey: string, newKey: string): Promise<void> {
  if (!s3) throw new Error("AWS S3 not configured");

  const isFolder = oldKey.endsWith("/");

  if (isFolder) {
    // Standardize folder keys
    const folderOldKey = oldKey;
    const folderNewKey = newKey.endsWith("/") ? newKey : `${newKey}/`;

    // List all files inside the folder and copy them recursively
    const listParams = {
      Bucket: bucketName,
      Prefix: folderOldKey,
    };

    const listedObjects = await s3.listObjectsV2(listParams).promise();
    if (listedObjects.Contents && listedObjects.Contents.length > 0) {
      for (const obj of listedObjects.Contents) {
        if (!obj.Key) continue;
        const relativePart = obj.Key.substring(folderOldKey.length);
        const childNewKey = `${folderNewKey}${relativePart}`;

        // Copy item
        await s3
          .copyObject({
            Bucket: bucketName,
            CopySource: `${bucketName}/${encodeURIComponent(obj.Key)}`,
            Key: childNewKey,
          })
          .promise();
      }

      // Delete old items
      const deleteParams = {
        Bucket: bucketName,
        Delete: {
          Objects: listedObjects.Contents.map((obj) => ({ Key: obj.Key! })),
        },
      };
      await s3.deleteObjects(deleteParams).promise();
    }
  } else {
    // Copy single file
    await s3
      .copyObject({
        Bucket: bucketName,
        CopySource: `${bucketName}/${encodeURIComponent(oldKey)}`,
        Key: newKey,
      })
      .promise();

    // Delete old file
    await s3
      .deleteObject({
        Bucket: bucketName,
        Key: oldKey,
      })
      .promise();
  }
}

// Fetch file contents from S3 on the server side (to bypass browser CORS)
export async function getObjectContent(key: string): Promise<{ body: Buffer; contentType: string }> {
  if (!s3) throw new Error("AWS S3 not configured");

  const params = {
    Bucket: bucketName,
    Key: key,
  };

  const data = await s3.getObject(params).promise();
  const body = data.Body as Buffer;
  const contentType = data.ContentType || "application/octet-stream";

  return { body, contentType };
}

