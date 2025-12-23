// Export project as ZIP using JSZip

function exportProject(projectName, filesData) {
  const zip = new JSZip();

  for (const fname in filesData) {
    if (/^__.+__$/.test(fname)) {
      // Library folder, JSON inside
      try {
        const libFiles = JSON.parse(filesData[fname]);
        const libFolder = zip.folder(fname);
        for (const subfile in libFiles) {
          libFolder.file(subfile, libFiles[subfile]);
        }
      } catch {
        // If parse error, save raw content anyway
        zip.file(fname, filesData[fname]);
      }
    } else {
      // Normal file
      zip.file(fname, filesData[fname]);
    }
  }

  zip.generateAsync({ type: 'blob' }).then(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${projectName}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}