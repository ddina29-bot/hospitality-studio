
/**
 * Service for handling file uploads.
 * Sends files to the server API to be stored on disk.
 * Returns a URL link to the file instead of a massive Base64 string.
 */

export const uploadFile = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }

    const data = await response.json();
    // Return the link provided by the server (e.g., /uploads/filename.jpg)
    return data.url;
  } catch (error) {
    console.error("Storage Service Error:", error);
    throw error;
  }
};

export const syncDataToCloud = async (key: string, data: any) => {
  try {
    // Now that we store links instead of Base64, this will fit easily in localStorage
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Local storage sync failed.", e);
  }
};
