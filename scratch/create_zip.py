import zipfile
import os

def zipdir(path, ziph):
    # ziph is zipfile handle
    for root, dirs, files in os.walk(path):
        for file in files:
            # Create a proper relative path with forward slashes
            abs_path = os.path.join(root, file)
            rel_path = os.path.relpath(abs_path, path)
            # Ensure forward slashes for Firefox compatibility
            rel_path = rel_path.replace(os.sep, '/')
            ziph.write(abs_path, rel_path)

if __name__ == '__main__':
    zip_path = r'd:\github_integration_tool\progress-push\leafy-extension.zip'
    source_dir = r'd:\github_integration_tool\progress-push\chrome-extension'
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        zipdir(source_dir, zipf)
    print(f"Successfully created {zip_path} with forward slashes.")
