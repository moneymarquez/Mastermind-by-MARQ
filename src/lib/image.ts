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
