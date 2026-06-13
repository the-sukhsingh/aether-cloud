It is a demo project in next.js. 
This project is like a cloud storage provided to user without creating account or something else.
When user opens the website for first time, a userId will be generated and stored in localStorage. This userId will be used for storing the data of the user in cloud.

For cloud service, we will be using the s3 buckets of cloud.

Here are the points to make the user flow effective-
1. there will be a list of documents uploaded to cloud using the userId of the user.
2. user can manage the documents, view, delete, edit name.. etc
3. Allow user to create folders and drag-drom files to the folders
4. there will be a button on the top-right of the screen which will pop up a dialog to upload the document for sending to the cloud.
5. Only documents must be uploaded, also show the preview in the dialog about the selected file.
6. When user clicks on any file, show its preview on half-right screen
7. When user clicks on any folder, open that folder and show its files, on top of the files list, show the breadcrumb for the hierarchy 
8. Allow multiple file upload


Here are the security concerns to keep in mind-
1. Create the logic for uploading to s3 using in /lib folder
2. Make sure no one uploads file more than 10MB in size
3. Make sure files are uploaded to the path userId/filename.ext
4. Allow user to edit the filename while uploading through the dialog.


Here are the design principles to follow-
1. Keep the design minimal and clean
2. there will be dark and light mode
3. No use of shadows, extra margins or paddings
4. use shadcn components most of the time
5. Add suble micro animations using motion from motion/react
6. Show animation for the uploading thing.
7. Use noti-toast library for the toasts


