/*
  Every export goes through here: a save dialog to pick folder and file name (File System
  Access API, Chromium), or a normal download with the suggested name where the API is
  missing (Firefox, Safari). The dialog opens first, while the click still counts as a
  user gesture, and the file is built afterwards (slow builds such as DOCX lose nothing).
*/
const TYPES = {
  csv: { description: 'CSV table', accept: { 'text/csv': ['.csv'] } },
  json: { description: 'JSON', accept: { 'application/json': ['.json'] } },
  png: { description: 'PNG image', accept: { 'image/png': ['.png'] } },
  docx: { description: 'Word document', accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } },
};

/** The save target: a file handle, null if the user cancelled, undefined without the API. */
export async function pickSaveFile(name) {
  if (!window.showSaveFilePicker) return undefined;
  const type = TYPES[name.split('.').pop().toLowerCase()];
  try {
    return await window.showSaveFilePicker({ suggestedName: name, ...(type ? { types: [type] } : {}) });
  } catch (e) {
    if (e.name === 'AbortError') return null;
    throw e;
  }
}

/** Writes the blob to the picked file, or downloads it when there is no picker. */
export async function writeSaveFile(target, blob, name) {
  if (target) {
    const out = await target.createWritable();
    await out.write(blob);
    await out.close();
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Asks where to save, then builds and writes the file. content: a Blob, or a (possibly
 * async) function returning one, called only after the dialog. Returns false on cancel.
 */
export async function saveFile(name, content) {
  const target = await pickSaveFile(name);
  if (target === null) return false;
  const blob = typeof content === 'function' ? await content() : content;
  await writeSaveFile(target, blob, name);
  return true;
}
