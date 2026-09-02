export function fileToBase64(file: File): Promise<{ mediaType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const data = result.slice(result.indexOf(',') + 1);
      resolve({ mediaType: file.type || 'image/jpeg', data });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Downscales an image file to a JPEG data URL (max `maxWidth` wide) —
 *  a phone screenshot is 3-4 MB as PNG and ~150 KB like this, which is
 *  what makes storing it inline on a row and sending it to the model
 *  from a phone reasonable. Falls back to the raw file if canvas isn't
 *  available. */
export function fileToJpegDataUrl(file: File, maxWidth = 1400, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        fileToBase64(file).then(({ mediaType, data }) => resolve(`data:${mediaType};base64,${data}`)).catch(reject);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });
}
