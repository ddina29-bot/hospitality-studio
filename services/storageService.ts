
// Service for handling file uploads
// Tries to upload to the backend (Cloudinary/Disk) first.
// Falls back to local Base64 if the server is unreachable (for demo/offline resilience).

export const uploadFile = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Server upload failed');
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.warn("Server upload unavailable, falling back to local storage:", error);
    
    // Fallback: Convert to Base64 for local preview
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
};

export const syncDataToCloud = async (key: string, data: any) => {
  // Persist to localStorage as the "Local Database"
  // In a full implementation, this would POST to /api/sync
  localStorage.setItem(key, JSON.stringify(data));
};
