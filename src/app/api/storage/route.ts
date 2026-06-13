import { NextRequest, NextResponse } from "next/server";
import {
  isS3Enabled,
  listObjects,
  uploadObject,
  createS3Folder,
  deleteObject,
  renameObject,
} from "@/lib/s3";

// GET: List all files for user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "UserId is required" }, { status: 400 });
    }

    if (!isS3Enabled()) {
      return NextResponse.json(
        { error: "S3 not configured", isDemoMode: true },
        { status: 200 }
      );
    }

    const items = await listObjects(userId);
    return NextResponse.json({ items });
  } catch (error: any) {
    console.error("GET API error:", error);
    return NextResponse.json({ error: error.message || "Failed to list files" }, { status: 500 });
  }
}

// POST: Upload file or create folder
export async function POST(request: NextRequest) {
  try {
    if (!isS3Enabled()) {
      return NextResponse.json(
        { error: "S3 not configured", isDemoMode: true },
        { status: 200 }
      );
    }

    const formData = await request.formData();
    const userId = formData.get("userId") as string;
    const action = formData.get("action") as string; // "upload" or "createFolder"

    if (!userId) {
      return NextResponse.json({ error: "UserId is required" }, { status: 400 });
    }

    if (action === "createFolder") {
      const folderKey = formData.get("key") as string; // userId/folderPath/folderName/
      if (!folderKey) {
        return NextResponse.json({ error: "Folder key is required" }, { status: 400 });
      }

      const folderItem = await createS3Folder(userId, folderKey);
      return NextResponse.json({ success: true, item: folderItem });
    } else {
      // Action is upload
      const file = formData.get("file") as File;
      const key = formData.get("key") as string; // userId/folderPath/fileName.ext

      if (!file || !key) {
        return NextResponse.json({ error: "File and key are required" }, { status: 400 });
      }

      // Get current total S3 usage to enforce 10MB overall limit
      const existingItems = await listObjects(userId);
      const currentTotalSize = existingItems.reduce((acc, item) => acc + item.size, 0);

      if (currentTotalSize + file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "Storage quota exceeded (10MB overall limit)" }, { status: 400 });
      }

      // Size limit: 10MB
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const item = await uploadObject(userId, key, buffer, file.type);
      return NextResponse.json({ success: true, item });
    }
  } catch (error: any) {
    console.error("POST API error:", error);
    return NextResponse.json({ error: error.message || "Operation failed" }, { status: 500 });
  }
}

// DELETE: Delete a file or folder
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    if (!isS3Enabled()) {
      return NextResponse.json(
        { error: "S3 not configured", isDemoMode: true },
        { status: 200 }
      );
    }

    await deleteObject(key);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE API error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete" }, { status: 500 });
  }
}

// PUT: Rename or move a file or folder
export async function PUT(request: NextRequest) {
  try {
    if (!isS3Enabled()) {
      return NextResponse.json(
        { error: "S3 not configured", isDemoMode: true },
        { status: 200 }
      );
    }

    const { oldKey, newKey } = await request.json();

    if (!oldKey || !newKey) {
      return NextResponse.json({ error: "oldKey and newKey are required" }, { status: 400 });
    }

    await renameObject(oldKey, newKey);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PUT API error:", error);
    return NextResponse.json({ error: error.message || "Failed to rename" }, { status: 500 });
  }
}
