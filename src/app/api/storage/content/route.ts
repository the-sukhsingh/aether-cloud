import { NextRequest, NextResponse } from "next/server";
import { isS3Enabled, getObjectContent } from "@/lib/s3";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    if (!isS3Enabled()) {
      return NextResponse.json({ error: "S3 not configured" }, { status: 400 });
    }

    const { body, contentType } = await getObjectContent(key);

    const download = searchParams.get("download") === "true";
    const headers: Record<string, string> = {
      "Content-Type": contentType,
    };

    if (download) {
      const filename = key.split("/").pop() || "file";
      headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(filename)}"`;
    }

    return new NextResponse(new Uint8Array(body), {
      headers,
    });
  } catch (error: any) {
    console.error("GET Content API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load content from S3" },
      { status: 500 }
    );
  }
}
