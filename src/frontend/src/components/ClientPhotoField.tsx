import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X } from 'lucide-react';
import { cropImageTo35x45, photoToUrl } from '../utils/imageCrop';
import { toast } from 'sonner';

interface ClientPhotoFieldProps {
  value: Uint8Array | null;
  onChange: (photo: Uint8Array | null) => void;
  disabled?: boolean;
}

export default function ClientPhotoField({ value, onChange, disabled }: ClientPhotoFieldProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    value ? photoToUrl(value) : null
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'image est trop grande (max 5MB)');
      return;
    }

    setIsProcessing(true);

    try {
      // Crop and process the image
      const croppedPhoto = await cropImageTo35x45(file);
      
      // Create preview URL
      const url = photoToUrl(croppedPhoto);
      setPreviewUrl(url);
      
      // Update parent component
      onChange(croppedPhoto);
      
      toast.success('Photo ajoutée avec succès');
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Erreur lors du traitement de l\'image');
    } finally {
      setIsProcessing(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label>Photo (35mm × 45mm)</Label>
      
      {previewUrl ? (
        <div className="relative inline-block">
          <img
            src={previewUrl}
            alt="Photo du client"
            className="w-[140px] h-[180px] object-cover rounded-lg border-2 border-border"
            style={{ aspectRatio: '35/45' }}
          />
          {!disabled && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={disabled || isProcessing}
            className="hidden"
            id="photo-upload"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isProcessing}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {isProcessing ? 'Traitement...' : 'Choisir une photo'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Format portrait 35×45mm (recadrage automatique)
          </p>
        </div>
      )}
    </div>
  );
}
