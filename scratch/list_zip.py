import zipfile
z = zipfile.ZipFile(r'd:\github_integration_tool\progress-push\leafy-extension.zip')
for f in z.filelist:
    print(f.filename)
z.close()
