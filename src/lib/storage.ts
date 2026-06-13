export interface CloudItem {
  key: string;
  name: string;
  size: number;
  lastModified?: string;
  url: string; // Blob URL (client) or Signed S3 URL (server)
  isFolder: boolean;
  type?: string; // MIME type (for previewing local files)
}

// Check if AWS S3 is active on server
export async function checkS3Status(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    return !!data.hasAws;
  } catch (e) {
    console.error("Error checking S3 status:", e);
    return false;
  }
}

// ----------------------------------------------------
// INDEXEDDB FALLBACK ENGINE (For Local Demo Mode)
// ----------------------------------------------------
const DB_NAME = "AetherCloudStorage";
const DB_VERSION = 1;
const STORE_NAME = "files";

interface DBFileRecord {
  key: string;
  userId: string;
  name: string;
  size: number;
  type: string;
  lastModified: string;
  content: ArrayBuffer | null;
  isFolder: boolean;
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB is only available in browser"));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
  });
}

// Prepopulate database with sample files for a new user space
export async function prepopulateIndexedDB(userId: string): Promise<void> {
  const items = await listIndexedDB(userId);
  if (items.length > 0) return; // Already populated

  // Create sample folders
  await createIndexedDBFolder(userId, `${userId}/Documents`);
  await createIndexedDBFolder(userId, `${userId}/Projects`);
  await createIndexedDBFolder(userId, `${userId}/Images`);

  // Create sample files
  const encoder = new TextEncoder();
  const sampleTxt = encoder.encode(
    "Welcome to AetherCloud!\n\nThis is a local demo workspace running on your browser's IndexedDB. Your files are stored safely in your browser storage.\n\nKey features of this cloud storage dashboard:\n1. Drag-and-drop to upload files.\n2. Click folders to navigate down, use breadcrumbs to go up.\n3. Drag files and drop them onto folder icons to move them.\n4. Click any file to see its preview on the half-right screen.\n5. Custom file name editing during upload or in details panel.\n\nEnjoy exploring!"
  ).buffer;
  
  await uploadIndexedDBFile(
    userId,
    `${userId}/Documents/Getting Started.txt`,
    "Getting Started.txt",
    new Blob([sampleTxt], { type: "text/plain" })
  );

  const sampleMd = encoder.encode(
    "# Markdown Preview Demo\n\nThis dashboard has a rich markdown renderer built right in!\n\n## Styling Guidelines Followed:\n- Minimal borders, zero drop shadows\n- Micro-animations powered by framer-motion\n- Smooth transitions and clean grid structure\n\n### Formatted list\n- Bullet item A\n- Bullet item B\n- Code preview with line numbers!\n\nTry uploading your own `.md` file to test it out."
  ).buffer;

  await uploadIndexedDBFile(
    userId,
    `${userId}/Projects/Readme.md`,
    "Readme.md",
    new Blob([sampleMd], { type: "text/markdown" })
  );
}

// 1. List files
async function listIndexedDB(userId: string): Promise<CloudItem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const allRecords: DBFileRecord[] = request.result || [];
      // Filter for this user
      const userPrefix = `${userId}/`;
      const filtered = allRecords.filter((rec) => rec.key.startsWith(userPrefix) && rec.key !== userPrefix);
      
      const items: CloudItem[] = filtered.map((rec) => {
        let url = "";
        if (!rec.isFolder && rec.content) {
          const blob = new Blob([rec.content], { type: rec.type });
          url = URL.createObjectURL(blob);
        }
        return {
          key: rec.key,
          name: rec.name,
          size: rec.size,
          lastModified: rec.lastModified,
          url,
          isFolder: rec.isFolder,
          type: rec.type,
        };
      });
      resolve(items);
    };
  });
}

// 2. Upload file
async function uploadIndexedDBFile(
  userId: string,
  key: string,
  name: string,
  file: Blob
): Promise<CloudItem> {
  const db = await getDB();
  const buffer = await file.arrayBuffer();
  
  const record: DBFileRecord = {
    key,
    userId,
    name,
    size: file.size,
    type: file.type || "application/octet-stream",
    lastModified: new Date().toISOString(),
    content: buffer,
    isFolder: false,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const url = URL.createObjectURL(file);
      resolve({
        key: record.key,
        name: record.name,
        size: record.size,
        lastModified: record.lastModified,
        url,
        isFolder: false,
        type: record.type,
      });
    };
  });
}

// 3. Create folder
async function createIndexedDBFolder(userId: string, key: string): Promise<CloudItem> {
  const db = await getDB();
  const folderKey = key.endsWith("/") ? key : `${key}/`;
  const segments = folderKey.replace(`${userId}/`, "").split("/");
  const name = segments[segments.length - 2] + "/";

  const record: DBFileRecord = {
    key: folderKey,
    userId,
    name,
    size: 0,
    type: "",
    lastModified: new Date().toISOString(),
    content: null,
    isFolder: true,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve({
        key: record.key,
        name: record.name,
        size: 0,
        lastModified: record.lastModified,
        url: "",
        isFolder: true,
      });
    };
  });
}

// 4. Delete object or folder recursively
async function deleteIndexedDBObject(key: string): Promise<void> {
  const db = await getDB();
  
  if (key.endsWith("/")) {
    // It's a folder, delete everything starting with this prefix
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const records: DBFileRecord[] = request.result || [];
        const toDelete = records.filter((rec) => rec.key.startsWith(key));
        
        let deletedCount = 0;
        if (toDelete.length === 0) {
          resolve();
          return;
        }

        toDelete.forEach((rec) => {
          const reqDel = store.delete(rec.key);
          reqDel.onsuccess = () => {
            deletedCount++;
            if (deletedCount === toDelete.length) {
              resolve();
            }
          };
          reqDel.onerror = () => reject(reqDel.error);
        });
      };
    });
  } else {
    // Delete single object
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

// 5. Rename/move object or folder
async function renameIndexedDBObject(oldKey: string, newKey: string): Promise<void> {
  const db = await getDB();
  const isFolder = oldKey.endsWith("/");
  const normalizedNewKey = isFolder && !newKey.endsWith("/") ? `${newKey}/` : newKey;

  if (isFolder) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        const records: DBFileRecord[] = request.result || [];
        const childRecords = records.filter((rec) => rec.key.startsWith(oldKey));

        if (childRecords.length === 0) {
          resolve();
          return;
        }

        try {
          for (const rec of childRecords) {
            const suffix = rec.key.substring(oldKey.length);
            const childNewKey = `${normalizedNewKey}${suffix}`;
            
            // Extract the new segment name
            const segments = childNewKey.split("/");
            let childNewName = segments[segments.length - 1];
            if (rec.isFolder) {
              childNewName = segments[segments.length - 2] + "/";
            }

            const updatedRec: DBFileRecord = {
              ...rec,
              key: childNewKey,
              name: childNewName,
            };

            // Write new record and delete old
            await new Promise<void>((resWrite, rejWrite) => {
              const reqWrite = store.put(updatedRec);
              reqWrite.onsuccess = () => resWrite();
              reqWrite.onerror = () => rejWrite(reqWrite.error);
            });

            await new Promise<void>((resDel, rejDel) => {
              const reqDel = store.delete(rec.key);
              reqDel.onsuccess = () => resDel();
              reqDel.onerror = () => rejDel(reqDel.error);
            });
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      };
    });
  } else {
    // Move single file
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(oldKey);

      getReq.onerror = () => reject(getReq.error);
      getReq.onsuccess = () => {
        const record: DBFileRecord = getReq.result;
        if (!record) {
          reject(new Error("Record not found for rename"));
          return;
        }

        const segments = normalizedNewKey.split("/");
        const newName = segments[segments.length - 1];

        const newRecord: DBFileRecord = {
          ...record,
          key: normalizedNewKey,
          name: newName,
        };

        const putReq = store.put(newRecord);
        putReq.onerror = () => reject(putReq.error);
        putReq.onsuccess = () => {
          const delReq = store.delete(oldKey);
          delReq.onerror = () => reject(delReq.error);
          delReq.onsuccess = () => resolve();
        };
      };
    });
  }
}

// ----------------------------------------------------
// UNIFIED STORAGE INTERFACE
// ----------------------------------------------------
export const storageClient = {
  // Check S3 and fetch items, or run local IndexedDB list
  list: async (userId: string, isS3: boolean): Promise<CloudItem[]> => {
    if (isS3) {
      try {
        const res = await fetch(`/api/storage?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        if (data.isDemoMode) {
          return listIndexedDB(userId);
        }
        if (data.error) throw new Error(data.error);
        return data.items || [];
      } catch (err) {
        console.warn("S3 list failed, using IndexedDB fallback:", err);
        return listIndexedDB(userId);
      }
    } else {
      return listIndexedDB(userId);
    }
  },

  // Upload a file
  upload: async (
    userId: string,
    key: string,
    name: string,
    file: File,
    isS3: boolean
  ): Promise<CloudItem> => {
    if (isS3) {
      try {
        const formData = new FormData();
        formData.append("userId", userId);
        formData.append("key", key);
        formData.append("file", file);
        formData.append("action", "upload");

        const res = await fetch("/api/storage", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.isDemoMode) {
          return uploadIndexedDBFile(userId, key, name, file);
        }
        if (data.error) throw new Error(data.error);
        return data.item;
      } catch (err) {
        console.warn("S3 upload failed, using IndexedDB fallback:", err);
        return uploadIndexedDBFile(userId, key, name, file);
      }
    } else {
      return uploadIndexedDBFile(userId, key, name, file);
    }
  },

  // Create folder
  createFolder: async (userId: string, key: string, isS3: boolean): Promise<CloudItem> => {
    if (isS3) {
      try {
        const formData = new FormData();
        formData.append("userId", userId);
        formData.append("key", key);
        formData.append("action", "createFolder");

        const res = await fetch("/api/storage", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.isDemoMode) {
          return createIndexedDBFolder(userId, key);
        }
        if (data.error) throw new Error(data.error);
        return data.item;
      } catch (err) {
        console.warn("S3 createFolder failed, using IndexedDB fallback:", err);
        return createIndexedDBFolder(userId, key);
      }
    } else {
      return createIndexedDBFolder(userId, key);
    }
  },

  // Delete item or folder
  delete: async (key: string, isS3: boolean): Promise<void> => {
    if (isS3) {
      try {
        const res = await fetch(`/api/storage?key=${encodeURIComponent(key)}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (data.isDemoMode) {
          return deleteIndexedDBObject(key);
        }
        if (data.error) throw new Error(data.error);
      } catch (err) {
        console.warn("S3 delete failed, using IndexedDB fallback:", err);
        return deleteIndexedDBObject(key);
      }
    } else {
      return deleteIndexedDBObject(key);
    }
  },

  // Rename or move item
  rename: async (oldKey: string, newKey: string, isS3: boolean): Promise<void> => {
    if (isS3) {
      try {
        const res = await fetch("/api/storage", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldKey, newKey }),
        });
        const data = await res.json();
        if (data.isDemoMode) {
          return renameIndexedDBObject(oldKey, newKey);
        }
        if (data.error) throw new Error(data.error);
      } catch (err) {
        console.warn("S3 rename failed, using IndexedDB fallback:", err);
        return renameIndexedDBObject(oldKey, newKey);
      }
    } else {
      return renameIndexedDBObject(oldKey, newKey);
    }
  },
};
