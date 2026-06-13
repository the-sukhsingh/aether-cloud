# AetherCloud ☁️

A modern, minimal, and accountless cloud storage dashboard built with **Next.js**, **React 19**, and **Tailwind CSS v4**. 

AetherCloud gives users instant personal storage spaces without requiring signups or profile creation, combining a premium-grade minimalist user interface with a flexible storage engine that adapts between AWS S3 Buckets and browser-based IndexedDB local fallback.

---

## ✨ Features

- 👤 **Accountless User Spaces**: 
  - Zero signup required. Upon first visit, a unique workspace ID (e.g. `user_7x9a2k`) is generated and persisted in `localStorage`.
  - Users can copy their space ID or switch space IDs to access files from other devices or collaborate.
- 🔄 **Hybrid Storage Engine (AWS S3 & IndexedDB)**:
  - **Cloud Mode**: When AWS environment variables are configured on the server, files are uploaded directly to an AWS S3 Bucket.
  - **Local Demo Mode**: In the absence of S3 credentials, the app seamlessly falls back to a browser-based client-side **IndexedDB** database. The workspace is pre-populated with starter guide files for first-time spaces.
- 📁 **File & Folder Hierarchies**:
  - Support for virtual folders and subfolders.
  - Deep folder navigation with interactive breadcrumbs to easily traverse up and down the hierarchy.
- 🖱️ **Advanced Drag-and-Drop Flow**:
  - **OS Drag & Drop**: Drag files from your computer anywhere on the web application page to trigger a responsive file upload modal.
  - **In-App File Relocation**: Drag items inside the file list and drop them onto folder icons to move them into subdirectories.
- 🔍 **Side Drawer & Rich Media Previews**:
  - Clicking any file opens a details panel on the right half of the screen showing file metadata.
  - Built-in visual previews for images, text files, PDF documents, and a rich markdown renderer.
- ✏️ **Interactive Renaming & Metadata Control**:
  - Rename files directly within the upload modal before sending them to storage.
  - Rename files or folders post-upload from the file explorer or side drawer.
- 🎨 **Minimalist Design & Premium Micro-Animations**:
  - Full support for dark and light themes via `next-themes`.
  - Adherence to flat design guidelines (minimal borders, zero box shadows, clean grids).
  - Smooth micro-animations for page transitions, file navigation, dragging states, and upload progress using `motion/react` (Framer Motion).
- ⚡ **Quota Management**:
  - Visual tracking of space usage against a strict 10.0 MB quota to limit overall usage.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16.2](https://nextjs.org/) (App Router)
- **Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animations**: [Framer Motion / Motion](https://motion.dev/)
- **Icons**: [Lucide React](https://lucide.dev/) & [Tabler Icons](https://tabler.io/)
- **Cloud Storage SDK**: [AWS SDK (S3 client)](https://aws.amazon.com/sdk-for-javascript/)
- **Toasts**: [Noti-toast](https://www.npmjs.com/package/noti-toast)
- **Local Fallback DB**: IndexedDB API

---

## 📂 Directory Structure

```text
cc-projects/demo/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── config/      # Route checking AWS S3 setup status
│   │   │   └── storage/     # API endpoints handling S3 list, upload, delete, rename
│   │   ├── favicon.ico
│   │   ├── globals.css      # Core styles & Tailwind v4 configurations
│   │   ├── layout.tsx       # Root layout with theme provider
│   │   └── page.tsx         # Main dashboard interface and workspace controller
│   ├── components/
│   │   ├── Breadcrumbs.tsx  # Dynamic path navigation breadcrumbs
│   │   ├── DetailsDrawer.tsx# Right half-screen panel for item details and previews
│   │   ├── FileExplorer.tsx # Main grid displaying files & folders with drag-drop moves
│   │   ├── FolderModal.tsx  # Modal for new folder creation
│   │   ├── UploadModal.tsx  # Multi-file upload selector with renaming options
│   │   ├── Providers.tsx    # App providers (Theme, etc.)
│   │   └── theme/           # Theme-toggle utilities
│   ├── lib/
│   │   ├── s3.ts            # AWS S3 direct SDK service handlers
│   │   ├── storage.ts       # Unified storage interface wrapping S3 routes & IndexedDB engine
│   │   └── utils.ts         # Utility functions
├── project.md               # Original project specifications
├── package.json
└── tsconfig.json
```

---

## ⚙️ Environment Variables

Copy or create a `.env.local` file in the root of the project to configure **Cloud Mode** (AWS S3 Integration):

```env
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=your-aws-region-code (e.g. us-east-1)
AWS_S3_BUCKET=your-s3-bucket-name
```

*Note: If these variables are not provided, AetherCloud will automatically fall back to **Local Demo Mode** using IndexedDB in the browser, making it completely functional without AWS credentials.*

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```

### 3. Open the App
Navigate to [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🔒 Security & Upload Specs

1. **Upload Constraints**: Each workspace enforces a cumulative limit of **10.0 MB** of files to optimize storage. Attempts to upload files exceeding this threshold are rejected.
2. **File Pathing & Isolation**: Files are partitioned by workspace ID in the backend storage. The storage key structure is prefixed as: `${userId}/${subfolders}/${filename}.${extension}`.
3. **CORS Handling**: Client-side previews fetch S3 assets using secure signed URLs generated on the server, bypassing browser CORS policies.
