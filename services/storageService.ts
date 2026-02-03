
// Service for handling file uploads purely on the client side.
// Converts images to Base64 for local persistence in localStorage.

export const uploadFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert image to Base64"));
      }
    };
    reader.onerror = () => reject(new Error("File reading failed"));
    reader.readAsDataURL(file);
  });
};

export const syncDataToCloud = async (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};
