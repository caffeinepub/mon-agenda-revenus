/**
 * Crops and resizes an image to a strict 35:45 aspect ratio (passport photo size)
 * Returns a Uint8Array suitable for backend storage
 */
export async function cropImageTo35x45(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));

    img.onload = () => {
      try {
        // Target aspect ratio: 35:45 = 0.7777...
        const targetRatio = 35 / 45;
        
        // Calculate crop dimensions to maintain aspect ratio
        let sourceWidth = img.width;
        let sourceHeight = img.height;
        let sourceX = 0;
        let sourceY = 0;

        const imageRatio = img.width / img.height;

        if (imageRatio > targetRatio) {
          // Image is wider than target ratio - crop width
          sourceWidth = img.height * targetRatio;
          sourceX = (img.width - sourceWidth) / 2;
        } else {
          // Image is taller than target ratio - crop height
          sourceHeight = img.width / targetRatio;
          sourceY = (img.height - sourceHeight) / 2;
        }

        // Output dimensions (reasonable size for display and storage)
        const outputWidth = 350; // 35mm * 10 pixels/mm
        const outputHeight = 450; // 45mm * 10 pixels/mm

        // Create canvas and draw cropped/resized image
        const canvas = document.createElement('canvas');
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw the cropped and resized image
        ctx.drawImage(
          img,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          outputWidth,
          outputHeight
        );

        // Convert to JPEG blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }

            // Convert blob to Uint8Array
            const reader = new FileReader();
            reader.onload = () => {
              const arrayBuffer = reader.result as ArrayBuffer;
              resolve(new Uint8Array(arrayBuffer));
            };
            reader.onerror = () => reject(new Error('Failed to read blob'));
            reader.readAsArrayBuffer(blob);
          },
          'image/jpeg',
          0.9
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    reader.readAsDataURL(file);
  });
}

/**
 * Converts a Uint8Array photo to a blob URL for display
 */
export function photoToUrl(photo: Uint8Array | number[]): string {
  // Convert to a proper Uint8Array with ArrayBuffer to satisfy TypeScript
  let uint8Array: Uint8Array;
  
  if (photo instanceof Uint8Array) {
    // Create a new Uint8Array from the existing one to ensure proper ArrayBuffer type
    uint8Array = new Uint8Array(Array.from(photo));
  } else {
    uint8Array = new Uint8Array(photo);
  }
  
  const blob = new Blob([uint8Array as BlobPart], { type: 'image/jpeg' });
  return URL.createObjectURL(blob);
}
